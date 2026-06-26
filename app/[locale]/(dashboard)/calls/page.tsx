import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { CallsClient } from './_components/CallsClient'
import { PAGE_SIZE } from '@/lib/constants'

export default async function CallsPage() {
  await requireAuth()
  const supabase = await createClient()

  const { data, count } = await supabase
    .from('calls')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, PAGE_SIZE - 1)

  return <CallsClient initialData={data ?? []} initialCount={count ?? 0} />
}
