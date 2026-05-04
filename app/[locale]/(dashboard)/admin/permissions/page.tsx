import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/helpers'
import { PermissionsClient } from './_components/PermissionsClient'

export default async function AdminPermissionsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const { profile } = await requireAuth(locale)

  if (profile.role !== 'admin') {
    redirect(`/${locale}/dashboard`)
  }

  return <PermissionsClient />
}
