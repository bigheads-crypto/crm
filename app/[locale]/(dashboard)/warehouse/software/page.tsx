import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { getTabWritePerms } from '@/lib/permissions'
import { SoftwareClient } from './_components/SoftwareClient'
import type { Role } from '@/lib/supabase/types'

export default async function SoftwarePage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const [{ data, count }, { canWrite, canEdit }] = await Promise.all([
    supabase.from('Software').select('*', { count: 'exact' }).order('product_line').order('name').range(0, 49),
    getTabWritePerms(role, 'warehouse-software'),
  ])

  return <SoftwareClient initialData={data ?? []} initialCount={count ?? 0} canWrite={canWrite} canEdit={canEdit} />
}
