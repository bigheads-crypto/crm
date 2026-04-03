import { createClient } from '@/lib/supabase/server'
import { CandidatesClient } from './_components/CandidatesClient'
import type { Role } from '@/lib/supabase/types'

export default async function CandidatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = (profile?.role ?? 'hr') as Role

  const { data, count } = await supabase
    .from('OLX')
    .select('*', { count: 'exact' })
    .order('id', { ascending: false })
    .range(0, 24)

  return <CandidatesClient initialData={data ?? []} initialCount={count ?? 0} role={role} />
}
