import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { SalesDealsClient } from './_components/SalesDealsClient'
import type { Role } from '@/lib/supabase/types'

export default async function SalesDealsPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const { data, count } = await supabase
    .from('Sales Deals')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24)

  return <SalesDealsClient initialData={data ?? []} initialCount={count ?? 0} role={role} />
}
