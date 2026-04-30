import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/helpers'
import { AdminUsersClient } from './_components/AdminUsersClient'

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const { profile } = await requireAuth(locale)

  if (profile.role !== 'admin') {
    redirect(`/${locale}/dashboard`)
  }

  return <AdminUsersClient />
}
