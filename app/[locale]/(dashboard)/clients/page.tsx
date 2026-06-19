import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { ClientsClient } from './_components/ClientsClient'
import { getTabWritePerms } from '@/lib/permissions'
import type { Role } from '@/lib/supabase/types'
import { PAGE_SIZE } from '@/lib/constants'

export default async function ClientsPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const [{ data, count }, { canWrite, canEdit }] = await Promise.all([
    supabase
      .from('Clients')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1),
    getTabWritePerms(role, 'clients'),
  ])

  return (
    <ClientsClient
      initialData={data ?? []}
      initialCount={count ?? 0}
      role={role}
      canWrite={canWrite}
      canEdit={canEdit}
    />
  )
}
