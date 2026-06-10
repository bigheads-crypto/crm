import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { WiazkiClient } from './_components/WiazkiClient'
import { getTabWritePerms } from '@/lib/permissions'
import type { Role } from '@/lib/supabase/types'

export default async function WiazkiPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const [{ data, count }, { canWrite, canEdit }] = await Promise.all([
    supabase.from('Wiazki').select('*', { count: 'exact' }).order('product_line').order('emulator').range(0, 49),
    getTabWritePerms(role, 'warehouse-wiazki'),
  ])

  return (
    <WiazkiClient
      initialData={data ?? []}
      initialCount={count ?? 0}
      canWrite={canWrite}
      canEdit={canEdit}
    />
  )
}
