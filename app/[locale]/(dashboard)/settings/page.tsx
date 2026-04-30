import { requireAuth } from '@/lib/auth/helpers'
import { SettingsClient } from './_components/SettingsClient'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const { user, profile } = await requireAuth(locale)

  return (
    <SettingsClient
      userEmail={user.email ?? ''}
      fullName={profile.full_name ?? ''}
      role={profile.role ?? ''}
    />
  )
}
