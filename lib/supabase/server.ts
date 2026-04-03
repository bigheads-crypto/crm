// Klient Supabase po stronie serwera (Server Components, Route Handlers)
// WAŻNE: Nie importować w Client Components

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  // W Next.js 16 cookies() jest async
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Metoda set może być wywołana z Server Component — ignorujemy błąd
            // Middleware obsługuje odświeżanie sesji
          }
        },
      },
    }
  )
}
