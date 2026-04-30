import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { SupportTextLogClient } from './_components/SupportTextLogClient'
import type { Role } from '@/lib/supabase/types'

export default async function SupportTextLogPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const { data, count } = await supabase
    .from('Support Text Log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24)

  return <SupportTextLogClient initialData={data ?? []} initialCount={count ?? 0} role={role} />
}
