import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { SupportBacklogClient } from './_components/SupportBacklogClient'
import type { Role } from '@/lib/supabase/types'

export default async function SupportBacklogPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const { data, count } = await supabase
    .from('Support Backlog')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(0, 24)

  return <SupportBacklogClient initialData={data ?? []} initialCount={count ?? 0} role={role} />
}
