import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { MachineIssuesClient } from './_components/MachineIssuesClient'
import { getTabWritePerms } from '@/lib/permissions'
import type { Role } from '@/lib/supabase/types'

export default async function MachineIssuesPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const [{ data, count }, { canWrite, canEdit }] = await Promise.all([
    supabase.from('Machine Issues').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(0, 24),
    getTabWritePerms(role, 'machine-issues'),
  ])

  return <MachineIssuesClient initialData={data ?? []} initialCount={count ?? 0} canWrite={canWrite} canEdit={canEdit} />
}
