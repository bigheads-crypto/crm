// Pomocnicze funkcje autoryzacyjne (tylko serwer)

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile, Role } from '@/lib/supabase/types'

// Pobiera aktualnego użytkownika lub null.
// `cache()` deduplikuje wywołania w obrębie JEDNEGO żądania (layout + page + reszta
// drzewa RSC współdzielą jeden round-trip do Supabase Auth zamiast 3 osobnych).
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

// Pobiera profil użytkownika z rolą. Również `cache()` — jedno zapytanie `profiles`
// na żądanie, niezależnie ile komponentów go potrzebuje.
export const getUserProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data as Profile | null
})

// Pobiera zalogowanego użytkownika i profil — redirect do login jeśli brak sesji
export async function requireAuth(locale: string = 'pl') {
  try {
    const user = await getCurrentUser()
    if (!user) {
      redirect(`/${locale}/login`)
    }
    const profile = await getUserProfile(user.id)
    if (!profile) {
      redirect(`/${locale}/login`)
    }
    return { user, profile }
  } catch (err: unknown) {
    // Next.js redirect() rzuca wewnętrznie — przepuszczamy dalej
    if (err && typeof err === 'object' && 'digest' in err) throw err
    // Supabase niedostępny — przekieruj z informacją
    redirect(`/${locale}/login?db=offline`)
  }
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
