@AGENTS.md

# CRM 4DPF — przegląd projektu

## Stack
- **Next.js 16.2.2** (Turbopack) — breaking changes vs. starsze wersje, czytaj `node_modules/next/dist/docs/`
- **Supabase** (`@supabase/ssr`) — auth + baza danych
- **next-intl** — i18n, locale prefix `always` (`/pl/...`, `/en/...`)
- **react-hook-form + zod** — formularze i walidacja

## Struktura plików
```
app/
  page.tsx                    → redirect do /pl/login
  [locale]/
    page.tsx                  → redirect do /[locale]/login
    layout.tsx                → NextIntlClientProvider
    (auth)/login/             → strona logowania
    (dashboard)/              → wszystkie chronione widoki
      dashboard, candidates, machines, sales, sales-deals,
      sales-quality, sales-text-log, support-cases,
      support-log, support-text-log, admin/users,
      settings/                 → profil użytkownika (zmiana hasła, info o koncie)
proxy.ts                      → middleware (Next.js 16 używa proxy.ts zamiast middleware.ts)
lib/supabase/
  client.ts                   → createClient() dla Client Components
  server.ts                   → createClient() dla Server Components (async)
  types.ts                    → wszystkie typy TS + typ Role
  filters.ts                  → typy ColumnFilter/ColumnFilters + applyColumnFilters()
components/shared/
  DataTable.tsx               → główna tabela z sortowaniem, filtrami per-kolumna, resize
  Modal.tsx, ConfirmDialog.tsx, Pagination.tsx
```

## Routing i auth (proxy.ts)
- Plik `proxy.ts` (nie `middleware.ts`) pełni rolę middleware — konwencja Next.js 16
- Niezalogowany → redirect do `/${locale}/login`
- Zalogowany na `/login` → redirect do strony wg roli (patrz `getRedirectPath`)
- Role: `admin | manager | handlowiec | support | hr | logistyka`

## Baza danych — tabele Supabase
| Tabela | Typ TS |
|---|---|
| `OLX` | `OLXCandidate` |
| `Machines` | `Machine` |
| `Sales Deals` | `SalesDeal` |
| `Sales Quality` | `SalesQuality` |
| `Sales Text Log` | `SalesTextLog` |
| `Support Case` | `SupportCase` |
| `Support Log` | `SupportLog` |
| `Support Text Log` | `SupportTextLog` |
| `Sales` | `Sale` |
| `profiles` | `Profile` (rozszerzenie Supabase Auth) |

> Uwaga: nazwy tabel w Supabase mają **spacje** (np. `Sales Deals`, `Support Case`).

## DataTable — komponent współdzielony
- Props: `data`, `columns`, `totalCount`, `page`, `onPageChange`, `pageSize`
- Sortowanie: `sortKey`, `sortDir`, `onSortChange` — klik nagłówka kolumny przełącza asc/desc
- Filtry per-kolumna: `columnFilters: ColumnFilters`, `onColumnFiltersChange`
- Interfejs `Column<T>`: `key`, `header`, `render?`, `width?`, `sortable?`, `filterable?`, `filterOptions?`
- `searchValue` / `onSearchChange` — **legacy, nie renderowane**, zachowane dla kompatybilności
- Dropdown per kolumna (Google Sheets style) — ikona lejka w nagłówku otwiera popup z:
  - Sekcją sortowania (A→Z / Z→A)
  - Sekcją filtru: select warunku + pole wartości (dla zwykłych kolumn) LUB checkboxy multi-select (gdy kolumna ma `filterOptions`)
  - Przyciskami: Wyczyść filtr / Anuluj / Zastosuj
  - Enter w polu wartości = zastosuj
- Aktywny filtr = niebieski pasek pod nagłówkiem kolumny
- Dropdown renderowany przez `createPortal` na `document.body` (unika clipping przez overflow)

## Filtry kolumn — lib/supabase/filters.ts
- Typ `FilterCondition`: `contains | not_contains | equals | not_equals | starts_with | ends_with | is_empty | is_not_empty | one_of`
- Typ `ColumnFilter`: `{ condition: FilterCondition, value: string, values?: string[] }`
  - `values` używane tylko gdy `condition === 'one_of'`
- Typ `ColumnFilters`: `Record<string, ColumnFilter>`
- Funkcja `applyColumnFilters(query, filters)` — aplikuje wszystkie filtry do zapytania Supabase
- Mapowanie na Supabase: `contains` → `ilike %v%`, `not_contains` → `filter not.ilike`, `equals` → `ilike v`, `starts_with` → `ilike v%`, `ends_with` → `ilike %v`, `is_empty` → `or(col.is.null,col.eq.)`, `is_not_empty` → `not is null`, `one_of` → `.in(key, values)`

## filterOptions — multi-select checkboxy
- Kolumna z `filterOptions: string[]` w definicji pokazuje checkboxy zamiast pola tekstowego
- Użytkownik może zaznaczyć wiele wartości jednocześnie (np. status `open` + `closed`)
- W dropdownie checkboxów są przyciski **"Zaznacz wszystkie"** i **"Odznacz"** (dodane w v1.8)
- Lista checkboxów ma `maxHeight: 220px` z przewijaniem — obsługuje długie listy
- Warunek renderowania: `filterOptions?.length` (nie samo `filterOptions`) — pusta tablica cofa się do trybu tekstowego

### filterOptions statyczne vs. dynamiczne
- **Statyczne** (stałe z góry znane wartości): `filterOptions: ['val1', 'val2']` bezpośrednio w definicji kolumny
  - Używane dla: `status` (Sales, SalesDeals, SupportCases)
- **Dynamiczne** (wartości pobierane z bazy): `useState<string[]>([])` + `useEffect` na mount + `useMemo` dla kolumn
  - Używane dla: `salesman` (Sales, SalesDeals, SalesQuality), `category` (SalesDeals, SalesQuality, SupportLog, SupportCases), `detected_engine` (SalesDeals, SalesQuality, SupportLog, SupportCases), `support_agent` (SupportLog), `last_agent` (SupportCases)
  - Wzorzec: `supabase.from('Tabela').select('kolumna').not('kolumna', 'is', null)` → deduplika `[...new Set(...)]` → `.sort()`

### Wzorzec dynamicznych filterOptions w komponentach
```tsx
// 1. Stan
const [filterOptionsMap, setFilterOptionsMap] = useState<Record<string, string[]>>({})

// 2. Ładowanie przy montowaniu
useEffect(() => {
  async function loadOptions() {
    const supabase = createClient()
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from('Tabela').select('kolumna1').not('kolumna1', 'is', null),
      supabase.from('Tabela').select('kolumna2').not('kolumna2', 'is', null),
    ])
    setFilterOptionsMap({
      kolumna1: [...new Set((s ?? []).map(r => r.kolumna1).filter(Boolean) as string[])].sort(),
      kolumna2: [...new Set((c ?? []).map(r => r.kolumna2).filter(Boolean) as string[])].sort(),
    })
  }
  loadOptions()
}, [])

// 3. Kolumny jako useMemo (nie stała modułowa!)
const columns = useMemo<Column<T>[]>(() => [
  { key: 'kolumna1', header: 'Nagłówek', filterOptions: filterOptionsMap.kolumna1 },
  // ...
], [filterOptionsMap])
```
> Uwaga: gdy kolumny mają dynamiczne `filterOptions`, muszą być definiowane jako `useMemo` wewnątrz komponentu — nie jako stała `const COLUMNS = [...]` poza komponentem.

## Punktacja / oceny
- **Kandydaci** (`OLXCandidate`): skala **/100** — progi kolorów: zielony ≥ 70, żółty ≥ 40, czerwony < 40
- **Sales Quality** (`SalesQuality`): skala **/10** — progi kolorów: zielony ≥ 7, żółty ≥ 4, czerwony < 4

## Wzorzec każdego modułu (np. CandidatesClient)
1. Server Component pobiera `initialData` + `initialCount` z Supabase
2. Client Component (`*Client.tsx`) zarządza stanem: `data, count, page, sortKey, sortDir, columnFilters`
3. `fetchData` w `useCallback` odpytuje Supabase: `applyColumnFilters(query, columnFilters)` + order + range
4. `columnFilters` w deps array `useCallback` — zmiana filtra wyzwala nowe zapytanie
5. DataTable otrzymuje `columnFilters` + `onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}`
6. CRUD przez Supabase client + `fetchData()` po każdej operacji

## Strona ustawień użytkownika (`/settings`)
- Dostępna dla wszystkich zalogowanych ról — link w dropdown menu Navbar (ikona użytkownika, góra prawa)
- `app/[locale]/(dashboard)/settings/page.tsx` — Server Component pobierający `email`, `full_name`, `role` z Supabase
- `settings/_components/SettingsClient.tsx` — Client Component z:
  - Kartą informacji (email, imię i nazwisko, rola)
  - Formularzem zmiany hasła (`supabase.auth.updateUser({ password })`) — walidacja min. 6 znaków + zgodność
- Tytuł strony w Navbar: klucz `settings` → `'Profil użytkownika'` dodany do `PATH_TO_TITLE`

## Znane pułapki
- Tabela `OLX` (`OLXCandidate`) **nie ma kolumny `created_at`** — domyślny `sortKey` musi być `'id'`, nie `'created_at'`
- Pozostałe tabele mają `created_at` i mogą używać go jako domyślnego sortowania
- **Kolumny wyliczane (np. `days_left`)** nie istnieją w bazie — przy sortowaniu trzeba mapować je na realną kolumnę DB przed wysłaniem do Supabase (np. `days_left` → `due_date`). Wzorzec: `const dbSortKey = sortKey === 'days_left' ? 'due_date' : sortKey`
- **Hydration mismatch z `new Date()`** — komponenty renderujące wartości zależne od aktualnego czasu (różnica dni, sformatowana data) muszą mieć `suppressHydrationWarning` na elemencie ze zmienną treścią. Serwer (UTC) i klient (inna strefa) obliczają różne wartości → React regeneruje drzewo. Dotyczy `DaysLeftBadge` i `DueDateBadge` w `hostings` i `domains`.

## Design system — v1.7

### Paleta kolorów (`app/globals.css`)
Baza: ciepłe neutralne szarości (komfort przy długiej pracy) + pomarańcz 4DPF jako akcent.

```css
--bg: #181614          /* ciepła ciemna szarość — baza */
--sidebar: #201d1a     /* sidebar, wyraźnie odróżniony od bg */
--accent: #e07818      /* pomarańcz 4DPF — przyciski, aktywne stany, focus */
--accent-hover: #c96b10
--border: #2e2a25
--surface: #211e1b     /* karty, wiersze */
--surface-2: #2a2620   /* modale, dropdowny */
--text: #e2d9ce        /* ciepła biel — nie drażni oczu */
--text-muted: #8a7f72
--text-dim: #524a40
--danger: #e8384f
--success: #10a872
--warning: #e8a800
```

**Zasada:** `--accent` pojawia się tylko na elementach interaktywnych (przyciski, aktywne linki, focus ring, wskaźniki filtru). Baza UI pozostaje neutralna.

**NIGDY nie hardkoduj** `#4f6ef7`, `#3d5ce0`, `rgba(79,110,247,...)` — to stary niebieski kolor, zastąpiony. Zawsze używaj `var(--accent)` lub `rgba(239,127,26,...)` / `rgba(224,120,24,...)`.

### Kolory statusów (hardkodowane w komponentach)
Statusy mają własne kolory niezależne od `--accent`:
- `new` / `in_progress` / rola `handlowiec` → `#e07818` (akcent marki)
- `open` (support) → `#e8384f` (danger)
- `pending` → `#e8a800` (warning)
- `delivered` / `resolved` / rola `hr` → `#10a872` (success)
- `shipped` / rola `manager` → `#a855f7` (fiolet)
- `cancelled` / `closed` / rola `admin` → `#ef4444` / `#6b7280`
- Badge kierunku `OUT` (text logi) → `#e07818`

### Typografia
- Font: Geist Sans (Next.js font system) — `var(--font-sans)` w `body`
- **Nie używaj** `Arial` ani `Helvetica` bezpośrednio — Geist ładuje się przez `--font-sans`

### Komponenty UI

#### Sidebar (`components/layout/Sidebar.tsx`)
- Logo: obramówka `border: 1.5px solid var(--accent)` wokół tekstu "4DPF / CRM System" — pełna szerokość
- Aktywny link: `rgba(239,127,26,0.12)` tło + `2px solid var(--accent)` lewy border
- Zwinięty sidebar: pokazuje tylko "4D" w kolorze akcentu
- Box shadow: `2px 0 12px rgba(0,0,0,0.3)` dla głębi

#### DataTable (`components/shared/DataTable.tsx`)
- Nagłówek: `var(--surface-2)`, `2px solid var(--border)` border-bottom, tekst uppercase 11px 600 weight
- Striping: parzyste `transparent`, nieparzyste `rgba(255,255,255,0.03)`
- Hover wiersza: `rgba(239,127,26,0.07)` — zarządzany przez `hoveredRow` state
- Wszystkie kolory w dropdownie filtru/sortowania: `rgba(239,127,26,...)` — bez niebieskiego

#### Modal (`components/shared/Modal.tsx`)
- Overlay: `backdrop-filter: blur(12px)` + `rgba(0,0,0,0.65)` + animacja `overlayShow`
- Panel: animacja `contentShow` (scale 0.94→1 + fade, cubic-bezier sprężysty 0.28s)
- Box-shadow: trójwarstwowy — pomarańczowa obwódka + głęboki cień + poświata
- Górna linia: gradient `var(--accent)` → `#fdb909` → transparent
- Przycisk zamknięcia: hover → pomarańczowy

#### Animacje (zdefiniowane w `app/globals.css`)
- `overlayShow` / `overlayHide` — blur 0→12px + opacity
- `contentShow` / `contentHide` — scale + opacity + translateY

#### Focus state (globalny CSS)
```css
input:focus, select:focus, textarea:focus {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 3px rgba(239, 127, 26, 0.15);
}
```
Działa automatycznie na wszystkich polach — nie dodawaj `:focus` inline.

---

## Status refactoringu — sesja 2026-04-28

### Co zostało zrobione

**✅ Punkt 1 — `requireAuth()` we wszystkich stronach**
- Wszystkie 13 stron dashboardowych (`candidates`, `domains`, `machines`, `sales`, `sales-deals`, `sales-quality`, `sales-text-log`, `support-cases`, `support-log`, `support-text-log`, `hostings`, `admin/users`, `settings`) używają teraz `requireAuth()` z `lib/auth/helpers.ts` zamiast `user!.id`
- Wygasła sesja → bezpieczny redirect na `/login` zamiast runtime crash
- `lib/auth/helpers.ts` — funkcja `requireAuth` istnieje i jest teraz używana

**✅ Punkt 2 — `equals`/`not_equals` w `lib/supabase/filters.ts`**
- `equals` zmienione z `.ilike(key, v)` → `.eq(key, v)`
- `not_equals` zmienione z `.filter(key, 'not.ilike', v)` → `.neq(key, v)`

### Co zostało do zrobienia (plik `sugerowane_zmiany.md` w roocie)

Priorytety na następną sesję:

**🔴 Krytyczne — jeszcze nierozwiązane:**
- **Punkt 3** — Niezgodność skali w formularzu kandydatów: etykiety mówią `(0-10)` ale `ScoreBadge` koloruje wg progów `/100`. Plik: `app/[locale]/(dashboard)/candidates/_components/CandidatesClient.tsx:150-153`
- **Punkt 4** — Brak walidacji wejścia, mass assignment, race condition i wyciek błędów w `app/api/admin/users/route.ts`
- **Punkt 5** — Brak obsługi błędów po CRUD (insert/update/delete) — 16 miejsc bez sprawdzenia `{ error }` w `*Client.tsx`

**🟠 Wysokie — jeszcze nierozwiązane:**
- **Punkt 6** — Złe kolory: `#ef7f1a` → `#e07818` w 6 plikach; `rgba(79,110,247,...)` → `rgba(224,120,24,...)` w `dashboard/page.tsx` i `DashboardCharts.tsx`
- **Punkt 7** — Hydration mismatch w `SettingsClient.tsx` — `useState` z `localStorage` w lazy init
- **Punkt 8** — Weryfikacja czy `proxy.ts` faktycznie działa jako middleware w produkcji

### Ważne zasady na przyszłość
- Zmiany wdrażać **po jednej na raz** — czekać na zatwierdzenie przez użytkownika przed przejściem do kolejnej.
- **Przed każdym commitem i pushem** zaktualizować `lib/version.ts` — wersja musi zgadzać się z numerem w tytule commita.
