import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { SalesQualityClient } from './_components/SalesQualityClient'
import { getTabWritePerms } from '@/lib/permissions'
import type { Role } from '@/lib/supabase/types'

export default async function SalesQualityPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const [{ data, count }, { canWrite, canEdit }] = await Promise.all([
    supabase.from('Sales Quality').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(0, 24),
    getTabWritePerms(role, 'sales-quality'),
  ])

  return <SalesQualityClient initialData={data ?? []} initialCount={count ?? 0} role={role} canWrite={canWrite} canEdit={canEdit} />
}
