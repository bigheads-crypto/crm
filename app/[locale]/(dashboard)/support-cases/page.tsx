import { createClient } from '@/lib/supabase/server'
import { SupportCasesClient } from './_components/SupportCasesClient'
import type { Role } from '@/lib/supabase/types'

export default async function SupportCasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = (profile?.role ?? 'support') as Role

  const { data, count } = await supabase
    .from('SupportCase')
    .select('*', { count: 'exact' })
    .order('last_contact_at', { ascending: false })
    .range(0, 24)

  return <SupportCasesClient initialData={data ?? []} initialCount={count ?? 0} role={role} />
}
