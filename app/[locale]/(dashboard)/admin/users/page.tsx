import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminUsersClient } from './_components/AdminUsersClient'

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  // Tylko admin ma dostęp do tej strony
  if (profile?.role !== 'admin') {
    redirect(`/${locale}/dashboard`)
  }

  return <AdminUsersClient />
}
