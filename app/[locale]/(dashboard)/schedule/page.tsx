import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { ScheduleClient } from './_components/ScheduleClient'
import { SCHEDULE_DEPARTMENTS, type ScheduleDepartment } from '@/lib/constants'
import type { Role, ShiftType, ScheduleEntry, Availability, ShiftSwap } from '@/lib/supabase/types'

interface EmployeeRow {
  id: string
  full_name: string | null
  is_lead: boolean
}

export interface SwapEntryInfo {
  id: number
  user_id: string
  work_date: string
  shift_type_id: number | null
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string; month?: string }>
}) {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const isAdmin = role === 'admin'
  const sp = await searchParams

  // Dział: admin wybiera przełącznikiem; reszta ma zablokowany na swoją rolę.
  const department: string = isAdmin
    ? (SCHEDULE_DEPARTMENTS.includes(sp.dept as ScheduleDepartment) ? sp.dept! : SCHEDULE_DEPARTMENTS[0])
    : role

  // Miesiąc: 'YYYY-MM', domyślnie bieżący.
  const now = new Date()
  const monthStr = /^\d{4}-\d{2}$/.test(sp.month ?? '')
    ? sp.month!
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, month] = monthStr.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate() // month jest 1-based → dzień 0 kolejnego = ostatni bieżącego
  const firstDay = `${monthStr}-01`
  const lastDay = `${monthStr}-${String(daysInMonth).padStart(2, '0')}`

  // Kierownik działu (ta sama rola + is_lead) lub admin — może edytować grafik.
  const canManage = isAdmin || (profile.is_lead && role === department)

  const supabase = await createClient()

  // Zwykli pracownicy widzą tylko opublikowane wpisy; kierownik/admin widzi też robocze.
  let entriesQuery = supabase
    .from('schedule_entries')
    .select('*')
    .eq('department', department)
    .gte('work_date', firstDay)
    .lte('work_date', lastDay)
  if (!canManage) entriesQuery = entriesQuery.eq('status', 'published')

  const [employeesRes, shiftTypesRes, entriesRes, availabilityRes, swapsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, is_lead').eq('role', department).order('full_name'),
    supabase.from('shift_types').select('*').eq('department', department).order('start_time'),
    entriesQuery,
    // RLS zwróci: pracownikowi własne wiersze, kierownikowi/adminowi całego działu.
    supabase.from('availability').select('*').eq('department', department).gte('work_date', firstDay).lte('work_date', lastDay),
    // Zamiany dniówek — RLS: uczestnik widzi swoje, kierownik/admin całego działu.
    supabase.from('shift_swaps').select('*').eq('department', department).order('created_at', { ascending: false }),
  ])

  // Wpisy grafiku powiązane z zamianami (mogą być spoza bieżącego miesiąca) — do opisu zamian.
  const swaps = (swapsRes.data ?? []) as ShiftSwap[]
  const swapEntryIds = [...new Set(swaps.flatMap((s) => [s.requester_entry_id, s.target_entry_id]))]
  const swapEntriesRes = swapEntryIds.length > 0
    ? await supabase.from('schedule_entries').select('id, user_id, work_date, shift_type_id').in('id', swapEntryIds)
    : { data: [] }

  return (
    <ScheduleClient
      department={department}
      month={monthStr}
      daysInMonth={daysInMonth}
      employees={(employeesRes.data ?? []) as EmployeeRow[]}
      shiftTypes={(shiftTypesRes.data ?? []) as ShiftType[]}
      entries={(entriesRes.data ?? []) as ScheduleEntry[]}
      availability={(availabilityRes.data ?? []) as Availability[]}
      swaps={swaps}
      swapEntries={(swapEntriesRes.data ?? []) as SwapEntryInfo[]}
      isAdmin={isAdmin}
      canManage={canManage}
      currentUserId={profile.id}
      currentUserRole={role}
      departments={[...SCHEDULE_DEPARTMENTS]}
    />
  )
}
