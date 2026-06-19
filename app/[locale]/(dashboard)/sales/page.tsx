import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { SalesClient } from './_components/SalesClient'
import { getTabWritePerms } from '@/lib/permissions'
import type { Role } from '@/lib/supabase/types'

export default async function SalesPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const [{ data, count }, { canWrite, canEdit }, { data: profilesData }] = await Promise.all([
    supabase.from('Sales').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(0, 24),
    getTabWritePerms(role, 'sales'),
    supabase.from('profiles').select('full_name').eq('role', 'handlowiec').order('full_name'),
  ])

  const handlowcy = (profilesData ?? []).map(p => p.full_name).filter(Boolean) as string[]
  const currentSalesman = profile.full_name ?? ''

  return <SalesClient initialData={data ?? []} initialCount={count ?? 0} role={role} canWrite={canWrite} canEdit={canEdit} handlowcy={handlowcy} currentSalesman={currentSalesman} />
}
