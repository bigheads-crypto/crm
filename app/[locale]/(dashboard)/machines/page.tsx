import { createClient } from '@/lib/supabase/server'
import { MachinesClient } from './_components/MachinesClient'
import type { Role } from '@/lib/supabase/types'

export default async function MachinesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = (profile?.role ?? 'handlowiec') as Role

  const { data, count } = await supabase
    .from('Machines')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24)

  return <MachinesClient initialData={data ?? []} initialCount={count ?? 0} role={role} />
}
