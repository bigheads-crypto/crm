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
      support-log, support-text-log, admin/users
proxy.ts                      → middleware (Next.js 16 używa proxy.ts zamiast middleware.ts)
lib/supabase/
  client.ts                   → createClient() dla Client Components
  server.ts                   → createClient() dla Server Components (async)
  types.ts                    → wszystkie typy TS + typ Role
components/shared/
  DataTable.tsx               → główna tabela z sortowaniem, filtrami per-kolumna, resize
  Modal.tsx, ConfirmDialog.tsx, Pagination.tsx
```

## Routing i auth (proxy.ts)
- Plik `proxy.ts` (nie `middleware.ts`) pełni rolę middleware
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
- Sortowanie: `sortKey`, `sortDir`, `onSortChange`
- Filtry per-kolumna: `columnFilters`, `onColumnFiltersChange` (debounce 400ms)
- Interfejs `Column<T>`: `key`, `header`, `render?`, `width?`, `sortable?`, `filterable?`
- `searchValue` / `onSearchChange` — **legacy, nie renderowane**, zachowane dla kompatybilności

## Wzorzec każdego modułu (np. CandidatesClient)
1. Server Component pobiera `initialData` + `initialCount` z Supabase
2. Client Component (`*Client.tsx`) zarządza stanem: `data, count, page, sortKey, sortDir`
3. `fetchData` w `useCallback` odpytuje Supabase z paginacją i sortowaniem
4. Filtrowanie per-kolumna działa przez `columnFilters` przekazywane do `fetchData`
5. CRUD przez Supabase client + `fetchData()` po każdej operacji
