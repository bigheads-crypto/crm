import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { MachinesClient } from './_components/MachinesClient'
import type { Role } from '@/lib/supabase/types'

export default async function MachinesPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const { data, count } = await supabase
    .from('Machines')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24)

  return <MachinesClient initialData={data ?? []} initialCount={count ?? 0} role={role} />
}
