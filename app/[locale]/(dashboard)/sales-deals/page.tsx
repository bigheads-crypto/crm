import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { SalesDealsClient } from './_components/SalesDealsClient'
import { getTabWritePerms } from '@/lib/permissions'
import type { Role } from '@/lib/supabase/types'

export default async function SalesDealsPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const [{ data, count }, { canWrite, canEdit }] = await Promise.all([
    supabase.from('Sales Deals').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(0, 24),
    getTabWritePerms(role, 'sales-deals'),
  ])

  return <SalesDealsClient initialData={data ?? []} initialCount={count ?? 0} canWrite={canWrite} canEdit={canEdit} />
}
