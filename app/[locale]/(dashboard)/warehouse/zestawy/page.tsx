import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { SetsClient } from './_components/SetsClient'
import { getTabWritePerms } from '@/lib/permissions'
import type { Role } from '@/lib/supabase/types'

export default async function ZestawyPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const [{ data, count }, { canWrite, canEdit }] = await Promise.all([
    supabase.from('Zestawy').select('*', { count: 'exact' }).order('nr').range(0, 49),
    getTabWritePerms(role, 'warehouse-zestawy'),
  ])

  return (
    <SetsClient
      initialData={data ?? []}
      initialCount={count ?? 0}
      role={role}
      canWrite={canWrite}
      canEdit={canEdit}
    />
  )
}
