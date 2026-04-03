import { createClient } from '@/lib/supabase/server'
import { SupportLogClient } from './_components/SupportLogClient'
import type { Role } from '@/lib/supabase/types'

export default async function SupportLogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = (profile?.role ?? 'support') as Role

  const { data, count } = await supabase
    .from('Support Log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24)

  return <SupportLogClient initialData={data ?? []} initialCount={count ?? 0} role={role} />
}
