import { createClient } from '@supabase/supabase-js'

// Klient service_role — omija RLS. WYŁĄCZNIE po stronie serwera (trasy /api/admin/*,
// /api/health). Nigdy nie importować w Client Components.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY nie jest ustawiony')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}
