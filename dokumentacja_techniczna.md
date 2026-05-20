# CRM 4DPF — Dokumentacja Techniczna

> Wersja systemu: v2.5 | Data: 2026-05-20

---

## 1. Cel systemu

CRM 4DPF to wewnętrzny system zarządzania firmą **4DPF**, zajmującą się sprzedażą i serwisem emulatorów DPF/DEF do maszyn budowlanych. System centralizuje w jednym miejscu:

- prowadzenie procesów sprzedażowych (leady, transakcje, wysyłki)
- obsługę klienta (sprawy supportu, logi rozmów i wiadomości)
- zarządzanie kadrami (kandydaci z OLX)
- bazę wiedzy o maszynach budowlanych (silniki, emulatory, wiązki)
- monitoring infrastruktury IT (domeny i hostingi z terminem wygaśnięcia)

System jest **w pełni wielorolowy** — każdy pracownik widzi tylko te moduły, które są potrzebne na jego stanowisku.

---

## 2. Stack technologiczny

### Frontend & Framework

| Technologia | Wersja | Rola |
|---|---|---|
| **Next.js** | 16.2.2 | Framework full-stack (App Router, Server Components, SSR) |
| **React** | 19.2.4 | Biblioteka UI |
| **TypeScript** | ^5 | Statyczne typowanie — bezpieczeństwo w całym projekcie |
| **Tailwind CSS** | v4 | Utility-first CSS (bez klas w JS — style inline przez CSS vars) |
| **Turbopack** | wbudowany | Bundler w trybie `dev` — szybki hot-reload |

### Backend & Baza danych

| Technologia | Wersja | Rola |
|---|---|---|
| **Supabase** | @supabase/ssr ^0.10 | Backend-as-a-Service: baza PostgreSQL + Auth + RLS |
| **@supabase/supabase-js** | ^2.101 | SDK do zapytań do bazy |

### Biblioteki pomocnicze

| Biblioteka | Rola |
|---|---|
| **next-intl** ^4.9 | Internacjonalizacja (i18n) — obsługa `/pl/` i `/en/` |
| **react-hook-form** ^7.72 | Zarządzanie formularzami (performance — re-rendery tylko przy zmianie pól) |
| **zod** ^4.3 | Walidacja schematów danych — TypeScript-first |
| **@hookform/resolvers** | Integracja zod ↔ react-hook-form |
| **recharts** ^3.8 | Wykresy na dashboardzie (BarChart dla trendów tygodniowych) |
| **lucide-react** ^1.7 | Ikony wektorowe SVG |
| **@radix-ui/react-dialog** | Prymityw modalny — dostępność (a11y), focus trap, Escape key |
| **@radix-ui/react-dropdown-menu** | Prymityw dropdown menu w Navbar |
| **class-variance-authority** | Helper do wariantów CSS klas |
| **clsx / tailwind-merge** | Łączenie klas Tailwind bez konfliktów |

---

## 3. Architektura systemu

```
Przeglądarka
     │
     ▼
Next.js 16 (App Router)
     │
     ├── proxy.ts ──────────────── middleware: auth guard, locale redirect
     │
     ├── app/[locale]/
     │     ├── (auth)/login/       strona logowania — Supabase Auth
     │     └── (dashboard)/        chronione widoki — Server + Client Components
     │           ├── page.tsx      Server Component: pobiera dane z Supabase, sprawdza sesję
     │           └── _components/
     │                 └── *Client.tsx   Client Component: stan, filtrowanie, CRUD, UI
     │
     ├── components/
     │     ├── layout/             Sidebar, Navbar — stałe elementy UI
     │     └── shared/             DataTable, Modal, ConfirmDialog, Pagination,
     │                             ThemeProvider, PageHeader, forms.tsx, Badge.tsx
     │
     ├── lib/
     │     ├── supabase/           klienty (server/client), typy, filtry kolumn
     │     └── auth/helpers.ts     requireAuth(), getCurrentUser(), getUserProfile()
     │
     └── app/api/admin/users/      API Route: zarządzanie użytkownikami (tylko admin)
           route.ts

     │
     ▼
Supabase (PostgreSQL + Auth)
     ├── auth.users                wbudowana tabela Auth (email, hasło, JWT)
     └── public.*                  tabele biznesowe (patrz sekcja 5)
```

### Wzorzec Server + Client Component

Każdy moduł działa według dwuwarstwowego wzorca:

1. **`page.tsx` (Server Component)** — wykonuje się na serwerze, autoryzuje sesję przez `requireAuth()`, pobiera pierwszą stronę danych z Supabase i przekazuje je jako props
2. **`*Client.tsx` (Client Component)** — działa w przeglądarce, zarządza stanem (filtry, paginacja, sortowanie), wykonuje kolejne zapytania przez Supabase JS SDK, obsługuje formularze CRUD

Zalety: **szybkie pierwsze ładowanie** (dane są gotowe w HTML), **brak widocznego loadera** przy wejściu na stronę, **interaktywność** po załadowaniu.

---

## 4. Autoryzacja i role

### Mechanizm autentykacji

Supabase Auth z JWT. Sesja przechowywana w HTTP-only cookie (obsługa przez `@supabase/ssr`). Przy każdym żądaniu `proxy.ts` (middleware) weryfikuje cookie i w razie braku sesji redirectuje na `/[locale]/login`.

### Funkcja `requireAuth(locale)`

Centralny punkt weryfikacji sesji w Server Components (`lib/auth/helpers.ts`):

```
requireAuth(locale)
  → getUser() z Supabase Auth
  → jeśli brak → redirect na /[locale]/login
  → getUserProfile(userId) z tabeli profiles
  → jeśli brak profilu → redirect na /[locale]/login
  → zwraca { user, profile }
```

### Role i dostęp do modułów

| Rola | Dostęp do modułów |
|---|---|
| **admin** | Wszystko + zarządzanie użytkownikami |
| **manager** | Wszystko oprócz zarządzania użytkownikami |
| **handlowiec** | Sales Deals, Sales Quality, Sales (zamówienia), Sales Text Log, Machines |
| **support** | Support Cases, Support Log, Support Text Log |
| **hr** | Kandydaci |
| **logistyka** | Sales (zamówienia), Machines |

Dostęp jest filtrowany **dwuwarstwowo**:
- **Sidebar** — Client Component renderuje tylko linki odpowiednie dla roli (`NAV_ITEMS.filter(item => item.roles.includes(role))`)
- **`page.tsx`** — Server Component weryfikuje rolę przed renderowaniem strony i redirectuje nieuprawnionego użytkownika

---

## 5. Baza danych — tabele i ich przeznaczenie

Baza PostgreSQL hostowana na Supabase. Tabele zabezpieczone przez **Row Level Security (RLS)**.

| Tabela Supabase | Typ TypeScript | Przeznaczenie |
|---|---|---|
| `profiles` | `Profile` | Rozszerzenie Supabase Auth — rola i imię pracownika |
| `OLX` | `OLXCandidate` | Kandydaci do pracy pozyskani z OLX — oceny punktowe |
| `Machines` | `Machine` | Baza maszyn budowlanych z parametrami silnika i emulatora |
| `Sales Deals` | `SalesDeal` | Leady/transakcje sprzedażowe — status, kontakt, podsumowanie |
| `Sales Quality` | `SalesQuality` | Oceny jakości rozmów handlowych (skala /10) |
| `Sales Text Log` | `SalesTextLog` | Historia wiadomości SMS/chat z klientami sprzedaży |
| `Sales` | `Sale` | Finalizowane zamówienia — faktura, wysyłka, tracking |
| `Support Case` | `SupportCase` | Sprawy serwisowe klientów — statusy, agent, rozwiązanie |
| `Support Log` | `SupportLog` | Logi rozmów supportu — transkrypt, czas trwania |
| `Support Text Log` | `SupportTextLog` | Historia wiadomości SMS/chat klientów supportu |
| `domains` | `Domain` | Domeny firmy z datami wygaśnięcia |
| `hostings` | `Hosting` | Serwery/hostingi z datami wygaśnięcia |

> Uwaga: Supabase wymaga dokładnych nazw tabel (case-sensitive, ze spacjami) — np. `'Sales Deals'`, `'Support Case'`.

---

## 6. Moduły systemu — szczegółowy opis

### Dashboard (`/dashboard`)
Widok startowy dla adminów i managerów. Zawiera:
- **4 karty KPI**: aktywne transakcje, otwarte sprawy supportu, kandydaci OLX, zamówienia w bieżącym miesiącu
- **2 wykresy słupkowe** (Recharts): trendy tygodniowe Sales Deals i Support Cases z ostatnich 8 tygodni
- **Ostatnia aktywność**: 8 najnowszych rekordów z Sales Deals i Support Cases

### Sales Deals (`/sales-deals`) — handlowiec, manager, admin
Główny CRM sprzedażowy. Każdy rekord to lead/transakcja z klientem:
- **Statusy**: `open` → `pending` → `in_progress` → `closed`
- Filtrowanie po sprzedawcy, kategorii silnika, statusie
- Pełny CRUD z modalem edycji
- Powiązanie z Sales Text Log przez `deal_id`

### Sales Quality (`/sales-quality`) — handlowiec, manager, admin
Ocena jakości rozmów handlowych przez managera/team leada:
- Skala **ocen /10** (zielony ≥7, żółty ≥4, czerwony <4)
- Pole `full_transcript` — pełna transkrypcja rozmowy
- Powiązanie z Sales Deals przez `deal_id`

### Sales (`/sales`) — handlowiec, logistyka, manager, admin
Finalizowane zamówienia (po zakończeniu negocjacji w Sales Deals):
- Dane wysyłkowe, fakturowe, numer trackingu kuriera
- Numer faktury PayPal
- Powiązanie z Machines przez `machine_id`

### Sales Text Log (`/sales-text-log`) — handlowiec, manager, admin
Archiwum wiadomości tekstowych (SMS/chat) w procesie sprzedaży:
- Kierunek: `IN` (od klienta) / `OUT` (do klienta)
- Pełna treść + podsumowanie AI
- Powiązanie z Sales Deals przez `deal_id`

### Support Cases (`/support-cases`) — support, manager, admin
Zarządzanie sprawami serwisowymi:
- **Statusy**: `open` → `in_progress` → `pending` → `resolved` → `closed`
- Śledzenie ostatniego agenta, kategorii problemu, silnika
- Powiązanie z Support Log przez `last_interaction_id`

### Support Log (`/support-log`) — support, manager, admin
Logi indywidualnych rozmów supportu:
- Czas trwania rozmowy, opis problemu, rekomendacja
- Pełna transkrypcja
- Powiązanie z Support Cases przez `case_id`

### Support Text Log (`/support-text-log`) — support, manager, admin
Archiwum wiadomości tekstowych supportu (analogicznie do Sales Text Log).

### Kandydaci (`/candidates`) — HR, manager, admin
Baza kandydatów pozyskanych z portalu OLX:
- Ocena punktowa w 4 kryteriach: wykształcenie, język, doświadczenie, ocena ogólna
- Link do CV (plik w Supabase Storage lub zewnętrzny URL)

### Machines (`/machines`) — handlowiec, logistyka, manager, admin
Baza maszyn budowlanych:
- Parametry: marka, model, rok, silnik, pojemność, numer seryjny
- Typ filtru: DPF / DEF
- Konfiguracja emulatora: model, wiązka, prosta rura
- Status zwrotu

### Domeny (`/domains`) i Hostingi (`/hostings`) — admin, manager
Monitoring infrastruktury IT firmy:
- Śledzenie dat wygaśnięcia (`due_date`)
- Automatyczne kolorowanie: zielony (>30 dni), żółty (≤30 dni), czerwony (≤7 dni lub po terminie)
- Sortowanie po liczbie pozostałych dni (`days_left` wyliczane po stronie klienta)

### Ustawienia (`/settings`) — wszyscy zalogowani
Profil użytkownika:
- Podgląd danych konta (email, imię, rola)
- Zmiana hasła (walidacja min. 6 znaków + zgodność)
- Wybór koloru akcentu (6 motywów: pomarańcz/niebieski/zielony/fioletowy/czerwony/morski)

### Admin — Zarządzanie użytkownikami (`/admin/users`) — tylko admin
Panel zarządzania kontami pracowników:
- Lista wszystkich użytkowników z rolami
- Tworzenie nowych kont (email + hasło + rola)
- Zmiana roli istniejącego użytkownika
- Usuwanie konta
- Operacje przez dedykowany API Route (`/api/admin/users`) z Supabase Admin SDK

---

## 7. System filtrowania — DataTable

Kluczowy komponent `components/shared/DataTable.tsx` implementuje filtrowanie w stylu **Google Sheets**:

### Typy filtrów (per kolumna)
| Warunek | Działanie |
|---|---|
| `contains` | Zawiera frazę (case-insensitive, `ilike %v%`) |
| `not_contains` | Nie zawiera frazy |
| `equals` | Dokładna zgodność (`.eq()`) |
| `not_equals` | Różny od wartości (`.neq()`) |
| `starts_with` | Zaczyna się od |
| `ends_with` | Kończy się na |
| `is_empty` | Pole puste / null |
| `is_not_empty` | Pole niepuste |
| `one_of` | Jeden z wybranych (multi-select checkboxy) |

### Dynamiczne filterOptions
Kolumny z predefiniowanymi wartościami (np. `salesman`, `category`, `detected_engine`) ładują unikalne opcje z bazy przy montowaniu komponentu i wyświetlają checkboxy zamiast pola tekstowego. Przyciski „Zaznacz wszystkie" / „Odznacz" dla wygody.

### Sortowanie
Kliknięcie nagłówka kolumny przełącza `asc`/`desc`. Sortowanie wykonywane po stronie Supabase (`.order()`), nie po stronie klienta.

### Paginacja
25 rekordów na stronę. `range(offset, offset+24)` po stronie Supabase.

### Resize kolumn
Drag na granicy nagłówka zmienia szerokość kolumny (stan lokalny, nie persistowany).

---

## 7a. Biblioteka shared — komponenty wielokrotnego użytku

W ramach refaktoru (v2.5) zduplikowane wzorce zostały wyciągnięte do `components/shared/`. Wszystkie moduły dashboardu konsumują te komponenty zamiast utrzymywać własne implementacje.

### `components/shared/forms.tsx`
Wspólne style i kontrolki formularzy:

| Eksport | Opis |
|---|---|
| `inputStyle` | Style inline dla `<input>` / `<select>` (tło `--surface`, border `--border`, padding, rounded) |
| `textareaStyle` | `inputStyle` + `minHeight: 72px` + `resize: vertical` |
| `FormField` | Opakowanie etykieta → input → komunikat błędu. Props: `label`, `error?`, `children` |
| `FormActions` | Stopka modala: przyciski **Anuluj** + **Zapisz**. Props: `onCancel`, `isSubmitting?`, `cancelLabel?`, `submitLabel?`, `submittingLabel?`, `className?` (np. `col-span-2` w siatkach 2-kolumnowych) |

Konsumenci: candidates, sales, sales-deals, sales-quality, support-cases, machines, machine-issues, domains, hostings, reviews, admin/users, support-backlog.

> `settings/_components/SettingsClient.tsx` używa własnego, lokalnego `FormField` z innym API (value/onChange/type/placeholder) i tłem `--surface-2`. Zostawione celowo — różny kontrast wizualny dla strony profilu.

### `components/shared/Badge.tsx`
Badge'e statusów i dat:

| Eksport | Opis |
|---|---|
| `getDiffDays(dateStr)` | Liczy dni od dziś do daty (helper) |
| `DueDateBadge` | Data + kolorowe tło: 🟢 >30 dni, 🟡 ≤30, 🔴 ≤7 lub po terminie. Ma `suppressHydrationWarning` (różnica UTC vs lokalna strefa) |
| `DaysLeftBadge` | Sama liczba pozostałych dni z tym samym schematem kolorów |
| `StatusBadge` | Generyczny pill ze statusem. Props: `status: string`, `colors: Record<string, string>` — moduł podaje własną mapę kolorów |
| `DirectionBadge` | IN/OUT pill dla logów tekstowych (sales-text-log, support-text-log) |

Konsumenci: domains + hostings (DueDate/DaysLeft), sales + sales-deals + support-cases + support-backlog (StatusBadge), sales-text-log + support-text-log (DirectionBadge).

### `components/shared/PageHeader.tsx`
Jednolity nagłówek strony — tytuł + opcjonalny podtytuł + opcjonalne akcje po prawej:

```
PageHeader({ title, subtitle?, actions?, className? })
```

Domyślny wrapper: `mb-6`. Gdy są `actions` — `mb-6 flex items-start justify-between gap-4`. `className=""` używane w `dashboard/page.tsx` (parent ma `flex flex-col gap-6`, więc nie trzeba dodatkowego marginesu).

Używane przez **wszystkie** moduły dashboardu (15 stron). Warianty z `actions`:
- `admin/users` — przyciski „Odśwież" + „Nowy użytkownik"
- `support-backlog` — przyciski „Aktualizacja" + „Nowa sprawa"

---

## 8. System motywów

Motywy kolorystyczne implementowane przez **CSS Custom Properties** (`var(--accent)` itd.) na `:root`. Zmiana motywu = podmiana 3 zmiennych CSS w runtime bez przeładowania strony.

Motywy: Pomarańcz (domyślny 4DPF), Niebieski, Zielony, Fioletowy, Czerwony, Morski.

Wybór zapisywany w `localStorage` klucz `crm-theme`. `ThemeProvider` (`components/shared/ThemeProvider.tsx`) wczytuje zapisany motyw przy starcie aplikacji.

---

## 9. Internacjonalizacja (i18n)

`next-intl` z `localePrefix: 'always'` — każdy URL zawiera prefiks języka:
- `/pl/dashboard` — polska wersja
- `/en/dashboard` — angielska wersja

Aktualnie tłumaczenia nawigacji są obsługiwane (`useTranslations('nav')` w Sidebar). Reszta UI jest po polsku (obszar do rozwoju).

---

## 10. Design System

### Paleta kolorów (dark mode — hardcoded)
Ciepłe neutralne szarości + pomarańcz marki 4DPF jako jedyny kolor akcentu.

```
--bg:           #181614   tło aplikacji
--sidebar:      #201d1a   sidebar
--surface:      #211e1b   karty, wiersze tabel
--surface-2:    #2a2620   modale, dropdowny
--border:       #2e2a25   obramowania
--text:         #e2d9ce   główny tekst
--text-muted:   #8a7f72   etykiety, podpisy
--accent:       #e07818   pomarańcz 4DPF — przyciski, aktywne stany
--danger:       #e8384f   błędy, status open (support)
--success:      #10a872   sukces, status resolved
--warning:      #e8a800   ostrzeżenia, status pending
```

### Zasada: akcent tylko na elementach interaktywnych
Przyciski, aktywne linki, focus ring, wskaźniki filtrów. Baza UI pozostaje neutralna szara.

---

## 11. Deployment & Środowisko

| Element | Technologia |
|---|---|
| Hosting aplikacji | Vercel (zalecany — natywna obsługa Next.js) |
| Baza danych | Supabase (hosted PostgreSQL na AWS) |
| Auth | Supabase Auth (JWT, email/password) |
| Zmienne środowiskowe | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Node.js | ≥ 18.x (wymagane przez Next.js 16) |

---

## 12. Kluczowe pliki — mapa nawigacji po kodzie

```
lib/
  auth/helpers.ts          → requireAuth(), getCurrentUser(), getUserProfile(), getRedirectPath()
  supabase/client.ts       → createClient() dla 'use client' komponentów
  supabase/server.ts       → createClient() dla Server Components (async, cookies)
  supabase/types.ts        → wszystkie typy TypeScript (Profile, Machine, SalesDeal, ...)
  supabase/filters.ts      → applyColumnFilters() — logika filtrowania per-kolumna

components/
  shared/DataTable.tsx     → główna tabela z filtrowaniem, sortowaniem, paginacją, resize
  shared/Modal.tsx         → modal z animacją i focus trap
  shared/ConfirmDialog.tsx → dialog potwierdzenia akcji (usuń)
  shared/Pagination.tsx    → nawigacja między stronami
  shared/ThemeProvider.tsx → init motywu z localStorage przy starcie
  shared/PageHeader.tsx    → tytuł strony + subtitle + actions (używany w 15 modułach)
  shared/forms.tsx         → inputStyle, textareaStyle, FormField, FormActions
  shared/Badge.tsx         → DueDateBadge, DaysLeftBadge, StatusBadge, DirectionBadge, getDiffDays
  layout/Sidebar.tsx       → sidebar z filtrowaniem po roli, zwijany
  layout/Navbar.tsx        → górny pasek z tytułem strony, dropdown użytkownika

app/
  layout.tsx               → root layout: fonty Geist, ThemeProvider, dark mode
  [locale]/layout.tsx      → NextIntlClientProvider — tłumaczenia
  [locale]/(dashboard)/layout.tsx  → Sidebar + Navbar — shell dashboardu
  api/admin/users/route.ts → REST API: create/update_role/delete użytkownika
  proxy.ts                 → middleware: guard auth + przekierowanie po roli
```

---

## 13. Przepływ danych — przykład (Sales Deals)

```
1. Użytkownik wchodzi na /pl/sales-deals
2. proxy.ts sprawdza cookie JWT → sesja OK
3. app/[locale]/(dashboard)/sales-deals/page.tsx (Server Component):
   a. requireAuth() → weryfikuje sesję, pobiera profil z bazy
   b. createClient() → pobiera pierwsze 25 rekordów Sales Deals z Supabase
   c. Renderuje <SalesDealsClient initialData={...} initialCount={...} role={...} />
4. Przeglądarka otrzymuje gotowy HTML z danymi (SSR)
5. React hydratuje SalesDealsClient (Client Component)
6. Użytkownik klika filtr "Status = open":
   a. setColumnFilters({ status: { condition: 'one_of', values: ['open'] } })
   b. useCallback fetchData() odpytuje Supabase z applyColumnFilters()
   c. Tabela renderuje przefiltrowane dane
7. Użytkownik klika "Dodaj" → Modal → react-hook-form + zod → supabase.insert() → fetchData()
```
