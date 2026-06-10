# CRM 4DPF — referencja techniczna

> Wersja systemu: v2.77 · Stack: Next.js 16 · Supabase · n8n · Hosting: TrueNAS Scale + Dockge

Ten plik jest referencją czytaną na żądanie. Reguły zachowania agenta są w `CLAUDE.md`; lista otwartych poprawek w `TODO.md`.

---

## 1. Czym jest CRM 4DPF

Wewnętrzny system zarządzania firmą **4DPF** (sprzedaż i serwis emulatorów DPF/DEF do maszyn budowlanych). Centralizuje:

- procesy sprzedażowe (leady, transakcje, wysyłki)
- obsługę klienta (sprawy, logi rozmów, SMS)
- kadry (kandydaci z OLX)
- bazę wiedzy o maszynach budowlanych (silniki, emulatory, wiązki)
- monitoring infrastruktury (domeny, hostingi z terminami wygaśnięcia)
- moduł magazynu (Emulatory, Zestawy, Wiązki, Hardware, Software)

W pełni wielorolowy — każdy pracownik widzi tylko moduły potrzebne na jego stanowisku (macierz `tab_permissions` zarządzana z panelu admina).

Otoczenie: integracja z **n8n** (workflow oparte na webhookach + lokalny model AI dostarczający analizy transkrypcji rozmów handlowych i supportowych).

---

## 2. Stack

### Frontend & framework

| Tech | Wersja | Rola |
|---|---|---|
| Next.js | 16.2.2 | App Router, Server Components, SSR. **Breaking changes vs. starsze wersje.** |
| React | 19.2.4 | UI |
| TypeScript | ^5 | statyczne typowanie |
| Tailwind CSS | v4 | utility-first; w projekcie więcej stylów inline przez CSS vars |
| Turbopack | wbudowany | bundler w `dev` |

### Backend & DB

| Tech | Wersja | Rola |
|---|---|---|
| Supabase | `@supabase/ssr` ^0.10 | Postgres + Auth + RLS |
| `@supabase/supabase-js` | ^2.101 | SDK |

### Biblioteki pomocnicze

| Lib | Rola |
|---|---|
| `next-intl` ^4.9 | i18n (`/pl/`, `/en/`), `localePrefix: 'always'` |
| `react-hook-form` ^7.72 | formularze (re-rendery tylko przy zmianie pól) |
| `zod` ^4.3 | walidacja schematów, TS-first |
| `@hookform/resolvers` | integracja zod ↔ rhf |
| `recharts` ^3.8 | BarChart trendów tygodniowych na dashboardzie |
| `lucide-react` ^1.7 | ikony |
| `@radix-ui/react-dialog` | modal (focus trap, Escape) |
| `@radix-ui/react-dropdown-menu` | dropdown w Navbar |
| `class-variance-authority`, `clsx`, `tailwind-merge` | klasy CSS |

---

## 3. Struktura plików

```
app/
  page.tsx                          → redirect do /pl/login
  [locale]/
    page.tsx                        → redirect do /[locale]/login
    layout.tsx                      → NextIntlClientProvider
    (auth)/login/                   → strona logowania
    (dashboard)/                    → wszystkie chronione widoki
      dashboard, candidates, machines, sales, sales-deals,
      sales-quality, sales-text-log, support-cases, support-log,
      support-text-log, domains, hostings, reviews, support-backlog,
      machine-issues, warehouse/{emulatory,zestawy,wiazki,hardware,software},
      admin/{users,permissions},
      settings                      → profil użytkownika (zmiana hasła)
  api/
    admin/users/route.ts            → CRUD użytkowników (admin)
    admin/permissions/route.ts      → macierz uprawnień (admin)

proxy.ts                            → middleware (konwencja Next.js 16)

lib/
  supabase/
    client.ts                       → createClient() dla Client Components
    server.ts                       → createClient() dla Server Components (async)
    types.ts                        → wszystkie typy TS + typ Role
    filters.ts                      → ColumnFilter/ColumnFilters + applyColumnFilters()
  auth/helpers.ts                   → requireAuth(locale) → { user, profile }
  permissions-config.ts             → TAB_DEFS, ALL_ROLES, PERM_TYPES, DEFAULT_VIEW_MAP
  permissions.ts                    → getAllowedTabs(role) — server function
  version.ts                        → APP_VERSION (bumpować przed commitem)

components/
  layout/
    Sidebar.tsx, Navbar.tsx
  shared/
    DataTable.tsx                   → tabela z sortowaniem, filtrami per-kolumna, resize
    Modal.tsx, ConfirmDialog.tsx, Pagination.tsx
    ThemeProvider.tsx               → init motywu z localStorage
    forms.tsx                       → inputStyle, textareaStyle, FormField, FormActions
    Badge.tsx                       → DueDateBadge, DaysLeftBadge, StatusBadge,
                                       DirectionBadge, getDiffDays
    PageHeader.tsx                  → wspólny nagłówek strony (title + subtitle + actions)

i18n/
  pl.json, en.json                  → wszystkie klucze tłumaczeń
```

---

## 4. Routing i auth

- `proxy.ts` (nie `middleware.ts`) pełni rolę middleware w Next.js 16.
- Niezalogowany → redirect do `/${locale}/login`.
- Zalogowany wchodzący na `/login` → redirect do strony właściwej dla roli (patrz `getRedirectPath`).
- Role: `admin | manager | handlowiec | support | hr | logistyka` + niestandardowe role z UI panelu uprawnień (v2.68).

**Wzorzec auth w Server Component:**

```ts
import { requireAuth } from '@/lib/auth/helpers'
const { user, profile } = await requireAuth(locale)
// profile.role = 'admin' | 'manager' | ...
```

Nigdy nie używaj `user!.id` — `requireAuth` sam obsłuży brak sesji (redirect na `/login`).

---

## 5. Baza danych — tabele Supabase

| Tabela | Typ TS |
|---|---|
| `OLX` | `OLXCandidate` |
| `Machines` | `Machine` |
| `Machine Issues` | `MachineIssue` |
| `Sales` | `Sale` |
| `Sales Deals` | `SalesDeal` |
| `Sales Quality` | `SalesQuality` |
| `Sales Text Log` | `SalesTextLog` |
| `Support Case` | `SupportCase` |
| `Support Log` | `SupportLog` |
| `Support Text Log` | `SupportTextLog` |
| `Support Backlog` | `SupportBacklog` |
| `domains` | `Domain` |
| `hostings` | `Hosting` |
| `Opinie` | `Review` |
| `Products` | `Product` (moduł Emulatory w Magazynie) |
| `Zestawy` | `Zestaw` |
| `Wiazki` | `Wiazka` |
| `Hardware` | `Hardware` |
| `Software` | `Software` |
| `activity_logs` | `ActivityLog` (interfejs lokalny w `ActivityLogClient.tsx`) |
| `profiles` | `Profile` (rozszerzenie Supabase Auth) |
| `tab_permissions` | macierz uprawnień (rola × zakładka) |

**Konwencje nazewnictwa:** większość tabel ma **spacje** i wielką literę — `Sales Deals`, `Support Case`, `Machine Issues`. Wyjątki: `domains`, `hostings` (lowercase), `OLX` (all-caps). Supabase jest case-sensitive.

### Punktacja / oceny

- **Kandydaci** (`OLXCandidate`): skala **/100** — zielony ≥ 70, żółty ≥ 40, czerwony < 40
- **Sales Quality** (`SalesQuality`): skala **/10** — zielony ≥ 7, żółty ≥ 4, czerwony < 4

---

## 6. Wzorzec modułu (`*Client.tsx`)

1. Server Component pobiera `initialData` + `initialCount` z Supabase.
2. Client Component zarządza stanem: `data, count, page, sortKey, sortDir, columnFilters`.
3. `fetchData` w `useCallback` odpytuje Supabase: `applyColumnFilters(query, columnFilters)` + order + range.
4. **`useEffect(() => { fetchData() }, [fetchData])`** — WYMAGANE. `useCallback` zmienia referencję `fetchData` przy zmianie deps, `useEffect` wychwytuje i wywołuje fetch.
5. DataTable otrzymuje `columnFilters` + `onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}`.
6. CRUD przez Supabase client + `fetchData()` po każdej operacji.

---

## 7. Biblioteka shared — komponenty wielokrotnego użytku

Po refaktorze (sesja 2026-05) zduplikowane wzorce wyciągnięto do `components/shared/`. Wszystkie moduły konsumują te komponenty zamiast duplikować kod lokalnie.

### `forms.tsx`

- **`inputStyle`** / **`textareaStyle`** — wspólne style inline dla `<input>` / `<textarea>` / `<select>` (tło `--surface`, border `--border`, kolor `--text`, padding, rounded).
- **`FormField`** — opakowanie etykieta + child input + komunikat błędu. Props: `label`, `error?`, `children`.
- **`FormActions`** — przyciski Anuluj/Zapisz w stopce modala. Props: `onCancel`, `isSubmitting?`, `cancelLabel?`, `submitLabel?`, `submittingLabel?`, `className?` (do nadania `col-span-2` w siatkach 2-kolumnowych).

Używane w: candidates, sales, sales-deals, sales-quality, support-cases, machines, machine-issues, domains, hostings, reviews, admin/users, support-backlog.

> Settings ma własny lokalny `FormField` z innym API (value/onChange/type/placeholder + bg `--surface-2`) — **świadomie nie używa** shared/forms.

### `Badge.tsx`

- **`getDiffDays(dateStr)`** — wylicza liczbę dni do podanej daty.
- **`DueDateBadge`** — data z kolorowym tłem wg progów: zielony >30 dni, żółty ≤30, czerwony ≤7 / po terminie. `suppressHydrationWarning` w środku.
- **`DaysLeftBadge`** — sama liczba pozostałych dni, ten sam schemat kolorów.
- **`StatusBadge`** — generyczny. Props: `status: string`, `colors: Record<string, string>` (mapa kolorów lokalna w komponencie).
- **`DirectionBadge`** — IN/OUT badge dla logów tekstowych (sales-text-log, support-text-log).

`DueDateBadge` / `DaysLeftBadge` używane w domains + hostings. `StatusBadge` zastąpił 4 lokalne implementacje (sales, sales-deals, support-cases, support-backlog) — każdy moduł podaje swoją mapę `STATUS_COLORS`.

### `PageHeader.tsx`

Jednolity nagłówek strony — tytuł + opcjonalny `subtitle` + opcjonalne `actions` po prawej.

- Props: `title: string`, `subtitle?: ReactNode`, `actions?: ReactNode`, `className?: string`.
- Domyślny wrapper: `mb-6` (lub `mb-6 flex items-start justify-between gap-4` gdy są `actions`).
- `className=""` używane w `dashboard/page.tsx` (parent `flex flex-col gap-6` daje odstęp przez `gap`).

Używane przez wszystkie moduły dashboardu (15 stron). `admin/users` i `support-backlog` używają `actions` prop dla przycisków „Odśwież / Nowy użytkownik" i „Aktualizacja / Nowa sprawa".

---

## 8. DataTable — komponent współdzielony

- Props: `data`, `columns`, `totalCount`, `page`, `onPageChange`, `pageSize`.
- Sortowanie: `sortKey`, `sortDir`, `onSortChange` — klik nagłówka przełącza asc/desc.
- Filtry per-kolumna: `columnFilters: ColumnFilters`, `onColumnFiltersChange`.
- Interfejs `Column<T>`: `key`, `header`, `render?`, `width?`, `sortable?`, `filterable?`, `filterOptions?`.
- `searchValue` / `onSearchChange` — **legacy, nie renderowane**, zachowane dla kompatybilności.

Dropdown per kolumna (Google Sheets style) — ikona lejka w nagłówku otwiera popup z:

- sekcją sortowania (A→Z / Z→A)
- sekcją filtru: select warunku + pole wartości (kolumny zwykłe) LUB checkboxy multi-select (kolumny z `filterOptions`)
- przyciskami: Wyczyść filtr / Anuluj / Zastosuj
- Enter w polu wartości = Zastosuj

Aktywny filtr = niebieski pasek pod nagłówkiem kolumny. Dropdown renderowany przez `createPortal` na `document.body` (omija clipping przez `overflow`).

---

## 9. Filtry kolumn — `lib/supabase/filters.ts`

- Typ `FilterCondition`: `contains | not_contains | equals | not_equals | starts_with | ends_with | is_empty | is_not_empty | one_of`
- Typ `ColumnFilter`: `{ condition: FilterCondition, value: string, values?: string[] }`. `values` używane tylko gdy `condition === 'one_of'`.
- Typ `ColumnFilters`: `Record<string, ColumnFilter>`.
- Funkcja `applyColumnFilters(query, filters)` aplikuje wszystkie filtry do zapytania Supabase.

Mapowanie na Supabase:

| Warunek | Supabase |
|---|---|
| `contains` | `ilike %v%` |
| `not_contains` | `filter not.ilike` |
| `equals` | `.eq(key, v)` |
| `not_equals` | `.neq(key, v)` |
| `starts_with` | `ilike v%` |
| `ends_with` | `ilike %v` |
| `is_empty` | `or(col.is.null,col.eq.)` |
| `is_not_empty` | `not is null` |
| `one_of` | `.in(key, values)` |

---

## 10. `filterOptions` — multi-select checkboxy

Kolumna z `filterOptions: string[]` pokazuje checkboxy zamiast pola tekstowego.

- Można zaznaczyć wiele wartości (np. status `open` + `closed`).
- W dropdownie są przyciski **„Zaznacz wszystkie"** i **„Odznacz"** (v1.8).
- Lista checkboxów: `maxHeight: 220px` z przewijaniem.
- Warunek renderowania: `filterOptions?.length` (nie samo `filterOptions`) — pusta tablica cofa się do trybu tekstowego.

### Statyczne vs. dynamiczne

- **Statyczne** (znane z góry): `filterOptions: ['val1', 'val2']` bezpośrednio w definicji kolumny.
  - Używane dla: `status` (Sales, SalesDeals, SupportCases).
- **Dynamiczne** (z bazy): `useState<string[]>([])` + `useEffect` na mount + `useMemo` dla kolumn.
  - Używane dla: `salesman` (Sales, SalesDeals, SalesQuality), `category` (SalesDeals, SalesQuality, SupportLog, SupportCases), `detected_engine` (SalesDeals, SalesQuality, SupportLog, SupportCases), `support_agent` (SupportLog), `last_agent` (SupportCases).
  - Wzorzec: `supabase.from('Tabela').select('kolumna').not('kolumna', 'is', null)` → deduplika `[...new Set(...)]` → `.sort()`.

### Wzorzec dynamicznych `filterOptions`

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

// 3. Kolumny jako useMemo (NIE stała modułowa!)
const columns = useMemo<Column<T>[]>(() => [
  { key: 'kolumna1', header: 'Nagłówek', filterOptions: filterOptionsMap.kolumna1 },
  // ...
], [filterOptionsMap])
```

> Gdy kolumny mają dynamiczne `filterOptions`, muszą być definiowane jako `useMemo` wewnątrz komponentu — nie jako stała `const COLUMNS = [...]` poza komponentem.

---

## 11. System uprawnień zakładek (v2.2 → v2.68)

### Tabela `tab_permissions`

```sql
CREATE TABLE tab_permissions (
  role text NOT NULL,
  tab_key text NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  can_write boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT true,
  PRIMARY KEY (role, tab_key)
);
ALTER TABLE tab_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_tab_permissions"
ON tab_permissions FOR SELECT TO authenticated USING (true);
```

### Pliki

- `lib/permissions-config.ts` — `TAB_DEFS`, `ALL_ROLES`, `PERM_TYPES`, `getDefaultPerms()`, `DEFAULT_VIEW_MAP`
- `lib/permissions.ts` — server function `getAllowedTabs(role)`: admin → wszystko, reszta → DB + fallback do domyślnych
- `app/api/admin/permissions/route.ts` — GET zwraca macierz, POST upsertuje `(role, tab_key, can_view, can_write, can_edit)`
- `app/[locale]/(dashboard)/admin/permissions/` — panel admina z macierzą checkboxów + UI dodawania/usuwania custom ról (v2.68)

### Jak działa

- `DashboardLayout` wywołuje `getAllowedTabs(role)` server-side i przekazuje `allowedTabs: string[]` do `Sidebar`.
- `Sidebar` filtruje `NAV_ITEMS` po `allowedTabs` (tab key = `item.href` bez wiodącego `/`).
- Admin zawsze ma wszystkie zakładki (early return bez zapytania DB).
- Fallback do `DEFAULT_VIEW_MAP` gdy tabela nie istnieje (try/catch w `getAllowedTabs`).
- `can_write` i `can_edit` są zapisywane w DB i wykorzystywane przez logi (support-log, support-text-log, sales-text-log) od v2.67.
- Role niestandardowe (v2.68) nie są w `types.ts` ani twardo w sidebarze — dodawane wyłącznie przez UI panelu uprawnień.

---

## 12. Strona ustawień użytkownika (`/settings`)

- Dostępna dla wszystkich zalogowanych ról — link w dropdown menu Navbar (ikona użytkownika, góra prawa).
- `app/[locale]/(dashboard)/settings/page.tsx` — Server Component pobierający `email`, `full_name`, `role` z Supabase.
- `settings/_components/SettingsClient.tsx` — Client Component z:
  - kartą informacji (email, imię i nazwisko, rola)
  - formularzem zmiany hasła (`supabase.auth.updateUser({ password })`) — walidacja min. 6 znaków + zgodność
- Tytuł w Navbar: klucz `settings` → `'Profil użytkownika'` w `PATH_TO_TITLE`.

---

## 13. Design system v1.7

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

**Nigdy nie hardkoduj** (patrz CLAUDE.md): `#ef7f1a`, `#4f6ef7`, `#3d5ce0`, `rgba(79,110,247,…)`. Zawsze `var(--accent)` lub `rgba(224,120,24,…)`.

### Kolory statusów (hardkodowane w komponentach)

Statusy mają własne kolory niezależne od `--accent`:

| Stan / rola | Kolor |
|---|---|
| `new`, `in_progress`, rola `handlowiec` | `#e07818` (akcent marki) |
| `open` (support) | `#e8384f` (danger) |
| `pending` | `#e8a800` (warning) |
| `delivered`, `resolved`, rola `hr` | `#10a872` (success) |
| `shipped`, rola `manager` | `#a855f7` (fiolet) |
| `cancelled`, `closed`, rola `admin` | `#ef4444` / `#6b7280` |
| Badge kierunku `OUT` (text logi) | `#e07818` |

### Typografia

- Font: Geist Sans (Next.js font system) — `var(--font-sans)` w `body`.
- **Nie używaj** `Arial` ani `Helvetica` bezpośrednio — Geist ładuje się przez `--font-sans`.

### Komponenty UI

**Sidebar** (`components/layout/Sidebar.tsx`):

- Logo: obramówka `border: 1.5px solid var(--accent)` wokół tekstu „4DPF / CRM System" — pełna szerokość.
- Aktywny link: tło `rgba(239,127,26,0.12)` + lewy border `2px solid var(--accent)`.
- Zwinięty sidebar: pokazuje tylko „4D" w kolorze akcentu.
- Box shadow: `2px 0 12px rgba(0,0,0,0.3)` dla głębi.

**DataTable** (`components/shared/DataTable.tsx`):

- Nagłówek: `var(--surface-2)`, `2px solid var(--border)` border-bottom, tekst uppercase 11px / 600.
- Striping: parzyste `transparent`, nieparzyste `rgba(255,255,255,0.03)`.
- Hover wiersza: `rgba(239,127,26,0.07)` — zarządzany przez `hoveredRow` state.
- Kolory w dropdownie filtru/sortowania: `rgba(239,127,26,…)` — bez niebieskiego.

**Modal** (`components/shared/Modal.tsx`):

- Overlay: `backdrop-filter: blur(12px)` + `rgba(0,0,0,0.65)` + animacja `overlayShow`.
- Panel: animacja `contentShow` (scale 0.94→1 + fade, cubic-bezier sprężysty 0.28s).
- Box-shadow: trójwarstwowy — pomarańczowa obwódka + głęboki cień + poświata.
- Górna linia: gradient `var(--accent)` → `#fdb909` → transparent.
- Przycisk zamknięcia: hover → pomarańczowy.

**Animacje** (zdefiniowane w `app/globals.css`):

- `overlayShow` / `overlayHide` — blur 0→12px + opacity.
- `contentShow` / `contentHide` — scale + opacity + translateY.

**Focus state** (globalny CSS):

```css
input:focus, select:focus, textarea:focus {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 3px rgba(239, 127, 26, 0.15);
}
```

Działa automatycznie na wszystkich polach — nie dodawaj `:focus` inline.

---

## 14. Znane pułapki

- Tabela `OLX` (`OLXCandidate`) **nie ma kolumny `created_at`** — domyślny `sortKey` musi być `'id'`, nie `'created_at'`.
- Pozostałe tabele mają `created_at` i mogą używać go jako domyślnego sortowania.
- **Kolumny wyliczane** (np. `days_left`) nie istnieją w bazie — przy sortowaniu mapuj na realną kolumnę DB przed wysłaniem do Supabase. Wzorzec: `const dbSortKey = sortKey === 'days_left' ? 'due_date' : sortKey`.
- **Hydration mismatch z `new Date()`** — komponenty renderujące wartości zależne od aktualnego czasu (różnica dni, sformatowana data) muszą mieć `suppressHydrationWarning` na elemencie ze zmienną treścią. Serwer (UTC) i klient (inna strefa) liczą różne wartości → React regeneruje drzewo. Dotyczy `DaysLeftBadge` i `DueDateBadge` w `hostings` i `domains`.
- **`useState` z `localStorage` w lazy init** = anty-pattern w RSC. Zacznij od wartości domyślnej, hydratuj w `useEffect`. Patrz TODO.md pkt 7.
- **`proxy.ts` jako middleware** — niepotwierdzone czy faktycznie blokuje routes w produkcji (Next.js 16 wprowadza eksperymentalny Proxy z `proxy.ts`, ale to nie tożsame z `middleware`). Każda strona broni się dodatkowo przez `requireAuth`. Patrz TODO.md pkt 8.

---

## 15. Status refactoringu — co już zrobione

**✅ Punkt 1 — `requireAuth()` we wszystkich stronach (sesja 2026-04-28)**
13 stron dashboardowych używa `requireAuth()` z `lib/auth/helpers.ts` zamiast `user!.id`. Wygasła sesja → bezpieczny redirect zamiast crash.

**✅ Punkt 2 — `equals`/`not_equals` w `lib/supabase/filters.ts` (sesja 2026-04-28)**
`equals` z `.ilike(key, v)` → `.eq(key, v)`. `not_equals` z `.filter(key, 'not.ilike', v)` → `.neq(key, v)`.

**✅ v2.66 — `can_write`/`can_edit` z bazy** zamiast hardkodowanych ról.
**✅ v2.67 — uprawnienia CRUD** w logach (support-log, support-text-log, sales-text-log).
**✅ v2.68 — role niestandardowe** dodawane przez UI panelu uprawnień.
**✅ v2.77 — moduł Magazyn** (Emulatory / Zestawy / Wiązki / Hardware / Software) + sidebar z grupami.

Otwarte poprawki: patrz `TODO.md`.
