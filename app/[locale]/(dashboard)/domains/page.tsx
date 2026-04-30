import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { DomainsClient } from './_components/DomainsClient'
import type { Role } from '@/lib/supabase/types'

export default async function DomainsPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const { data, count } = await supabase
    .from('domains')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24)

  return <DomainsClient initialData={data ?? []} initialCount={count ?? 0} role={role} />
}
