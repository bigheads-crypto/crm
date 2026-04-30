import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { SupportLogClient } from './_components/SupportLogClient'
import type { Role } from '@/lib/supabase/types'

export default async function SupportLogPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const { data, count } = await supabase
    .from('Support Log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24)

  return <SupportLogClient initialData={data ?? []} initialCount={count ?? 0} role={role} />
}
