import { createClient } from '@/lib/supabase/server'
import { SalesTextLogClient } from './_components/SalesTextLogClient'
import type { Role } from '@/lib/supabase/types'

export default async function SalesTextLogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = (profile?.role ?? 'handlowiec') as Role

  const { data, count } = await supabase
    .from('SalesTextLog')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24)

  return <SalesTextLogClient initialData={data ?? []} initialCount={count ?? 0} role={role} />
}
