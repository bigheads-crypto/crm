import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { WarehouseClient } from './_components/WarehouseClient'
import { getTabWritePerms } from '@/lib/permissions'
import type { Role } from '@/lib/supabase/types'

export default async function WarehousePage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const [{ data, count }, { canWrite, canEdit }] = await Promise.all([
    supabase.from('Products').select('*', { count: 'exact' }).order('category').order('name').range(0, 49),
    getTabWritePerms(role, 'warehouse'),
  ])

  return <WarehouseClient initialData={data ?? []} initialCount={count ?? 0} canWrite={canWrite} canEdit={canEdit} />
}
