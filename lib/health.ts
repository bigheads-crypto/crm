import type { SupabaseClient } from '@supabase/supabase-js'

// Tabele wymagane przez AKTYWNE moduły aplikacji. Sprawdzane pojedynczo (Ad.1):
// problem z jedną tabelą nie ukrywa stanu pozostałych.
// Tabele usuniętych modułów (Sales Quality, Sales Text Log, Support Case, Support Log,
// Support Text Log) są celowo pominięte — frontend ich nie używa.
export const REQUIRED_TABLES: string[] = [
  // rdzeń / uprawnienia
  'profiles', 'tab_permissions', 'activity_logs',
  // sprzedaż / klienci / rozmowy
  'Clients', 'Sales', 'Sales Items', 'Sales Deals', 'calls',
  // support
  'Support Backlog', 'Support Backlog Log',
  // pozostałe moduły
  'OLX', 'Machines', 'Machine Issues', 'Opinie', 'domains', 'hostings',
  // magazyn
  'Products', 'Zestawy', 'Wiazki', 'Hardware', 'Software',
  // grafik pracy
  'schedule_entries', 'shift_types', 'availability', 'shift_swaps',
]

export interface TableHealth {
  table: string
  ok: boolean
  count: number | null
  error: string | null
}

export interface HealthReport {
  connectionOk: boolean
  connectionError: string | null
  tables: TableHealth[]
  missingCount: number
  adminExists: boolean
  checkedAt: string
}

// Wykrywa błędy sieciowe (brak połączenia z serwerem bazy) — inne niż brak tabeli.
function isConnectionError(message: string): boolean {
  return /fetch failed|ECONNREFUSED|ENOTFOUND|network|timeout|getaddrinfo/i.test(message)
}

// Sprawdza połączenie i każdą wymaganą tabelę osobno. `client` to service_role
// (omija RLS → widzi realny stan i liczby rekordów).
export async function checkDatabaseHealth(client: SupabaseClient): Promise<HealthReport> {
  const tables: TableHealth[] = []
  let connectionOk = true
  let connectionError: string | null = null

  for (const table of REQUIRED_TABLES) {
    // head:true → bez pobierania wierszy, tylko licznik. Brak tabeli → błąd 42P01.
    const { count, error } = await client
      .from(table)
      .select('*', { head: true, count: 'exact' })

    if (error) {
      tables.push({ table, ok: false, count: null, error: error.message })
      if (isConnectionError(error.message)) {
        connectionOk = false
        connectionError = error.message
      }
    } else {
      tables.push({ table, ok: true, count: count ?? 0, error: null })
    }
  }

  // Czy istnieje choć jeden admin (Ad.4: pierwszy admin musi istnieć).
  let adminExists = false
  const { count: adminCount, error: adminErr } = await client
    .from('profiles')
    .select('*', { head: true, count: 'exact' })
    .eq('role', 'admin')
  if (!adminErr) adminExists = (adminCount ?? 0) > 0

  return {
    connectionOk,
    connectionError,
    tables,
    missingCount: tables.filter((t) => !t.ok).length,
    adminExists,
    checkedAt: new Date().toISOString(),
  }
}
