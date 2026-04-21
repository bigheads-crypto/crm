import { createClient } from '@/lib/supabase/server'
import { DomainsClient } from './_components/DomainsClient'
import type { Role } from '@/lib/supabase/types'

export default async function DomainsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = (profile?.role ?? 'admin') as Role

  const { data, count } = await supabase
    .from('domains')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24)

  return <DomainsClient initialData={data ?? []} initialCount={count ?? 0} role={role} />
}
