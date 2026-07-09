// Walidacja wymaganych zmiennych środowiskowych aplikacji.
//
// Używane przy starcie (layout locale) do pokazania czytelnego ekranu konfiguracji
// zamiast surowego crasha, gdy brakuje ustawień połączenia z bazą.
// Adres serwera bazy jest tu — zmiana serwera = zmiana NEXT_PUBLIC_SUPABASE_URL
// w konfiguracji + restart (bez ruszania kodu).

export interface EnvVar {
  /** Nazwa zmiennej, np. NEXT_PUBLIC_SUPABASE_URL */
  name: string
  /** Krótki opis: co to jest */
  description: string
  /** Przykładowa wartość */
  example: string
}

// Publiczne zmienne wymagane, by aplikacja w ogóle połączyła się z Supabase.
export const REQUIRED_PUBLIC_ENV: EnvVar[] = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    description: 'Adres serwera bazy Supabase (zmiana = przełączenie na inny serwer)',
    example: 'https://supabase.twojadomena.pl',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    description: 'Klucz publiczny (anon) projektu Supabase',
    example: 'eyJhbGciOiJIUzI1NiIs...',
  },
]

export interface EnvCheckResult {
  ok: boolean
  missing: EnvVar[]
}

/**
 * Sprawdza obecność wymaganych publicznych zmiennych.
 * Nie rzuca wyjątku — zwraca listę braków, żeby UI mogło pokazać czytelny ekran.
 */
export function checkPublicEnv(): EnvCheckResult {
  const missing = REQUIRED_PUBLIC_ENV.filter((v) => {
    const val = process.env[v.name]
    return !val || val.trim() === ''
  })
  return { ok: missing.length === 0, missing }
}
