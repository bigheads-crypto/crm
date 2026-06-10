import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { SupportCasesClient } from './_components/SupportCasesClient'
import { getTabWritePerms } from '@/lib/permissions'
import type { Role } from '@/lib/supabase/types'

export default async function SupportCasesPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const [{ data, count }, { canWrite, canEdit }] = await Promise.all([
    supabase.from('Support Case').select('*', { count: 'exact' }).order('last_contact_at', { ascending: false }).range(0, 24),
    getTabWritePerms(role, 'support-cases'),
  ])

  return <SupportCasesClient initialData={data ?? []} initialCount={count ?? 0} canWrite={canWrite} canEdit={canEdit} />
}
