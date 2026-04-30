import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { SalesTextLogClient } from './_components/SalesTextLogClient'
import type { Role } from '@/lib/supabase/types'

export default async function SalesTextLogPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const { data, count } = await supabase
    .from('Sales Text Log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24)

  return <SalesTextLogClient initialData={data ?? []} initialCount={count ?? 0} role={role} />
}
