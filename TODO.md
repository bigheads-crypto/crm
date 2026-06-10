# CRM 4DPF — otwarte poprawki

Wyciąg pozycji **niezrealizowanych** z przeglądu kodu z 2026-04-28 (poprzednio `sugerowane_zmiany.md`). Pozycje 1 i 2 z tamtego dokumentu są zrobione i nie zostały tu przeniesione — patrz `DOCS.md` → „Status refactoringu".

> **Ostatnia weryfikacja: 2026-06-09.** Pkt 7 (hydration SettingsClient) i pkt 8 (`proxy.ts` jako middleware) — zrobione, usunięte z listy. Pkt 4, 5, 6 — zwężone do tego, co realnie zostało. Numeracja zachowana dla referencji historycznych w commitach (9, 11, 13… nie są błędem).

Pogrupowane po priorytecie. Każda pozycja: plik(i), problem, propozycja fixa.

---

## ⭐ FABLE REVIEW (2026-06-10) — do zrobienia w pierwszej kolejności

> Wynik pełnego przeglądu projektu (Fable 5). Te pozycje mają pierwszeństwo przed resztą listy.

> **INSTRUKCJA DLA AGENTA:** Gdy użytkownik prosi o realizację **dowolnego zadania z tego pliku** (F1–F6 lub pkt 4–34), **zanim zaczniesz pracę wyświetl mu zalecany model i poziom effortu** z tabel poniżej (np. „F3 → zalecany Opus, effort high — kontynuować na obecnym modelu?"). Jeśli sesja działa na słabszym modelu niż zalecany, zaznacz to wprost i pozwól użytkownikowi zdecydować.

### Rekomendacje — Fable review (F1–F6)

| Zadanie | Zalecany model | Effort | Dlaczego |
|---|---|---|---|
| F1.1 — casty TS2352 (7 plików) | Sonnet | medium | mechaniczne, jeden wzorzec |
| F1.2 — zod `errorMap` → `message` | Sonnet | medium | jedna linia |
| F1.3 — zodResolver/useForm w SupportBacklog | Sonnet, przy utknięciu Opus | high | gnarly generyki zod v4 + RHF; max 2 próby Sonnetem |
| F2 — reguła ESLint `set-state-in-effect` | Sonnet | medium | zmiana konfiguracyjna |
| F3 — custom role (4 pliki, warstwa auth) | **Opus** | **high** | decyzje architektoniczne, dotyka API i proxy |
| F4 — i18n Magazynu | Sonnet | medium | powtarzalny schemat; po pracy sprawdzić parytet pl/en |
| F5 — kolory, unused props, useMemo | Sonnet | low/medium | trywialne |
| F6 — aktualizacja DOCS.md/TODO.md | Sonnet | low | dokumentacja |

### Rekomendacje — reszta listy (pkt 4–34, bezpieczeństwo, infra)

| Zadanie | Zalecany model | Effort | Dlaczego |
|---|---|---|---|
| 4.1 — mass assignment `update_role` | Sonnet | medium | rozdzielenie akcji, mały zakres |
| 4.2 — wyciek treści błędów API | Sonnet | low | zamiana na generic message + `console.error` |
| 4.3 — rate limit / audit log w API admin | **Opus** | **high** | projekt mechanizmu, warstwa bezpieczeństwa |
| 6 — 2 niebieskie rgba | Sonnet | low | = F5, dwie linie |
| 9 — `getWeekLabel` ISO-8601 | Sonnet | medium | mała funkcja; sprawdzić czy `date-fns` jest w `package.json` |
| 10 — KPI „Kandydaci OLX" | Sonnet | medium | wariant 2 (label) trywialny; wariant 1 wymaga migracji DB — decyzja użytkownika przed startem |
| 11 — filterOptions przez RPC | Sonnet | high | SQL prosty, ale refactor w 5 plikach; testować filtry po każdym module |
| 12 — i18n wszystkich modułów (15 stron) | Sonnet | medium | powtarzalne; robić moduł po module, po każdym sprawdzić parytet pl/en |
| 13 — dedup domains/hostings → shared | Sonnet | medium | refactor wg istniejącego wzorca w `components/shared/` |
| 14 — globalne toasty (sonner) | Sonnet | high | nowa zależność + dotyka wszystkich CRUD-ów; mechaniczne ale szerokie |
| 15 — `useMemo` na `data.map` | Sonnet | low | = F5, dwie linie |
| 16 — `eslint-disable exhaustive-deps` w DataTable | **Opus** | **high** | analiza stale closure we współdzielonym komponencie — błąd zepsuje wszystkie tabele |
| 17 — `autoFocus` na checkboxach | Sonnet | low | usunięcie atrybutu |
| 18 — persistencja szerokości kolumn | Sonnet | medium | mały feature, wzorzec podany w opisie |
| 19 — walidacja `key` w `is_empty` | Sonnet | medium | prosty regex/whitelist, ale security-adjacent — przetestować filtry |
| 20 — typy zamiast `any` w `applyColumnFilters` | Sonnet, przy utknięciu Opus | high | generyki `PostgrestFilterBuilder` bywają oporne; max 2 próby Sonnetem |
| 31 — `count: 'estimated'` | Sonnet | medium | mechaniczna zamiana w wielu plikach |
| 32 — projekcja kolumn zamiast `select('*')` | **Opus** | **high** | PUŁAPKA: `openEdit` czyta pola spoza tabeli — zła projekcja po cichu zepsuje edycję; wymaga analizy per moduł |
| 33 — `createClient()` w `useMemo` | Sonnet | low | mechaniczne |
| 34 — indeksy DB | Sonnet | medium | SQL w panelu Supabase; agent może wygenerować skrypt, wykonanie ręczne |
| 21 — `editName` race w AdminUsers | Sonnet | medium | mała logika porównania |
| 22 — `formatRelative` → `Intl.RelativeTimeFormat` | Sonnet | low | podmiana funkcji |
| 23 — per-page metadata (tytuły zakładek) | Sonnet | medium | mechaniczne w wielu `page.tsx`; uwaga na Next 16 — czytać `node_modules/next/dist/docs/` |
| 24 — `loading.tsx` / `error.tsx` | Sonnet | medium | nowe pliki wg konwencji Next |
| 25 — `not-found.tsx` per locale | Sonnet | low | jeden plik |
| 26 — polityka haseł (min. 10) | Sonnet | low | walidacja + config Supabase |
| 27 — znikający komunikat `pwStatus` | Sonnet | low | `setTimeout` w `useEffect`, wzorzec w opisie |
| 28 — pole „Aktualne hasło" + weryfikacja | Sonnet | medium | flow auth, ale prosty (`signInWithPassword` przed `updateUser`) |
| 29 — `<html className="dark">` | Sonnet | low | jedna linia; sprawdzić czy ThemeProvider na tym nie polega |
| 30 — `console.error` → Sentry | Sonnet | medium | dopiero PO wdrożeniu Sentry (sekcja bezpieczeństwa pkt 1) |
| 🔒 Sentry setup | Sonnet | medium | `npx @sentry/wizard` + env; procedura znana |
| 🔒 Backupy (Pro + pg_dump cron) | **Opus** | **high** | projekt workflow GitHub Actions + secrets + restore test; błąd = brak backupu gdy potrzebny |
| 🔒 Security events w `activity_logs` + alerty | **Opus** | **high** | projekt „mini-SIEM": co logować, gdzie hookować, progi alertów |
| Infra — testy (`applyColumnFilters` + Playwright smoke) | Sonnet | high | setup test runnera od zera + pierwsze testy |
| Infra — CI (GitHub Actions) | Sonnet | medium | standardowy workflow lint+tsc+build; **najpierw F1/F2**, inaczej CI od razu czerwone |
| Infra — husky + lint-staged | Sonnet | low | standardowa konfiguracja |
| Infra — migracje DB (`supabase db diff`) | Sonnet, przy problemach Opus | high | procedura CLI prosta, ale pierwsza synchronizacja schema-z-panelu bywa zdradliwa |

Sugerowana kolejność na Sonnecie: F1.1 → F1.2 → F2 → F5 → F6 → F4. Na sesję z Opusem: F3, 16, 32, 4.3 (+ ewentualnie F1.3, 20).

### F1. Type-check nie przechodzi — 13 błędów, bloker `next build` 🔴

`npx tsc --noEmit` zwraca 13 błędów. Next.js failuje produkcyjny build na błędach typów.

1. **7× TS2352** — `editRow as Record<string, unknown>` przy `computeChanges` w: `CandidatesClient.tsx:108`, `MachinesClient.tsx:104`, `MachineIssuesClient.tsx:83`, `ReviewsClient.tsx:165`, `SalesDealsClient.tsx:118`, `SalesQualityClient.tsx:121`, `SupportCasesClient.tsx:111`. Fix: `as unknown as Record<string, unknown>` albo poluzować sygnaturę `computeChanges` w `lib/activity-log.ts` (np. przyjąć generyka `<T extends object>`).
2. **`ReviewsClient.tsx:22`** — `z.enum(..., { errorMap })`: zod v4 nie zna `errorMap`, użyć `{ error: '...' }` lub `{ message: '...' }`.
3. **`SupportBacklogClient.tsx:107-108, 471, 544`** — niezgodność typów `zodResolver`/`useForm`: schema z `.default()`/optional daje inny typ wejściowy niż wyjściowy. Fix: `useForm<Input, unknown, Output>` (trzy generyki) albo ujednolicić schemę.

### F2. ESLint — reguła `react-hooks/set-state-in-effect` vs konwencja projektu 🔴

Lint: 27 błędów, z czego ~22 to nowa reguła `set-state-in-effect` krzycząca na **wymagany przez CLAUDE.md** wzorzec `useEffect(() => { fetchData() }, [fetchData])` (~20 plików) + `DataTable.tsx:103`. Decyzja systemowa: wyłączyć regułę w `eslint.config.mjs` (rekomendowane — wzorzec jest świadomy) albo zmienić konwencję. Bez tego lint nie nadaje się na bramkę CI. Fałszywe alarmy „purity" na `Date.now()` w `dashboard/page.tsx:161,167` (Server Component) — przy okazji.

### F3. Role niestandardowe (v2.68) — martwa funkcjonalność 🟠

Rolę można utworzyć w panelu uprawnień, ale nie da się jej nikomu nadać:

- `AdminUsersClient.tsx:15,20` — selecty ról twardo ograniczone do 6 wbudowanych,
- `app/api/admin/users/route.ts:22` — `VALID_ROLES` odrzuci custom rolę w zod,
- `proxy.ts:21` — `getRedirectPath` nie zna custom ról (fallback `/dashboard`, na który rola może nie mieć `can_view`),
- `RoleBadge` (`AdminUsersClient.tsx:35`) — `colors[role]` undefined dla nieznanej roli → zepsuty styl.

Fix: pobierać listę ról dynamicznie (z `tab_permissions` / dedykowanej tabeli ról), walidować w API przeciw tej liście, redirect dla custom ról wyliczać z pierwszej zakładki z `can_view`.

### F4. Moduł Magazyn łamie twardą zasadę i18n 🟠

Cały Magazyn (v2.77, nowy kod): hardkodowane polskie stringi — nagłówki kolumn, walidacja (`'Wymagane'`), tytuły, etykiety form (5 plików `warehouse/**/*Client.tsx` + `page.tsx`). Przepiąć na `useTranslations('warehouse')` + klucze równolegle w `i18n/pl.json` i `i18n/en.json`. Przy okazji: `Navbar.tsx:6` ma nieużywany import `useTranslations` (rozgrzebane przepięcie).

### F5. Drobne resztki — potwierdzone w przeglądzie 🟡

- 2 niebieskie `rgba(79,110,247,…)`: `dashboard/page.tsx:289`, `DashboardCharts.tsx:109` (= pkt 6 poniżej).
- Nieużywany prop `role` w ~12 klientach (przyjmowany, nigdy nie czytany) — usunąć z interfejsów Props albo zacząć używać.
- `data.map` bez `useMemo` w `DomainsClient.tsx:137`, `HostingsClient.tsx:137` (= pkt 15).

### F6. Dokumentacja odjechała od kodu 🟡

- `DOCS.md` → „Baza danych" nie wymienia tabel: `domains`, `hostings`, `Opinie`, `Support Backlog`, `Machine Issues`, `Products`, `Zestawy`, `Wiazki`, `Hardware`, `Software`, `activity_logs`.
- **Pkt 5 poniżej jest nieaktualny** — Domains/Hostings mają już obsługę `{ error }` (zweryfikowane 2026-06-10). Usunąć przy najbliższej edycji.

### ✅ Co przegląd potwierdził jako poprawne

`requireAuth` na wszystkich 23 stronach · wzorzec `useEffect(fetchData)` we wszystkich klientach DataTable · obsługa `{ error }` we wszystkich CRUD-ach · `logActivity` w 17 modułach · sortKey `'id'` dla OLX · `suppressHydrationWarning` w Badge · parytet kluczy pl/en (187=187) · zero `#ef7f1a` · wersja 2.77 zgodna.

---

## 🔴 KRYTYCZNE

### 4. API `/api/admin/users` — luki bezpieczeństwa

**Plik:** `app/api/admin/users/route.ts`

> Stan na 2026-06-09: walidacja zod (discriminatedUnion) i rollback po nieudanym `profiles.upsert` — zrobione. Pozostają trzy:

1. **Mass assignment w `update_role`** (linia 120) — `update({ role, full_name: data.full_name || null })` nadpisuje `full_name` na NULL, gdy klient nie wysłał pola. Rozdzielić na osobną akcję `update_profile` z `full_name`, lub w `update_role` ustawiać tylko `{ role }`.

2. **Wyciek treści błędów** — wszystkie response zwracają `'Auth: ${error.message}'` / `'Profil: ${error.message}'` (linie 101, 111, 122, 131). To surowe komunikaty Postgres/Supabase. Logować po stronie serwera (np. `console.error` + Sentry), klientowi zwracać generic `'Nie udało się utworzyć użytkownika'`.

3. **Brak rate limit / audit log** — endpoint admin tworzy użytkowników z dowolnym hasłem; co najmniej rejestrować w `activity_log` (kto, kogo, kiedy, jaka akcja).

---

### 5. Brak obsługi błędów w CRUD — Domains/Hostings

> Stan na 2026-06-09: 17/19 modułów ma już `const { error } = await supabase.from(...)...`. Pozostały dwa.

**Pliki:**
- `app/[locale]/(dashboard)/domains/_components/DomainsClient.tsx`
- `app/[locale]/(dashboard)/hostings/_components/HostingsClient.tsx`

Wciąż wywołują `await supabase.from('Domains').insert({...})` bez sprawdzania `{ error }`. Jeśli RLS odrzuci, użytkownik widzi „sukces" mimo że nic nie zostało zapisane.

**Fix.** Wzorzec już używany w pozostałych modułach (np. SalesDealsClient:114-117):

```tsx
const { error } = editRow
  ? await supabase.from('Domains').update(values).eq('id', editRow.id)
  : await supabase.from('Domains').insert(values)
if (error) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }
```

Docelowo wszystko podpiąć pod globalne toasty (pkt 14).

---

## 🟠 WYSOKI

### 6. Złamane reguły kolorystyki — pozostały 2 niebieskie rgba

> Stan na 2026-06-09: wszystkie `#ef7f1a` (zły pomarańcz) wyczyszczone z komponentów. Pozostały dwa stare niebieskie `rgba(79, 110, 247, …)`:

| Plik | Linia | Wartość |
|---|---|---|
| `app/[locale]/(dashboard)/dashboard/page.tsx` | 289 | `'rgba(79, 110, 247, 0.15)'` (tło badge „Transakcja") |
| `app/[locale]/(dashboard)/dashboard/_components/DashboardCharts.tsx` | 109 | `cursor={{ fill: 'rgba(79, 110, 247, 0.08)' }}` (hover na słupkach) |

**Fix.** Zamienić na `rgba(224, 120, 24, 0.15)` / `0.08)` (4DPF pomarańcz).

---

### 9. `getWeekLabel` nie ISO-8601

**Plik:** `app/[locale]/(dashboard)/dashboard/page.tsx:17`

Custom liczenie tygodnia daje inne wyniki niż ISO 8601 (Polska standard). Statystyki per-tydzień mają błędy graniczne (poniedziałki na styku roku trafiają do złego tygodnia).

**Fix.**

```ts
import { getISOWeek, getISOWeekYear } from 'date-fns'
const label = `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2,'0')}`
```

(Przed dodaniem zależności sprawdź `package.json`.)

---

### 10. KPI „Kandydaci OLX" — semantyka

**Plik:** `app/[locale]/(dashboard)/dashboard/page.tsx:132-135, 213`

Komentarz jest uczciwy („OLX nie ma created_at, więc zliczamy wszystkich"), ale tytuł kafelka brzmi po prostu **„Kandydaci OLX"** — bez wskazania, że to total kontra np. „w tym miesiącu". Manager patrzący na dashboard nie wie, czy liczba rośnie. KPI bez ramy czasowej traci wartość trendową.

**Fix — jedno z dwóch:**

1. Dodać `created_at` do tabeli `OLX` (Supabase migration) i przerobić zapytanie na `.gte('created_at', startOfMonth)`. Najsensowniej.
2. Albo zmienić label na **„Kandydaci OLX (wszyscy)"** i osobny kafelek „Nowi w tym miesiącu" zostawić jako planowany.

---

### 11. N+1 / brak `.limit()` przy budowie `filterOptions`

**Pliki:** każdy `*Client.tsx` ładujący dynamiczne `filterOptions` (Sales, SalesDeals, SalesQuality, SupportCases, SupportLog).

```ts
supabase.from('Sales Deals').select('salesman').not('salesman', 'is', null)
```

Pobiera **wszystkie wiersze tabeli**. Przy 50k wierszy = każde wejście na stronę = 50k×kolumn JSON. Lagi + transfer.

**Fix.** Funkcja DB:

```sql
create or replace function distinct_salesman_sales_deals()
returns table(v text) language sql stable as $$
  select distinct salesman from "Sales Deals" where salesman is not null order by 1
$$;
```

i wołać przez `supabase.rpc('distinct_salesman_sales_deals')`. Alternatywnie: cache w Server Component (`initialFilterOptions` jako prop).

---

### 12. Hardkodowane polskie stringi mimo i18n

`next-intl` skonfigurowane (`localePrefix: 'always'`), ale 90% UI ma stringi po polsku w kodzie. Przykłady:

- `roleLabels` w `SettingsClient.tsx:64-71`
- `formatRelative()` w `dashboard/page.tsx` zwraca tylko polskie stringi
- Komunikaty walidacji: `'Wymagane'`, `'Hasło musi mieć co najmniej 6 znaków.'`
- Etykiety przycisków: `'Zapisywanie…'`, `'Zmień hasło'`, `'Anuluj'`

**Fix.** Przenieść do `i18n/pl.json` + `i18n/en.json` i używać `useTranslations()`. Robić moduł po module (jest 15 stron) — patrz wzorzec w CLAUDE.md → „i18n".

---

## 🟡 ŚREDNI

### 13. Powielony kod między `domains` i `hostings`

**Pliki:**
- `app/[locale]/(dashboard)/domains/_components/DomainsClient.tsx`
- `app/[locale]/(dashboard)/hostings/_components/HostingsClient.tsx`

Funkcje `getDiffDays`, `DueDateBadge`, `DaysLeftBadge`, lokalny `FormField` są kopiowane verbatim. 4 funkcje ×2 pliki = 8 kopii.

**Fix.** Wyciągnąć do `components/shared/`:
- `components/shared/DueDateBadge.tsx`
- `components/shared/DaysLeftBadge.tsx`
- `components/shared/FormField.tsx`
- `lib/utils/dates.ts` z `getDiffDays`

`FormField` w wielu wariantach jest też w Settings, Candidates, SalesQuality — stworzyć jeden wspólny.

> Po sesji 2026-05 część z tego jest już w `components/shared/Badge.tsx` i `forms.tsx` (DOCS.md → „Biblioteka shared"). Zweryfikuj co jeszcze zostało.

---

### 14. Brak globalnego systemu toastów

Co `*Client.tsx` to inne podejście do feedbacku po akcji:
- `pwStatus` w SettingsClient
- `null` w wielu plikach (cisza)
- `alert()` w niektórych

**Fix.** Dodać `sonner` lub `react-hot-toast` (~3 KB), wpiąć w `app/layout.tsx`, używać `toast.success/error` we wszystkich CRUD-ach. Razem z pkt 5 daje jednolite UX.

---

### 15. `data.map` z polami wyliczanymi na każdy render

**Plik:** `DomainsClient.tsx`, `HostingsClient.tsx`

```tsx
const rows = data.map(r => ({ ...r, days_left: getDiffDays(r.due_date) }))
```

Wykonywane przy każdym `setHoveredRow` (re-render). Dla 100 wierszy × 5 hoverów/s = 500 alokacji/s.

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

`useEffect` z wyciszonym lintem to czerwona flaga. Albo deps są kompletne (wtedy lint nie protestuje), albo brakuje deps i mamy stale closure.

**Fix.** Przeczytać efekt, dopisać brakujące deps (typowo `onColumnFiltersChange`, `columnFilters`) lub użyć `useEvent`/`useCallbackRef` żeby callback nie wymuszał re-setupu.

---

### 17. `autoFocus={idx === 0}` na checkboxach w dropdownie filtra

**Plik:** `components/shared/DataTable.tsx`

`autoFocus` na pierwszym checkboxie — czytniki ekranu czytają „checkbox 1 of N" zamiast nazwy filtra. Keyboard-power-user oczekuje fokusa na inpucie wyszukiwania.

**Fix.** Usunąć `autoFocus`. Jeśli chcemy fokus — kierować na pole wyszukiwania albo `ref` na kontener z `tabIndex={-1}`.

---

### 18. Brak persistencji szerokości kolumn

`DataTable` ma resize, ale `colWidths` nie ląduje w localStorage — refresh resetuje konfigurację.

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

`tableId` jako nowy prop (np. `"sales-deals"`).

---

### 19. `is_empty` filter — string interpolation w `or()`

**Plik:** `lib/supabase/filters.ts`

```ts
case 'is_empty':
  query = query.or(`${key}.is.null,${key}.eq.`)
```

Nazwa kolumny pochodzi od użytkownika (klucz w `columnFilters`). Jeśli wpadnie tam string z `,` lub `)`, mamy injection do filter DSL Supabase (logiczna podatność, nie SQL injection).

**Fix.** Whitelist nazw kolumn na podstawie listy z `Column<T>[]` lub regex `/^[a-z_][a-z0-9_]*$/i` walidujący `key` przed interpolacją.

---

### 20. `any` w sygnaturze `applyColumnFilters`

**Plik:** `lib/supabase/filters.ts`

```ts
export function applyColumnFilters(query: any, filters: ColumnFilters): any
```

**Fix.**

```ts
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'
export function applyColumnFilters<S, R>(
  query: PostgrestFilterBuilder<S, R, unknown>,
  filters: ColumnFilters,
): PostgrestFilterBuilder<S, R, unknown>
```

---

## ⚡ WYDAJNOŚĆ

### 31. `count: 'exact'` na każdym paginowanym zapytaniu

**Pliki:** każdy `*Client.tsx` z `fetchData` (sales-deals, machines, support-cases, sales, candidates, …)

```ts
supabase.from('Sales Deals').select('*', { count: 'exact' })
```

Postgres wykonuje pełny `COUNT(*)` nad przefiltrowanym zestawem przy każdej zmianie strony / filtra / sortowania. Dla tabel >10k wierszy to dominujący koszt każdego fetcha.

**Fix.** Zmienić na `count: 'estimated'` — Postgres używa statistyk plannera, odpowiedź natychmiastowa. Paginacja pokazuje przybliżony total (np. „~12 547"), ale UX dla CRM w zupełności wystarczający. Jeśli exact jest wymagany na konkretnej stronie — zostawić tylko tam.

---

### 32. `select('*')` zamiast projekcji kolumn

**Pliki:** każdy `*Client.tsx` z `fetchData` i każdy `page.tsx` z `initialData`

DataTable renderuje 5–8 kolumn, ale `select('*')` pobiera wszystkie pola łącznie z dużymi textowymi (`current_summary`, `shipping_details`, `description`, …). Przy PAGE_SIZE=25 i 10 polach tekstowych to setki KB JSON na stronę.

**Fix.** Podać jawną listę kolumn pasującą do zdefiniowanych `columns`:

```ts
supabase.from('Sales Deals')
  .select('id, phone, client_name, salesman, status, category, detected_engine, created_at', { count: 'estimated' })
```

Pamiętać o dołączeniu `id` (potrzebne do edit/delete).

---

### 33. `createClient()` tworzony w każdym handlerze

**Pliki:** każdy `*Client.tsx`

```ts
const fetchData = useCallback(async () => {
  const supabase = createClient()   // ← nowy klient przy każdym wywołaniu
  ...
}, [...])

const onSubmit = async () => {
  const supabase = createClient()   // ← kolejny nowy klient
  ...
}
```

`createClient()` tworzy instancję za każdym razem — zbędna alokacja i inicjalizacja.

**Fix.** Hoistnąć do `useMemo` raz na lifecycle komponentu:

```ts
const supabase = useMemo(() => createClient(), [])
```

---

### 34. Brak indeksów DB na kolumnach filtrów i sortowania

Filtry kolumnowe (`status`, `salesman`, `category`, …) i sortowanie (`created_at` DESC) nie mają potwierdzonych indeksów w Supabase. Bez indeksu każde `SELECT … WHERE salesman = 'X' ORDER BY created_at` to full sequential scan.

**Weryfikacja.** W Supabase Dashboard → Table Editor → `Sales Deals` → Indexes (albo `\d "Sales Deals"` w psql).

**Fix.** Dodać indeksy na najczęściej filtrowanych kolumnach:

```sql
CREATE INDEX ON "Sales Deals" (status);
CREATE INDEX ON "Sales Deals" (salesman);
CREATE INDEX ON "Sales Deals" (created_at DESC);
-- analogicznie dla: Machines, Support Case, Sales, Candidates, ...
```

Dla composite queries rozważyć partial index lub multi-column index.

---

---

## 🟢 NISKI — polish

### 21. `editName` w AdminUsers nadpisuje pole nawet gdy nie zmienione

`AdminUsersClient.tsx` przy zmianie roli wysyła też `full_name`. Wyścig między dwoma adminami → można nadpisać świeższą wartość.

**Fix.** Upsertować tylko zmienione pola (porównać z initialState).

---

### 22. `formatRelative` tylko po polsku

`dashboard/page.tsx` ma własny `formatRelative` zwracający `"dzisiaj"`, `"wczoraj"`. Usunąć, użyć `Intl.RelativeTimeFormat(locale, ...)` — locale-aware.

---

### 23. Statyczny tytuł zakładki `'4DPF CRM'`

**Plik:** `app/layout.tsx:17`

`title: '4DPF CRM'` się nie zmienia, więc nie widać której strony jesteśmy na pasku.

**Fix.** Per-page metadata (`export const metadata` w `page.tsx`) lub `generateMetadata`.

---

### 24. Brak `loading.tsx` / `error.tsx`

Żadna trasa nie ma własnego `loading.tsx` ani `error.tsx`.

**Fix.** Minimum `app/[locale]/(dashboard)/loading.tsx` ze szkieletem (skeleton DataTable) i `error.tsx` z klikalnym „Spróbuj ponownie".

---

### 25. Brak `not-found.tsx` per locale

Potencjalnie raportowany 404 mógł renderować się brzydko. Dodać `app/[locale]/not-found.tsx`.

---

### 26. Walidacja hasła na 6 znaków

`SettingsClient.tsx:42` wymaga 6 znaków. Dla CRM z dostępem do danych klientów rozsądne minimum 10 + złożoność.

**Fix.** Dopasować do polityki firmy + Supabase `auth.config` (`password_min_length`).

---

### 27. Komunikat „Hasło zostało zmienione." nie znika

`SettingsClient.tsx:57` ustawia `pwStatus`, nie ma `setTimeout`. Komunikat zostaje do nawigacji.

**Fix.**

```tsx
useEffect(() => {
  if (!pwStatus) return
  const t = setTimeout(() => setPwStatus(null), 5000)
  return () => clearTimeout(t)
}, [pwStatus])
```

---

### 28. Brak `currentPassword` w UI mimo że w state

`SettingsClient.tsx` deklaruje `currentPassword` w state, ale nie renderuje pola — tylko `newPassword` + `confirmPassword`. Supabase `updateUser` nie wymaga starego hasła (JWT wystarcza), ale to zła praktyka security: ktoś z dostępem do otwartej karty może zmienić hasło właścicielowi.

**Fix.** Dodać pole „Aktualne hasło" + zweryfikować przez `supabase.auth.signInWithPassword({ email, password: currentPassword })` przed `updateUser`. Albo usunąć z state (martwy kod).

---

### 29. `<html className="dark">` hardcoded

`app/layout.tsx:30`. Tailwind v4 nie używa tego selektora bez konfiguracji. Można usunąć dla cleanu.

---

### 30. `console.error` / `console.log` w produkcji

Grep wskazuje pojedyncze `console.error` w `lib/supabase/server.ts` i klienckich callbackach. W prod warto przepiąć na sentry/logflare.

---

## 🔒 BEZPIECZEŃSTWO — notatki z rozeznania (2026-06-10)

> Sekcja **research / orientation**, nie konkretne zadania do wykonania teraz. Materiał do późniejszej decyzji co i kiedy wdrażać. Wszystkie kwoty orientacyjne (stan czerwiec 2026).

### Stan obecny w projekcie

- ✅ **`activity_logs`** — tabela + helper `lib/activity-log.ts` (`logActivity()` + `computeChanges()`). Loguje CRUD (`create`/`update`/`delete`) z `user_id`, `user_email`, `tab_key`, `record_id`, `details` (JSON ze zmianami pole-po-polu). Używane w 19 modułach.
- ✅ **`activity_logs` UI** — `/admin/activity-log` z podglądem dla adminów.
- ❌ **Brak logowania security events**: login/logout/failed auth, password change, akcje w `/api/admin/users`, role changes, odrzucenia RLS.
- ❌ **Brak Sentry / żadnego error trackingu** w aplikacji.
- ❌ **Brak konfiguracji backupów w repo** — nie wiadomo, czy projekt jest na Supabase Free (zero backupów), Pro (daily, 7d retention) czy Pro+PITR.
- ❌ **Brak migracji DB w repo** (`supabase/migrations/`) — schema żyje tylko w panelu, brak DR-friendly versioning.

### Krajobraz narzędzi w skali tego CRM

Pełne enterprise SIEM (Splunk, IBM QRadar, Wazuh self-hosted) — **overkill**. Dla firmy z kilkoma userami wewnętrznymi pragmatyczne podejście to **trzy współpracujące warstwy**:

| Warstwa | Co loguje | Rekomendowane narzędzie | Koszt orientacyjny |
|---|---|---|---|
| **Aplikacja** | Errory Next.js, slow API routes, performance, PII scrubbing | **Sentry** (alt: Highlight, BugSnag) | Free 5k errors/mies, dalej ~$26/mies |
| **DB + Auth** | Login/logout, failed auth, RLS rejects, query log | **Supabase Logs** (wbudowane) + opcjonalny forward przez Database Webhooks do **Axiom** lub **Better Stack** | Free w ramach Supabase; Axiom free do 0.5 TB/mies |
| **Infra / uptime** | Latencja, status HTTP, SSL, certy, alerty | **Better Stack** / UptimeRobot / Vercel Analytics | Free tier zwykle wystarczy |

Razem **~$30–50/mies** dla skali 4DPF.

### Backupy — twardy minimum

Supabase **Free plan nie ma automatycznych backupów**. Plany:
- **Free** — zero backupów, jedna kopia w panelu = jedyna kopia.
- **Pro** ($25/mies) — daily backups, 7 dni retention.
- **Pro + PITR** (+$100/mies) — point-in-time recovery (7/14/28 dni).

Dla CRM z danymi klientów minimum to:
1. **Supabase Pro** ($25/mies) — daily + ew. PITR jeśli budżet pozwala.
2. **Niezależny `pg_dump` cron → S3 / Backblaze B2** (GitHub Actions co noc, retention 30/90 dni) — kopia poza Supabase, gdyby konto/projekt padło. Koszt storage ~$1–5/mies.
3. **Test restore raz na kwartał** — backup nieodtworzony ≠ backup.

### Aspekt RODO/GDPR (Polska)

CRM trzyma dane osobowe (nazwa, telefon, email klienta) → art. 32 RODO „bezpieczeństwo przetwarzania". Audit log + backupy z procedurą odtworzenia są **praktycznie wymagane** przy audycie. Konkretne braki:
- ❌ Logowanie **odczytów** (kto kiedy zobaczył dane klienta X) — przy audycie RODO często pytają. Dziś logujemy tylko zmiany.
- ❌ Procedura **prawa do bycia zapomnianym** — manual w panelu Supabase, brak workflow.
- ❌ **Retention policy** dla `activity_logs` — logi z PII też podlegają RODO, nie trzymać wiecznie (typowo 12–24 mies dla audit, potem auto-purge).

### Pragmatyczne minimum dla 4DPF — kolejność wdrożenia

Gdyby przyszło do decyzji, trzy ruchy w kolejności ROI:

1. **Sentry w Next.js** — `npx @sentry/wizard` + dodać `NEXT_PUBLIC_SENTRY_DSN` do env. ~1h roboty, free tier. Natychmiast widać crashe userów w prod, których teraz nie widać wcale.
2. **Upgrade Supabase do Pro + nightly `pg_dump` do B2/S3** (GitHub Actions). 2–3h roboty. Przestajesz być jeden klik od utraty bazy.
3. **Rozszerzyć `activity_logs` o security events** — login success/failed, password change, admin actions w `/api/admin/users`, role changes. Dodać alert (webhook do Slacka / email) na `5 failed logins w 10 min` lub `delete user`. To jest „mini-SIEM" zbudowany na tym, co już masz, bez zewnętrznego narzędzia.

Wszystko inne (pełne SIEM, dedykowany SOC, ISO27001) ma sens dopiero przy wzroście firmy lub wejściu w sektor regulowany (med, fin, gov).

### Pytania otwarte do decyzji biznesowej

- Na jakim planie Supabase obecnie jesteśmy?
- Gdzie hostowany jest Next.js (Vercel? własny VPS?) — od tego zależy wybór narzędzia uptime/log.
- Jaki budżet miesięczny na narzędzia security/observability jest akceptowalny?
- Czy planowany jest audyt RODO / certyfikacja w przewidywalnej przyszłości?

---

## Infra — usprawnienia ogólne

- **Testy** — brak `__tests__`. Minimum jednostkowe na `applyColumnFilters` + integracyjny smoke-test login/logout (Playwright).
- **CI** — GitHub Actions: `npm run lint`, `tsc --noEmit`, `next build`.
- **Pre-commit hook** — `husky` + `lint-staged` z `eslint --fix` (zapobiegnie kolejnym `#ef7f1a` ślizgającym się do main).
- **Migracje DB** — repo nie zawiera `supabase/migrations/`. Schema żyje tylko w panelu Supabase. Ryzyko niespójności środowisk — wprowadzić `supabase db diff` + commit migrations.

---

## Plan działania (sugerowane priorytety)

1. **Najpierw (krytyczne):** pkt 4 (resztówki bezpieczeństwa API), 5 (Domains/Hostings error handling).
2. **Wydajność (świeży boost):** pkt 31, 32, 33, 11 (filter options RPC), 34 (indexy DB).
3. **Wysokie:** 6 (2 niebieskie rgba), 9–12.
4. **Średnie:** 13 (DueDateBadge do shared), 14 (toasty), 15–20.
5. **Stopniowo (niskie):** 21–30 przy okazji innych zmian.
