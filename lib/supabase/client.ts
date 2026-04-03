// Klient Supabase po stronie przeglądarki (Client Components)
// WAŻNE: Nie importować w Server Components ani Route Handlers

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
