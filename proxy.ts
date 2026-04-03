// Proxy (dawniej middleware) dla Next.js 16
// Obsługuje: odświeżanie sesji Supabase + routing locale (next-intl) + ochrona tras

import { createServerClient } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import type { Role } from '@/lib/supabase/types'

// Obsługiwane locale
const locales = ['pl', 'en']
const defaultLocale = 'pl'

// Middleware next-intl obsługuje routing locale
const handleI18nRouting = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

// Pomocnik — zwraca ścieżkę przekierowania po zalogowaniu
function getRedirectPath(role: Role, locale: string): string {
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

export async function proxy(request: NextRequest) {
  // Uruchom routing locale przez next-intl
  const i18nResponse = handleI18nRouting(request)

  // Utwórz response do modyfikacji — jeśli next-intl zwrócił redirect, użyj go jako bazę
  let response = i18nResponse || NextResponse.next({ request })

  // Utwórz Supabase client w proxy z cookie handlerami
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Ustaw cookies w request i response
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Odśwież sesję (to jest niezbędne dla @supabase/ssr)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Wykryj aktualny locale z URL
  const pathnameLocale = locales.find(
    (loc) => pathname.startsWith(`/${loc}/`) || pathname === `/${loc}`
  ) ?? defaultLocale

  // Ścieżki publiczne (dostępne bez logowania)
  const isLoginPage = pathname.includes('/login')

  if (!user && !isLoginPage) {
    // Brak sesji i to nie jest strona logowania — redirect do login
    const loginUrl = new URL(`/${pathnameLocale}/login`, request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (user && isLoginPage) {
    // Zalogowany użytkownik próbuje wejść na /login — redirect do właściwej strony
    // Pobierz profil aby sprawdzić rolę
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (profile?.role ?? 'handlowiec') as Role
    const redirectPath = getRedirectPath(role, pathnameLocale)
    return NextResponse.redirect(new URL(redirectPath, request.url))
  }

  return response
}

export const config = {
  matcher: [
    // Dopasuj wszystkie ścieżki oprócz plików statycznych Next.js
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
