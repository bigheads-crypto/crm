// Pomocnicze funkcje autoryzacyjne (tylko serwer)

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile, Role } from '@/lib/supabase/types'

// Pobiera aktualnego użytkownika lub null
export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Pobiera profil użytkownika z rolą
export async function getUserProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data as Profile | null
}

// Pobiera zalogowanego użytkownika i profil — redirect do login jeśli brak sesji
export async function requireAuth(locale: string = 'pl') {
  const user = await getCurrentUser()
  if (!user) {
    redirect(`/${locale}/login`)
  }
  const profile = await getUserProfile(user.id)
  if (!profile) {
    redirect(`/${locale}/login`)
  }
  return { user, profile }
}

// Ścieżka przekierowania po zalogowaniu zależna od roli
export function getRedirectPath(role: Role, locale: string = 'pl'): string {
  switch (role) {
    case 'admin':
    case 'manager':
      return `/${locale}/dashboard`
    case 'handlowiec':
      return `/${locale}/sales-deals`
    case 'support':
      return `/${locale}/support-cases`
    case 'hr':
      return `/${locale}/candidates`
    case 'logistyka':
      return `/${locale}/sales`
    default:
      return `/${locale}/dashboard`
  }
}
