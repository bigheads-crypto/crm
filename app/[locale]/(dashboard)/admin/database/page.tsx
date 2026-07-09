import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/helpers'
import { DatabaseClient } from './_components/DatabaseClient'

export default async function AdminDatabasePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const { profile } = await requireAuth(locale)

  if (profile.role !== 'admin') {
    redirect(`/${locale}/dashboard`)
  }

  return <DatabaseClient />
}
