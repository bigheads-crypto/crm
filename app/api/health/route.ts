import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkDatabaseHealth } from '@/lib/health'
import { NextResponse } from 'next/server'

// GET /api/health → raport stanu bazy (połączenie + każda wymagana tabela osobno).
//
// Bramka: WYŁĄCZNIE zalogowana sesja (auth.users), celowo NIE sprawdzamy roli z tabeli
// `profiles`. Dzięki temu diagnostyka działa nawet gdy `profiles` jest uszkodzone/brak —
// czyli dokładnie w scenariuszu, do którego health-check służy.
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })

  try {
    const admin = createAdminClient()
    const report = await checkDatabaseHealth(admin)
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Błąd serwera' }, { status: 500 })
  }
}
