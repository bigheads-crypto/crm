import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/helpers'
import { InstructionsClient } from './_components/InstructionsClient'
import { getTabWritePerms } from '@/lib/permissions'
import { PAGE_SIZE } from '@/lib/constants'
import type { Role } from '@/lib/supabase/types'

export default async function InstructionsPage() {
  const { profile } = await requireAuth()
  const role = profile.role as Role
  const supabase = await createClient()

  const [{ data, count }, { data: folders }, { canWrite, canEdit }] = await Promise.all([
    supabase.from('Instructions').select('*', { count: 'exact' }).is('folder_id', null).order('created_at', { ascending: false }).range(0, PAGE_SIZE - 1),
    supabase.from('Instruction Folders').select('*').order('name'),
    getTabWritePerms(role, 'instructions'),
  ])

  return (
    <InstructionsClient
      initialData={data ?? []}
      initialCount={count ?? 0}
      initialFolders={folders ?? []}
      canWrite={canWrite}
      canEdit={canEdit}
    />
  )
}
