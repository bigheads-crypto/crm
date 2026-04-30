import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { SalesQualityClient } from './_components/SalesQualityClient'
import type { Role } from '@/lib/supabase/types'

export default async function SalesQualityPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const { data, count } = await supabase
    .from('Sales Quality')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24)

  return <SalesQualityClient initialData={data ?? []} initialCount={count ?? 0} role={role} />
}
