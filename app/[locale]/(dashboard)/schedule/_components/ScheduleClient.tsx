'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { ChevronLeft, ChevronRight, Send, CalendarPlus, Clock } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { describeSupabaseError } from '@/lib/errors'
import { useErrorToast } from '@/components/shared/ErrorToast'
import { AVAILABILITY_COLORS, type AvailabilityKind } from '@/lib/constants'
import { DayEditor } from './DayEditor'
import { AvailabilityEditor } from './AvailabilityEditor'
import { SwapsPanel } from './SwapsPanel'
import { BulkEditor } from './BulkEditor'
import { ShiftTypesEditor } from './ShiftTypesEditor'
import type { ShiftType, ScheduleEntry, Availability, ShiftSwap } from '@/lib/supabase/types'

interface SwapEntryInfo {
  id: number
  user_id: string
  work_date: string
  shift_type_id: number | null
}

interface EmployeeRow {
  id: string
  full_name: string | null
  is_lead: boolean
}

interface Props {
  department: string
  month: string // 'YYYY-MM'
  daysInMonth: number
  employees: EmployeeRow[]
  shiftTypes: ShiftType[]
  entries: ScheduleEntry[]
  availability: Availability[]
  swaps: ShiftSwap[]
  swapEntries: SwapEntryInfo[]
  isAdmin: boolean
  canManage: boolean
  currentUserId: string
  currentUserRole: string
  departments: string[]
}

// Przesuwa 'YYYY-MM' o delta miesięcy.
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// getDay(): 0=niedziela..6=sobota → indeks tygodnia zaczynającego się od poniedziałku (0=Pn..6=Nd)
const mondayIndex = (jsDay: number) => (jsDay + 6) % 7

export function ScheduleClient({
  department, month, daysInMonth, employees, shiftTypes, entries, availability, swaps, swapEntries, isAdmin, canManage, currentUserId, currentUserRole, departments,
}: Props) {
  const t = useTranslations('schedule')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { showError } = useErrorToast()

  const [view, setView] = useState<'schedule' | 'availability' | 'swaps'>('schedule')
  const [editorDate, setEditorDate] = useState<string | null>(null)
  const [availEditorDate, setAvailEditorDate] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [shiftTypesOpen, setShiftTypesOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  // Pracownik edytuje dostępność tylko we własnym dziale (RLS wymaga department = własna rola).
  const canEditOwnAvailability = currentUserRole === department

  const [year, monthNum] = month.split('-').map(Number)

  // „Dziś" liczone po stronie klienta (unikamy hydration mismatch server UTC vs klient).
  const [todayStr, setTodayStr] = useState<string | null>(null)
  useEffect(() => {
    const n = new Date()
    setTodayStr(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`)
  }, [])

  const empName = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of employees) m.set(e.id, e.full_name || '—')
    return m
  }, [employees])

  const shiftName = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of shiftTypes) m.set(s.id, s.name)
    return m
  }, [shiftTypes])

  // data → (shift_type_id → lista nazwisk)
  const byDate = useMemo(() => {
    const m = new Map<string, Map<number, string[]>>()
    for (const e of entries) {
      if (e.shift_type_id == null) continue
      if (!m.has(e.work_date)) m.set(e.work_date, new Map())
      const dm = m.get(e.work_date)!
      if (!dm.has(e.shift_type_id)) dm.set(e.shift_type_id, [])
      dm.get(e.shift_type_id)!.push(empName.get(e.user_id) ?? '—')
    }
    return m
  }, [entries, empName])

  // (date|empId) → shift_type_id — do wypełnienia edytora dnia.
  const entryByDateEmp = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of entries) {
      if (e.shift_type_id != null) m.set(`${e.work_date}|${e.user_id}`, e.shift_type_id)
    }
    return m
  }, [entries])

  const hasDrafts = useMemo(() => entries.some((e) => e.status === 'draft'), [entries])

  // data → lista dostępności (z nazwiskiem) — dla widoku Dostępność.
  const availByDate = useMemo(() => {
    const m = new Map<string, { name: string; kind: AvailabilityKind; shiftPref: number | null }[]>()
    for (const a of availability) {
      if (!m.has(a.work_date)) m.set(a.work_date, [])
      m.get(a.work_date)!.push({ name: empName.get(a.user_id) ?? '—', kind: a.kind, shiftPref: a.shift_pref })
    }
    return m
  }, [availability, empName])

  // data → moja dostępność (do wypełnienia edytora) + (date|empId) → dostępność (podkład w DayEditor).
  const myAvailByDate = useMemo(() => {
    const m = new Map<string, Availability>()
    for (const a of availability) if (a.user_id === currentUserId) m.set(a.work_date, a)
    return m
  }, [availability, currentUserId])

  const availByDateEmp = useMemo(() => {
    const m = new Map<string, { kind: AvailabilityKind; shiftPref: number | null }>()
    for (const a of availability) m.set(`${a.work_date}|${a.user_id}`, { kind: a.kind, shiftPref: a.shift_pref })
    return m
  }, [availability])

  // Etykiety dni tygodnia (Pn..Nd) w bieżącym locale — 2024-01-01 to poniedziałek.
  const weekdayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' })),
    [locale],
  )

  // Komórki kalendarza: puste na początku (offset) + dni miesiąca, dopełnione do pełnych tygodni.
  const cells = useMemo(() => {
    const leading = mondayIndex(new Date(year, monthNum - 1, 1).getDay())
    const arr: ({ day: number; dateStr: string; isWeekend: boolean } | null)[] = []
    for (let i = 0; i < leading; i++) arr.push(null)
    for (let day = 1; day <= daysInMonth; day++) {
      const dow = mondayIndex(new Date(year, monthNum - 1, day).getDay())
      arr.push({ day, dateStr: `${month}-${String(day).padStart(2, '0')}`, isWeekend: dow >= 5 })
    }
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [year, monthNum, daysInMonth, month])

  const monthLabel = useMemo(
    () => new Date(year, monthNum - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
    [year, monthNum, locale],
  )

  const navigate = (next: { dept?: string; month?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next.dept) params.set('dept', next.dept)
    if (next.month) params.set('month', next.month)
    router.push(`${pathname}?${params.toString()}`)
  }

  const deptLabel = (d: string) => {
    const key = `roles.${d}` as Parameters<typeof t>[0]
    const label = t(key)
    return label === key ? d : label
  }

  const handleSaved = () => {
    setEditorDate(null)
    setAvailEditorDate(null)
    router.refresh()
  }

  const handlePublish = async () => {
    setPublishing(true)
    const supabase = createClient()
    const firstDay = `${month}-01`
    const lastDay = `${month}-${String(daysInMonth).padStart(2, '0')}`
    const { error } = await supabase
      .from('schedule_entries')
      .update({ status: 'published' })
      .eq('department', department)
      .eq('status', 'draft')
      .gte('work_date', firstDay)
      .lte('work_date', lastDay)
    setPublishing(false)
    if (error) {
      showError(describeSupabaseError(error, { table: 'schedule_entries', operation: 'update' }))
      return
    }
    router.refresh()
  }

  // Początkowe przypisania dla edytora otwartego dnia (empId → shift_type_id).
  const editorInitial = useMemo(() => {
    if (!editorDate) return {}
    const obj: Record<string, number> = {}
    for (const e of employees) {
      const s = entryByDateEmp.get(`${editorDate}|${e.id}`)
      if (s != null) obj[e.id] = s
    }
    return obj
  }, [editorDate, employees, entryByDateEmp])

  // Podkład dostępności dla DayEditor (empId → {kind, shiftPref}) w otwartym dniu.
  const editorAvailability = useMemo(() => {
    if (!editorDate) return {}
    const obj: Record<string, { kind: AvailabilityKind; shiftPref: number | null }> = {}
    for (const e of employees) {
      const a = availByDateEmp.get(`${editorDate}|${e.id}`)
      if (a) obj[e.id] = a
    }
    return obj
  }, [editorDate, employees, availByDateEmp])

  return (
    <>
      <PageHeader title={t('title')} subtitle={`${t('subtitle')} · ${deptLabel(department)}`} />

      {/* Pasek sterowania: widok + dział (admin) + nawigacja miesiąca */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Przełącznik Grafik / Dostępność / Zamiany */}
          <div className="inline-flex rounded-lg p-0.5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            {(['schedule', 'availability', 'swaps'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                style={{
                  backgroundColor: view === v ? 'var(--accent)' : 'transparent',
                  color: view === v ? '#fff' : 'var(--text-muted)',
                }}
              >
                {v === 'schedule' ? t('viewSchedule') : v === 'availability' ? t('viewAvailability') : t('viewSwaps')}
              </button>
            ))}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('department')}:</span>
              <select
                value={department}
                onChange={(e) => navigate({ dept: e.target.value })}
                className="px-3 py-2 text-sm rounded-lg"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                {departments.map((d) => <option key={d} value={d}>{deptLabel(d)}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate({ month: shiftMonth(month, -1) })}
            aria-label={t('prevMonth')}
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium capitalize min-w-[9rem] text-center" style={{ color: 'var(--text)' }}>
            {monthLabel}
          </span>
          <button
            onClick={() => navigate({ month: shiftMonth(month, 1) })}
            aria-label={t('nextMonth')}
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Pasek zarządzania (kierownik/admin): publikacja + status */}
      {canManage && view === 'schedule' && (
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span
            className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1"
            style={{
              backgroundColor: hasDrafts ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
              color: hasDrafts ? '#f59e0b' : '#22c55e',
            }}
          >
            {hasDrafts ? t('hasDrafts') : t('allPublished')}
          </span>
          {hasDrafts && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              <Send size={13} /> {publishing ? t('publishing') : t('publish')}
            </button>
          )}
          <button
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <CalendarPlus size={13} /> {t('bulkAdd')}
          </button>
          <button
            onClick={() => setShiftTypesOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <Clock size={13} /> {t('shiftTypesEdit')}
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('clickHint')}</span>
        </div>
      )}

      {/* Podpowiedź w widoku Dostępność */}
      {view === 'availability' && canEditOwnAvailability && (
        <div className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>{t('availClickHint')}</div>
      )}

      {/* Lista pracowników działu (widoczna nawet bez przypisanych zmian) */}
      {view !== 'swaps' && employees.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
          <span style={{ color: 'var(--text-muted)' }}>{t('staff')} ({employees.length}):</span>
          {employees.map((e) => (
            <span
              key={e.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              {e.full_name || '—'}
              {e.is_lead && <span style={{ color: 'var(--accent)' }}>★</span>}
            </span>
          ))}
        </div>
      )}

      {/* Legenda zmian (widok Grafik) */}
      {view === 'schedule' && shiftTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {shiftTypes.map((s) => {
            const color = s.color || 'var(--accent)'
            return (
              <span key={s.id} className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                {s.name}
                {s.start_time && s.end_time && (
                  <span style={{ color: 'var(--text-muted)' }}>({s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)})</span>
                )}
              </span>
            )
          })}
        </div>
      )}

      {/* Legenda dostępności (widok Dostępność) */}
      {view === 'availability' && (
        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {(['available', 'unavailable', 'preferred'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: AVAILABILITY_COLORS[k] }} />
              {t(k as Parameters<typeof t>[0])}
            </span>
          ))}
        </div>
      )}

      {view !== 'swaps' && employees.length === 0 && (
        <div className="mb-3 rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          {t('noEmployees')}
        </div>
      )}

      {/* Panel zamian dniówek */}
      {view === 'swaps' && (
        <SwapsPanel
          department={department}
          currentUserId={currentUserId}
          canManage={canManage}
          employees={employees}
          shiftTypes={shiftTypes}
          entries={entries}
          swaps={swaps}
          swapEntries={swapEntries}
          onChanged={() => router.refresh()}
        />
      )}

      {/* Kalendarz */}
      {view !== 'swaps' && (
      <div className="overflow-x-auto">
        <div style={{ minWidth: '760px' }}>
          {/* Nagłówek dni tygodnia */}
          <div className="grid grid-cols-7">
            {weekdayLabels.map((w, i) => (
              <div
                key={i}
                className="px-2 py-2 text-xs font-medium capitalize text-center"
                style={{ color: i >= 5 ? 'var(--text-muted)' : 'var(--text)' }}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Siatka dni */}
          <div className="grid grid-cols-7" style={{ gap: '1px', backgroundColor: 'var(--border)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            {cells.map((cell, idx) => {
              if (!cell) {
                return <div key={idx} style={{ backgroundColor: 'var(--bg)', minHeight: '104px' }} />
              }
              const isToday = cell.dateStr === todayStr
              const clickable = view === 'schedule' ? canManage : canEditOwnAvailability
              const onOpen = view === 'schedule'
                ? () => setEditorDate(cell.dateStr)
                : () => setAvailEditorDate(cell.dateStr)
              return (
                <div
                  key={idx}
                  onClick={clickable ? onOpen : undefined}
                  className={`p-1.5 flex flex-col gap-1 ${clickable ? 'cursor-pointer transition-colors' : ''}`}
                  style={{
                    backgroundColor: cell.isWeekend ? 'rgba(128,128,128,0.06)' : 'var(--surface)',
                    minHeight: '104px',
                  }}
                  onMouseEnter={clickable ? (e) => { e.currentTarget.style.backgroundColor = 'rgba(224,120,24,0.08)' } : undefined}
                  onMouseLeave={clickable ? (e) => { e.currentTarget.style.backgroundColor = cell.isWeekend ? 'rgba(128,128,128,0.06)' : 'var(--surface)' } : undefined}
                >
                  <div className="flex justify-end">
                    <span
                      className="inline-flex items-center justify-center text-xs font-medium rounded-full w-6 h-6"
                      style={{
                        backgroundColor: isToday ? 'var(--accent)' : 'transparent',
                        color: isToday ? '#fff' : cell.isWeekend ? 'var(--text-muted)' : 'var(--text)',
                      }}
                    >
                      {cell.day}
                    </span>
                  </div>

                  {view === 'schedule' ? (
                    <div className="flex flex-col gap-1">
                      {shiftTypes.map((s) => {
                        const names = byDate.get(cell.dateStr)?.get(s.id)
                        if (!names || names.length === 0) return null
                        const color = s.color || 'var(--accent)'
                        return (
                          <div
                            key={s.id}
                            className="rounded px-1.5 py-1 text-[11px] leading-tight"
                            style={{ backgroundColor: `${color}1f`, borderLeft: `3px solid ${color}` }}
                          >
                            <span className="font-medium" style={{ color }}>{s.name}</span>
                            <span style={{ color: 'var(--text)' }}> · {names.join(', ')}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {(availByDate.get(cell.dateStr) ?? []).map((a, i) => {
                        const color = AVAILABILITY_COLORS[a.kind]
                        return (
                          <div
                            key={i}
                            className="rounded px-1.5 py-1 text-[11px] leading-tight"
                            style={{ backgroundColor: `${color}1f`, borderLeft: `3px solid ${color}` }}
                          >
                            <span style={{ color: 'var(--text)' }}>{a.name}</span>
                            <span className="font-medium" style={{ color }}> · {t(a.kind as Parameters<typeof t>[0])}</span>
                            {a.shiftPref != null && shiftName.get(a.shiftPref) && (
                              <span style={{ color: 'var(--text-muted)' }}> ({shiftName.get(a.shiftPref)})</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      )}

      {canManage && editorDate && (
        <DayEditor
          dateStr={editorDate}
          department={department}
          employees={employees}
          shiftTypes={shiftTypes}
          currentUserId={currentUserId}
          initial={editorInitial}
          availability={editorAvailability}
          onClose={() => setEditorDate(null)}
          onSaved={handleSaved}
        />
      )}

      {canManage && shiftTypesOpen && (
        <ShiftTypesEditor
          department={department}
          shiftTypes={shiftTypes}
          onClose={() => setShiftTypesOpen(false)}
          onSaved={() => { setShiftTypesOpen(false); router.refresh() }}
        />
      )}

      {canManage && bulkOpen && (
        <BulkEditor
          department={department}
          month={month}
          daysInMonth={daysInMonth}
          employees={employees}
          shiftTypes={shiftTypes}
          currentUserId={currentUserId}
          onClose={() => setBulkOpen(false)}
          onSaved={() => { setBulkOpen(false); router.refresh() }}
        />
      )}

      {canEditOwnAvailability && availEditorDate && (
        <AvailabilityEditor
          dateStr={availEditorDate}
          department={department}
          currentUserId={currentUserId}
          shiftTypes={shiftTypes}
          initial={myAvailByDate.get(availEditorDate) ?? null}
          onClose={() => setAvailEditorDate(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
