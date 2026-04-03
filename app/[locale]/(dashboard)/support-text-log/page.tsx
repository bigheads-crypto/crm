import { createClient } from '@/lib/supabase/server'
import { SupportTextLogClient } from './_components/SupportTextLogClient'
import type { Role } from '@/lib/supabase/types'

export default async function SupportTextLogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = (profile?.role ?? 'support') as Role

  const { data, count } = await supabase
    .from('SupportTextLog')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24)

  return <SupportTextLogClient initialData={data ?? []} initialCount={count ?? 0} role={role} />
}
