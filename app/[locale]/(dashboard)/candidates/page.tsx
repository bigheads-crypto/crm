import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { CandidatesClient } from './_components/CandidatesClient'
import { getTabWritePerms } from '@/lib/permissions'
import type { Role } from '@/lib/supabase/types'

export default async function CandidatesPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const [{ data, count }, { canWrite, canEdit }] = await Promise.all([
    supabase.from('OLX').select('*', { count: 'exact' }).order('id', { ascending: false }).range(0, 24),
    getTabWritePerms(role, 'candidates'),
  ])

  return <CandidatesClient initialData={data ?? []} initialCount={count ?? 0} role={role} canWrite={canWrite} canEdit={canEdit} />
}
