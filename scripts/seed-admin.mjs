// =============================================================================
// Seed pierwszego administratora — uruchamiany LOKALNIE / na serwerze, NIE przez web.
// Kolejnych użytkowników dodaje się już przez panel: Admin → Użytkownicy.
//
// Wymaga service_role (SUPABASE_SERVICE_ROLE_KEY) — dlatego świadomie NIE jest to
// funkcja webowa: klucz service_role omija RLS i nie może trafić do przeglądarki.
//
// Uruchomienie:
//   node scripts/seed-admin.mjs [email] [hasło] [imię i nazwisko]
//   npm run seed:admin -- admin@firma.pl TajneHaslo123 "Jan Kowalski"
//
// Bez argumentów skrypt zapyta interaktywnie. Konfigurację (URL + service_role)
// czyta z .env.local automatycznie.
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Wczytanie .env.local (jeśli zmienne nie są już w środowisku) ──
function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}
loadEnvFile(join(__dirname, '..', '.env.local'))

function fail(msg) {
  console.error(`\n❌ ${msg}\n`)
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url) fail('Brak NEXT_PUBLIC_SUPABASE_URL (sprawdź .env.local).')
if (!serviceKey) fail('Brak SUPABASE_SERVICE_ROLE_KEY (sprawdź .env.local).')

// ── Dane wejściowe: argumenty → zmienne env → pytanie interaktywne ──
const args = process.argv.slice(2)
let email = args[0] || process.env.ADMIN_EMAIL
let password = args[1] || process.env.ADMIN_PASSWORD
let fullName = args[2] || process.env.ADMIN_NAME || null

if (!email || !password) {
  const rl = createInterface({ input: stdin, output: stdout })
  try {
    if (!email) email = (await rl.question('Email administratora: ')).trim()
    if (!password) password = (await rl.question('Hasło (min. 6 znaków): ')).trim()
    if (fullName == null) {
      const n = (await rl.question('Imię i nazwisko (opcjonalnie): ')).trim()
      fullName = n || null
    }
  } finally {
    rl.close()
  }
}

// ── Walidacja ──
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`Nieprawidłowy email: ${email ?? '(brak)'}`)
if (!password || password.length < 6) fail('Hasło musi mieć min. 6 znaków.')

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Ostrzeżenie, jeśli admin już istnieje (Sławek: auto-tworzenie admina to ryzyko) ──
const { count: adminCount, error: countErr } = await supabase
  .from('profiles').select('*', { head: true, count: 'exact' }).eq('role', 'admin')
if (countErr) fail(`Odczyt profiles: ${countErr.message} (czy baza ma schemat? uruchom baseline)`)
if ((adminCount ?? 0) > 0) {
  console.warn(`\n⚠️  W bazie istnieje już ${adminCount} konto(a) z rolą admin. Kontynuuję.\n`)
}

// ── Czy user o tym emailu już istnieje w Auth? → promocja zamiast tworzenia ──
async function findAuthUserByEmail(targetEmail) {
  const needle = targetEmail.toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((u) => u.email?.toLowerCase() === needle)
    if (found) return found
    if (data.users.length < 200) break
  }
  return null
}

let userId
const existing = await findAuthUserByEmail(email)
if (existing) {
  console.log(`ℹ️  Użytkownik ${email} już istnieje w Auth — promuję na admina.`)
  userId = existing.id
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error) fail(`Tworzenie konta Auth: ${error.message}`)
  userId = data.user.id
  console.log(`✅ Utworzono konto Auth: ${email}`)
}

// ── Profil z rolą admin (upsert — działa dla nowego i dla promocji) ──
const { error: profileError } = await supabase
  .from('profiles')
  .upsert({ id: userId, role: 'admin', full_name: fullName }, { onConflict: 'id' })
if (profileError) fail(`Zapis profilu: ${profileError.message}`)

console.log(`\n✅ Gotowe. Administrator: ${email}`)
console.log('   Zaloguj się przez panel web i dodawaj kolejnych userów w Admin → Użytkownicy.\n')
process.exit(0)
