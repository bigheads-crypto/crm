import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { ReviewsClient } from './_components/ReviewsClient'
import { getTabWritePerms } from '@/lib/permissions'
import type { Role } from '@/lib/supabase/types'

export default async function ReviewsPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const [{ data, count }, { canWrite, canEdit }] = await Promise.all([
    supabase.from('Opinie').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(0, 24),
    getTabWritePerms(role, 'reviews'),
  ])

  return (
    <ReviewsClient
      initialData={data ?? []}
      initialCount={count ?? 0}
      userName={profile.full_name ?? ''}
      canWrite={canWrite}
      canEdit={canEdit}
    />
  )
}
