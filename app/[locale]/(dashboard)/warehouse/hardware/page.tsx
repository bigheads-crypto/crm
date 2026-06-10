import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { getTabWritePerms } from '@/lib/permissions'
import { HardwareClient } from './_components/HardwareClient'
import type { Role } from '@/lib/supabase/types'

export default async function HardwarePage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const [{ data, count }, { canWrite, canEdit }] = await Promise.all([
    supabase.from('Hardware').select('*', { count: 'exact' }).order('component_type').order('name').range(0, 49),
    getTabWritePerms(role, 'warehouse-hardware'),
  ])

  return <HardwareClient initialData={data ?? []} initialCount={count ?? 0} canWrite={canWrite} canEdit={canEdit} />
}
