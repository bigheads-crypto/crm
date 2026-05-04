import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/helpers'
import { ActivityLogClient } from './_components/ActivityLogClient'
import { createClient } from '@/lib/supabase/server'

export default async function ActivityLogPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const { profile } = await requireAuth(locale)

  if (!['admin', 'manager'].includes(profile.role)) {
    redirect(`/${locale}/dashboard`)
  }

  const supabase = await createClient()
  const { data, count } = await supabase
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24)

  return <ActivityLogClient initialData={data ?? []} initialCount={count ?? 0} />
}
