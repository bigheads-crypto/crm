# Sugerowane zmiany — przegląd kodu CRM 4DPF

Dokument powstał z dogłębnego przeglądu całego repo (stan: 2026‑04‑28, branch `main`). Pogrupowane według **priorytetu** i **kategorii**. Każda pozycja zawiera plik, linijkę (lub fragment) i konkretną propozycję poprawki.

---

## 🔴 KRYTYCZNE — naprawić od razu

### 1. Crash na wygasłej sesji — `user!.id` w 14 stronach

**Problem.** Każda strona dashboardowa pobiera profil zalogowanego użytkownika według wzorca:

```ts
const { data: { user } } = await supabase.auth.getUser()
const { data: profile } = await supabase.from('profiles')
  .select('role').eq('id', user!.id).single()
```

`user!` to *non‑null assertion* — gdy `getUser()` zwróci `null` (wygaśnięta sesja, brak cookies, użytkownik wylogowany w innej karcie), runtime rzuci `TypeError: Cannot read properties of null` zamiast przekierować na `/login`. Sytuacja występuje w produkcji w czasie idle.

**Pliki objęte (14):**
- `app/[locale]/(dashboard)/dashboard/page.tsx`
- `app/[locale]/(dashboard)/candidates/page.tsx`
- `app/[locale]/(dashboard)/machines/page.tsx`
- `app/[locale]/(dashboard)/sales/page.tsx`
- `app/[locale]/(dashboard)/sales-deals/page.tsx`
- `app/[locale]/(dashboard)/sales-quality/page.tsx`
- `app/[locale]/(dashboard)/sales-text-log/page.tsx`
- `app/[locale]/(dashboard)/support-cases/page.tsx`
- `app/[locale]/(dashboard)/support-log/page.tsx`
- `app/[locale]/(dashboard)/support-text-log/page.tsx`
- `app/[locale]/(dashboard)/admin/users/page.tsx`
- `app/[locale]/(dashboard)/domains/page.tsx`
- `app/[locale]/(dashboard)/hostings/page.tsx`
- `app/[locale]/(dashboard)/settings/page.tsx`

**Rozwiązanie.** W `lib/auth/helpers.ts` istnie

```ts
// PRZED
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect(`/${locale}/login`)
const { data: profile } = await supabase.from('profiles')
  .select('role').eq('id', user!.id).single()

// PO
import { requireAuth } from '@/lib/auth/helpers'
const { user, profile } = await requireAuth(locale)
```

Skraca 5 linijek do 1, usuwa non‑null assert i centralizuje logikę auth.

---

### 2. Filtr `equals` używa `ilike` (semantyczny błąd)

**Plik:** `lib/supabase/filters.ts`

```ts
case 'equals':
  if (v) query = query.ilike(key, v)        // ⚠ powinno być .eq()
  break
case 'not_equals':
  if (v) query = query.not(key, 'ilike', v) // ⚠ powinno być .neq()
  break
```

`ilike` bez `%` traktuje wzorzec jako case‑insensitive match całego stringa, **ale** Postgres traktuje `_` jako wildcard pojedynczego znaku, więc `equals="abc_de"` znajdzie też `abcXde`. Dla pól statusu/ID/enuma to bug.

**Fix.** Użyć `.eq()` / `.neq()` (case‑sensitive porównanie egzaktne):

```ts
case 'equals':       if (v) query = query.eq(key, v); break
case 'not_equals':   if (v) query = query.neq(key, v); break
```

---

### 4. API `/api/admin/users` — luki bezpieczeństwa

**Plik:** `app/api/admin/users/route.ts`

Zidentyfikowane problemy:

1. **Brak walidacji wejścia** — POST przyjmuje dowolny JSON i wprost przekazuje do Supabase. Powinien być zod schema:
   ```ts
   const Body = z.object({
     action: z.enum(['create','update_role','delete']),
     userId: z.string().uuid().optional(),
     email: z.string().email().optional(),
     role: z.enum(['admin','manager','handlowiec','support','hr','logistyka']).optional(),
     full_name: z.string().max(120).optional(),
     password: z.string().min(8).optional(),
   })
   const body = Body.parse(await req.json())
   ```

2. **Mass assignment w `update_role`** — operacja „zmień tylko rolę" zawsze nadpisuje `full_name`, nawet gdy klient nie wysłał tego pola (zamienia na `undefined`). Rozdzielić na dwie kolumny update lub używać `.update({ role }).eq('id', userId)`.

3. **Race condition w `create`** — `auth.admin.createUser` + `profiles.insert` to dwa kroki bez transakcji. Jeśli pierwszy się powiedzie, a drugi padnie, mamy „zombie" użytkownika w `auth` bez profilu, który nie może się zalogować i nie pojawia się na liście. Rollback: w bloku `catch` po nieudanym insert wołać `auth.admin.deleteUser(newUser.id)`.

4. **Wyciek treści błędów** — `catch (err) { return NextResponse.json({ error: err.message }) }` zwraca surowe komunikaty Postgres/Supabase do klienta (linia ~98). W PROD ujawnia strukturę bazy. Logować pełen błąd po stronie serwera, a klientowi zwracać generic message.

5. **Brak rate limit / audit log** — endpoint admin tworzy użytkowników z dowolnym hasłem; co najmniej rejestrować w tabeli `audit_log` (kto, kogo, kiedy, jaka akcja).

---

### 5. Brak obsługi błędów we wszystkich CRUD‑ach

Grep `await.*\.(insert|update|delete)` znajduje **16 wywołań** w `*Client.tsx` bez sprawdzenia `{ error }`. Przykład — `SalesDealsClient.tsx`:

```tsx
await supabase.from('Sales Deals').insert({...})
setModalOpen(false)
fetchData()
```

Jeśli RLS odrzuci insert, użytkownik widzi „sukces" mimo że nic nie zostało zapisane.

**Fix (wzorzec).** Wprowadzić mały helper `lib/supabase/mutations.ts`:

```ts
export async function runMutation<T>(p: PromiseLike<{ data: T; error: PostgrestError | null }>) {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data
}
```

i w komponentach:

```tsx
try {
  await runMutation(supabase.from('Sales Deals').insert({...}))
  toast.success('Zapisano')
  fetchData()
} catch (e) {
  toast.error((e as Error).message)
}
```

(toast nie istnieje w projekcie — patrz pkt 14 — minimum to `setError(...)` w stanie i wyświetlenie nad formularzem.)

---

## 🟠 WYSOKI — istotne błędy / niezgodność z CLAUDE.md

### 6. Złamane reguły kolorystyki z CLAUDE.md

CLAUDE.md (sekcja „Paleta kolorów") **wprost** zakazuje hardkodowania `#4f6ef7`, `#3d5ce0`, `rgba(79,110,247,...)` (stary niebieski) oraz `#ef7f1a` (zły wariant pomarańczu — poprawny to `#e07818`).

**Naruszenia stanu na 2026‑04‑28:**

| Plik | Linia | Wartość |
|---|---|---|
| `app/[locale]/(dashboard)/dashboard/page.tsx` | 296 | `'rgba(79, 110, 247, 0.15)'` |
| `app/[locale]/(dashboard)/dashboard/_components/DashboardCharts.tsx` | 109 | `cursor={{ fill: 'rgba(79, 110, 247, 0.08)' }}` |
| `app/[locale]/(dashboard)/admin/users/_components/AdminUsersClient.tsx` | 33 | `handlowiec: '#ef7f1a'` |
| `app/[locale]/(dashboard)/sales/_components/SalesClient.tsx` | 32 | `new: '#ef7f1a'` |
| `app/[locale]/(dashboard)/sales-deals/_components/SalesDealsClient.tsx` | 32 | `in_progress: '#ef7f1a'` |
| `app/[locale]/(dashboard)/support-cases/_components/SupportCasesClient.tsx` | 31 | `in_progress: '#ef7f1a'` |
| `app/[locale]/(dashboard)/sales-text-log/_components/SalesTextLogClient.tsx` | (badge OUT) | `#ef7f1a` |
| `app/[locale]/(dashboard)/support-text-log/_components/SupportTextLogClient.tsx` | (badge OUT) | `#ef7f1a` |

**Fix.** Zamienić globalnie `#ef7f1a` → `#e07818` oraz oba `rgba(79, 110, 247, ...)` na `var(--accent)` z odpowiednią `rgba` formą `rgba(224,120,24, ...)`.

---

### 7. Hydration mismatch w `SettingsClient` po dodaniu motywów

**Plik:** `app/[locale]/(dashboard)/settings/_components/SettingsClient.tsx:25-28`

```tsx
const [activeTheme, setActiveTheme] = useState<ThemeKey>(() => {
  if (typeof window === 'undefined') return 'orange'
  return (localStorage.getItem(THEME_STORAGE_KEY) as ThemeKey) || 'orange'
})
```

Server renderuje `'orange'`, klient odczytuje localStorage — przy zapisanym innym motywie React wyrzuca hydration warning i przerysuwuje cały panel. Dodatkowo `useState` lazy init z `typeof window` to anty‑pattern w RSC.

**Fix.** Jednolity start na `'orange'` + `useEffect` do hydratacji:

```tsx
const [activeTheme, setActiveTheme] = useState<ThemeKey>('orange')
useEffect(() => {
  const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeKey | null
  if (saved && THEMES[saved]) setActiveTheme(saved)
}, [])
```

Najlepszym rozwiązaniem jest jednak **lift‑up** stanu motywu do `ThemeProvider` (już jest jako `'use client'`) i udostępnienie go przez Context, żeby `SettingsClient` nie czytał localStorage bezpośrednio.

> Uwaga: ten punkt może być ŹRÓDŁEM zgłoszonego ostatnio błędu 404 (jeśli był to tak naprawdę błąd hydratacji powodujący crash całej trasy w trybie produkcyjnym). Po wdrożeniu fix-u przebuduj `.next/`.

---

### 8. `proxy.ts` zamiast `middleware.ts`

**Plik:** `proxy.ts` w roocie + zapis w CLAUDE.md „Plik `proxy.ts` (nie `middleware.ts`) pełni rolę middleware".

Standardowy Next.js (również 16) używa `middleware.ts` z eksportem `middleware`. Konwencja `proxy.ts` nie figuruje w `node_modules/next/dist/docs/`. Jeśli faktycznie zadziałała, możliwe że tylko przez przypadek (Next.js 16 wprowadza eksperymentalny Proxy z `proxy.ts`, ale to nie jest tożsame z middleware) — strony są chronione **dopiero na poziomie page.tsx** (przez `getUser()`).

**Działanie do weryfikacji.** Sprawdzić w trybie prod:

```bash
npm run build && npm start
```

i wejść jako anonim na `/pl/dashboard`. Jeśli przepuszcza do RSC (a nie redirectuje na `/login`), to znaczy że proxy nie działa i każda strona musi się sama bronić — co dziś robi kruchy `user!.id`.

**Fix (jeśli proxy.ts nie działa).** Przemianować na `middleware.ts`, eksport `export function middleware` + `export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] }`. CLAUDE.md zaktualizować.

---

### 9. Wyliczanie tygodnia — `getWeekLabel` nie ISO‑8601

**Plik:** `app/[locale]/(dashboard)/dashboard/page.tsx:17`

Custom liczenie tygodnia daje inne wyniki niż ISO 8601 (Polska standard). Dla statystyk per‑tydzień to wprowadza błędy graniczne (poniedziałki na styku roku trafiają do złego tygodnia).

**Fix.** Użyć `date-fns`:

```ts
import { getISOWeek, getISOWeekYear } from 'date-fns'
const label = `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2,'0')}`
```

(Przed dodaniem zależności sprawdź czy `date-fns` już jest w `package.json`.)

---

### 10. Komentarz vs zapytanie — „Kandydaci OLX w tym miesiącu"

**Plik:** `app/[locale]/(dashboard)/dashboard/page.tsx:132-134`

Komentarz mówi „w tym miesiącu", ale zapytanie nie ma żadnego filtra po dacie — pokazuje **wszystkich** kandydatów od początku świata. KPI na dashboardzie pokazuje błędną liczbę.

**Fix.**

```ts
const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0)
const { count } = await supabase
  .from('OLX').select('*', { count: 'exact', head: true })
  .gte('id', /* lub created_at jeśli istnieje */ ...)
```

> Pamiętać: wg CLAUDE.md tabela `OLX` **nie ma** `created_at`. Trzeba albo dodać kolumnę, albo zmienić KPI.

---

### 11. N+1 / brak `.limit()` przy budowie filterOptions

**Pliki:** każdy `*Client.tsx`, który ładuje dynamiczne `filterOptions` (Sales, SalesDeals, SalesQuality, SupportCases, SupportLog).

```ts
supabase.from('Sales Deals').select('salesman').not('salesman', 'is', null)
```

To pobiera **wszystkie wiersze tabeli** żeby z nich wyciągnąć unikalne wartości. Przy 50k wierszy = każde wejście na stronę pobiera 50k×kolumn JSON. W przeglądarce zauważalne lagi i transfer.

**Fix.** Stworzyć w bazie widoki `materialized` lub funkcje:

```sql
create or replace function distinct_salesman_sales_deals()
returns table(v text) language sql stable as $$
  select distinct salesman from "Sales Deals" where salesman is not null order by 1
$$;
```

i wołać przez `supabase.rpc('distinct_salesman_sales_deals')`. Zwraca tylko ~30 stringów zamiast 50k rekordów. Alternatywnie cache po stronie serwera (Server Component przekazuje `initialFilterOptions` jako prop), bez round‑tripu z klienta.

---

### 12. Hardkodowane polskie stringi mimo i18n

`next-intl` jest skonfigurowany (`localePrefix: 'always'`), ale 90% UI ma stringi po polsku w kodzie. Przykłady:

- `roleLabels` w `SettingsClient.tsx:64-71`
- `formatRelative()` w `dashboard/page.tsx` zwraca tylko polskie stringi
- Komunikaty walidacji: `'Wymagane'`, `'Hasło musi mieć co najmniej 6 znaków.'`
- Etykiety przycisków: `'Zapisywanie…'`, `'Zmień hasło'`, `'Anuluj'`

**Fix.** Albo systematycznie przenieść do `messages/pl.json` + `messages/en.json` i używać `useTranslations()`, albo **świadomie** zrezygnować z i18n (usunąć `next-intl`, uprościć router) — obecny stan to najgorszy z dwóch światów.

---

## 🟡 ŚREDNI — code quality / wydajność

### 13. Powielony kod między `domains` i `hostings`

**Pliki:**
- `app/[locale]/(dashboard)/domains/_components/DomainsClient.tsx`
- `app/[locale]/(dashboard)/hostings/_components/HostingsClient.tsx`

Funkcje `getDiffDays`, `DueDateBadge`, `DaysLeftBadge`, oraz lokalny `FormField` są **kopiowane verbatim**. To 4 funkcje ×2 pliki = 8 kopii.

**Fix.** Wyciągnąć do `components/shared/`:
- `components/shared/DueDateBadge.tsx`
- `components/shared/DaysLeftBadge.tsx`
- `components/shared/FormField.tsx`
- `lib/utils/dates.ts` z `getDiffDays`

`FormField` w wielu wariantach jest też w `Settings`, `Candidates`, `SalesQuality`, etc. — stworzyć jeden wspólny.

---

### 14. Brak globalnego systemu toastów / komunikatów

Co `*Client.tsx` to inne podejście do feedbacku po akcji:
- `pwStatus` w SettingsClient
- `null` w wielu plikach (cisza)
- `alert()` w niektórych

**Fix.** Dodać `sonner` lub `react-hot-toast` (~3 KB), wpiąć w `app/layout.tsx` i używać `toast.success/error` we wszystkich CRUD‑ach. Razem z punktem 5 daje jednolite UX.

---

### 15. `data.map` z polami wyliczanymi wykonywany na każdy render

**Plik:** `DomainsClient.tsx`, `HostingsClient.tsx`

```tsx
const rows = data.map(r => ({ ...r, days_left: getDiffDays(r.due_date) }))
```

Wykonywane przy każdym `setHoveredRow` w DataTable (re‑render). Dla 100 wierszy × 5 hoverów na sekundę = 500 alokacji obiektu/s.

**Fix.**

```tsx
const rows = useMemo(
  () => data.map(r => ({ ...r, days_left: getDiffDays(r.due_date) })),
  [data]
)
```

---

### 16. `DataTable` — `eslint-disable react-hooks/exhaustive-deps`

**Plik:** `components/shared/DataTable.tsx:188-190`

`useEffect` z wyciszonym lintem to czerwona flaga. Albo deps są naprawdę kompletne (wtedy lint nie protestuje), albo brakuje deps i mamy stale closure.

**Fix.** Przeczytać efekt, dopisać brakujące deps (typowo `onColumnFiltersChange`, `columnFilters`) lub użyć `useEvent`/`useCallbackRef` pattern żeby callback nie wymuszał re‑setupu.

---

### 17. `autoFocus={idx === 0}` na checkboxach w dropdownie filtra

**Plik:** `components/shared/DataTable.tsx`

`autoFocus` na pierwszym checkboxie w popupie czytniki ekranu czytają „checkbox 1 of N" zamiast nazwy filtra. Również keyboard‑power‑user oczekuje skupienia na inpucie wyszukiwania, nie na pierwszej opcji.

**Fix.** Usunąć `autoFocus`. Jeśli chcemy fokus — kierować na pole wyszukiwania albo `ref` na kontener z `tabIndex={-1}`.

---

### 18. Brak persistencji szerokości kolumn

`DataTable` ma resize, ale `colWidths` nie ląduje w localStorage — odświeżenie strony resetuje konfigurację.

**Fix.**

```tsx
const storageKey = `colWidths:${tableId}`
useEffect(() => {
  const saved = localStorage.getItem(storageKey)
  if (saved) setColWidths(JSON.parse(saved))
}, [tableId])
useEffect(() => {
  localStorage.setItem(storageKey, JSON.stringify(colWidths))
}, [colWidths, tableId])
```

`tableId` przekazywany jako nowy prop do `DataTable` (np. `"sales-deals"`).

---

### 19. `is_empty` filter — string interpolation w `or()`

**Plik:** `lib/supabase/filters.ts`

```ts
case 'is_empty':
  query = query.or(`${key}.is.null,${key}.eq.`)
```

Nazwa kolumny pochodzi od użytkownika (klucz w `columnFilters`). W teorii są to klucze z definicji `Column<T>`, ale jeśli kiedykolwiek wpadnie tam string z `,` lub `)`, mamy injection do filter DSL Supabase (nie SQL injection — Supabase parsuje ten DSL — ale logiczna podatność).

**Fix.** Whitelist nazw kolumn na podstawie listy z `Column<T>[]` lub regex `/^[a-z_][a-z0-9_]*$/i` walidujący `key` przed interpolacją.

---

### 20. `any` w sygnaturze `applyColumnFilters`

**Plik:** `lib/supabase/filters.ts`

```ts
export function applyColumnFilters(query: any, filters: ColumnFilters): any
```

Tracimy type‑safety na całym query‑builderze.

**Fix.** Typować przez Supabase generics:

```ts
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'
export function applyColumnFilters<S, R>(
  query: PostgrestFilterBuilder<S, R, unknown>,
  filters: ColumnFilters,
): PostgrestFilterBuilder<S, R, unknown>
```

---

## 🟢 NISKI — kosmetyka / polish

### 21. `editName` w AdminUsers nadpisuje pole nawet gdy nie zmienione

`AdminUsersClient.tsx` przy zmianie roli wysyła też `full_name`. Jeśli admin nie zmieniał nazwiska, działanie jest poprawne (te same dane), ale w przypadku wyścigu między dwoma adminami można nadpisać świeższą wartość.

**Fix.** Upsertować tylko zmienione pola (porównać z initialState).

---

### 22. `formatRelative` tylko po polsku

`dashboard/page.tsx` ma własny `formatRelative` zwracający `"dzisiaj"`, `"wczoraj"`. Usunąć i użyć `Intl.RelativeTimeFormat(locale, ...)` — działa od Node 14, locale‑aware.

---

### 23. Tytuł zakładki `'4DPF CRM'`

**Plik:** `app/layout.tsx:17`

Stała metadata `title: '4DPF CRM'`. Nigdy się nie zmienia, więc nie widać której strony jesteśmy na pasku przeglądarki.

**Fix.** Per‑page metadata (`export const metadata` w `page.tsx`) lub `generateMetadata` z parametrami.

---

### 24. Brak `loading.tsx` / `error.tsx`

Żadna trasa nie ma własnego `loading.tsx` ani `error.tsx`. Przy wolnej sieci użytkownik widzi pusty layout aż do zakończenia query w RSC.

**Fix.** Dodać minimum `app/[locale]/(dashboard)/loading.tsx` ze szkieletem (skeleton DataTable) i `error.tsx` z klikalnym „Spróbuj ponownie".

---

### 25. Brak tras `not-found.tsx` per locale

Stąd potencjalnie raportowany 404 mógł renderować się brzydko. Dodać `app/[locale]/not-found.tsx` z wiadomością po polsku/angielsku.

---

### 26. Walidacja hasła na 6 znaków

`SettingsClient.tsx:42` wymaga 6 znaków. Supabase domyślnie wymaga 6, ale zalecane minimum 8. Dla CRM z dostępem do danych klientów rozsądne minimum to 10 + złożoność.

**Fix.** Dopasować do polityki firmy + Supabase `auth.config` (`password_min_length`).

---

### 27. Komunikat `'Hasło zostało zmienione.'` nie znika

`SettingsClient.tsx:57` ustawia `pwStatus`, ale nie ma `setTimeout` żeby zniknął. Po pierwszej zmianie hasła komunikat zostaje na ekranie aż do nawigacji.

**Fix.**

```tsx
const t = setTimeout(() => setPwStatus(null), 5000)
return () => clearTimeout(t)
```

w `useEffect` zależnym od `pwStatus`.

---

### 28. Brak `currentPassword` w UI mimo że jest w state

`SettingsClient.tsx` deklaruje `currentPassword` w state, ale nigdy nie renderuje pola dla niego — tylko `newPassword` + `confirmPassword`. Supabase `updateUser` nie wymaga starego hasła (sesja JWT wystarcza), ale to **zła praktyka bezpieczeństwa**: ktoś z dostępem do otwartej karty może zmienić hasło właścicielowi.

**Fix.** Dodać pole „Aktualne hasło" + zweryfikować je przez `supabase.auth.signInWithPassword({ email, password: currentPassword })` przed `updateUser`. Albo usunąć z state (martwy kod).

---

### 29. Status mode `dark` hardcoded w `<html className="dark">`

`app/layout.tsx:30`. CLAUDE.md mówi „wyłącznie dark mode (hardcoded)" — OK, ale wtedy klasa `dark` nic nie wnosi (Tailwind v4 i tak nie używa tego selektora bez konfiguracji). Można usunąć dla cleanu.

---

### 30. `console.error` / `console.log` w produkcji

Grep wskazuje pojedyncze `console.error` w `lib/supabase/server.ts` i klienckich callbackach. Nie blockerem, ale w prod warto przepiąć na sentry/logflare.

---

## Plan działania (priorytety)

1. **Tydzień 1 (Krytyczne):** punkty 1, 2, 4, 5 — naprawiają bezpieczeństwo, crashe i widoczne dla użytkownika błędy.
2. **Tydzień 2 (Wysokie):** 6 (kolory CLAUDE.md), 7 (hydration), 8 (proxy.ts), 9‑12.
3. **Tydzień 3 (Średnie):** 13 (refactor wspólnych komponentów), 14 (toasty), 15‑20.
4. **Stopniowo (Niskie):** 21‑30 przy okazji innych zmian.

---

## Dodatkowo — proponowane usprawnienia infra

- **Testy** — projekt nie ma `__tests__`. Minimum jednostkowe na `applyColumnFilters` (pułapka z `equals`) + integracyjny smoke‑test login/logout (Playwright). 
- **CI** — dodać GitHub Actions: `npm run lint`, `tsc --noEmit`, `next build`.
- **Pre‑commit hook** — `husky` + `lint-staged` żeby `eslint --fix` chodził lokalnie przed commitem (zapobiegnie kolejnym `#ef7f1a` ślizgającym się do main).
- **Migracje DB** — repo nie zawiera `supabase/migrations/`. Schema żyje tylko w panelu Supabase. Ryzyko niespójności środowisk — wprowadzić `supabase db diff` + commit migrations.
