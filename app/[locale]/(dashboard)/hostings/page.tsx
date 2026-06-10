import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { HostingsClient } from './_components/HostingsClient'
import { getTabWritePerms } from '@/lib/permissions'
import type { Role } from '@/lib/supabase/types'

export default async function HostingsPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const [{ data, count }, { canWrite, canEdit }] = await Promise.all([
    supabase.from('hostings').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(0, 24),
    getTabWritePerms(role, 'hostings'),
  ])

  return <HostingsClient initialData={data ?? []} initialCount={count ?? 0} canWrite={canWrite} canEdit={canEdit} />
}
