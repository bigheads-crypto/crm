# CRM 4DPF — instrukcje dla agenta

Ten plik jest auto-ładowany. Zawiera **tylko reguły zachowania**. Pełna referencja techniczna (struktura plików, tabele DB, design system, komponenty shared, znane pułapki) jest w `DOCS.md` — czytaj na żądanie, jeśli zadanie tego wymaga. Otwarta lista poprawek do zrobienia jest w `TODO.md`.

---

## Stack — minimum do zapamiętania

- **Next.js 16.2.2** (Turbopack) — breaking changes vs. starsze wersje. Twoja wiedza z treningu jest nieaktualna. Przed pisaniem kodu Next.js (routing, middleware, layout, metadata, server actions) czytaj `node_modules/next/dist/docs/`.
- **Middleware to `proxy.ts`** w roocie (nie `middleware.ts`) — konwencja Next.js 16.
- **Supabase** (`@supabase/ssr`) — auth + Postgres. Tabele mają nazwy **ze spacjami** i z dużej litery (`Sales Deals`, `Support Case`). Lista tabel w `DOCS.md`.
- **next-intl** — i18n, locale prefix `always` (`/pl/...`, `/en/...`).
- **react-hook-form + zod** — formularze i walidacja.

## Zasady pracy

1. **Zmiany jedna na raz.** Po każdej zmianie zatrzymaj się i czekaj na akceptację użytkownika, zanim przejdziesz do kolejnej.
2. **Nie commituj sam.** Commit i push wykonuj **wyłącznie na wyraźną prośbę użytkownika** ("zacommituj", "zrób commit", "wypchnij"). Nigdy nie z własnej inicjatywy, nawet po dużej zmianie.
3. **Bump `lib/version.ts` jako część commita.** Numer w `lib/version.ts` zawsze ma się zgadzać z numerem w tytule commita. Aktualnie `APP_VERSION = '2.77'`. Reguły wyboru numeru przy prośbie o commit:
   - **„zacommituj vX.Y …"** (numer podany wprost) → użyj `X.Y`.
   - **„zmień wersję i zacommituj …"** (prośba o zmianę bez numeru) → auto-inkrementuj ostatnią cyfrę o 1 (`2.77 → 2.78`, `2.78 → 2.79`). Major/minor bump tylko gdy użytkownik wprost poda („zmień na 3.0").
   - **„zacommituj"** (samo, bez wzmianki o wersji) → spytaj jednym pytaniem „jaki numer wersji?", nie zgaduj.
   - **„zacommituj bez bumpu" / „użyj tej samej wersji"** → commit bez edycji `lib/version.ts`.
4. **Nie dodawaj `Co-Authored-By: Claude…`** w commit messages.

## i18n — zasada twarda

**WSZYSTKIE** stringi widoczne dla użytkownika muszą iść przez `useTranslations()` z `next-intl`. Nigdy nie hardkoduj polskich napisów w komponentach.

```tsx
// ✅
const t = useTranslations('warehouse')
<PageHeader title={t('title')} subtitle={t('subtitle')} />

// ❌
<PageHeader title="Emulatory" />
```

Nowe klucze dopisuj równolegle do `i18n/pl.json` i `i18n/en.json`. Dotyczy: tytułów stron, nagłówków kolumn, etykiet form, komunikatów błędów, przycisków.

> Stan obecny: znaczna część UI ma hardkodowane polskie stringi (legacy) — patrz TODO.md pkt 12. Nowy kod ma już używać `useTranslations`.

## Kolory — zasada twarda

`--accent` to `#e07818` (pomarańcz 4DPF). Nigdy nie hardkoduj:

- `#ef7f1a` — zły wariant pomarańczu, używaj `#e07818` lub `var(--accent)`
- `#4f6ef7`, `#3d5ce0`, `rgba(79,110,247,…)` — stary niebieski, zastąpiony; używaj `var(--accent)` / `rgba(224,120,24,…)`

Pełna paleta + status colors w `DOCS.md`.

## Wzorzec każdego modułu

1. Server Component (`page.tsx`) używa **`requireAuth(locale)`** z `lib/auth/helpers.ts` (nigdy `user!.id`) i pobiera `initialData` + `initialCount` z Supabase.
2. Client Component (`*Client.tsx`) trzyma stan: `data, count, page, sortKey, sortDir, columnFilters`.
3. `fetchData` w `useCallback` → `applyColumnFilters(query, columnFilters)` + order + range.
4. **`useEffect(() => { fetchData() }, [fetchData])`** — bez tego filtry/sort/paginacja nie działają. `useCallback` zmienia referencję `fetchData` przy zmianie deps, `useEffect` wychwytuje i wywołuje fetch.
5. DataTable dostaje `columnFilters` + `onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}`.
6. Po każdym CRUD-zie wywołuj `fetchData()`.

## Shared komponenty — zasada twarda

Jeśli piszesz **komponent React** używany w więcej niż jednym module — **trafia do `components/shared/`**, nie zostaje lokalny.

```
// ✅ Nowy badge statusu używany w 2+ miejscach
components/shared/StatusBadge.tsx

// ❌ Lokalny komponent w jednym module, który potem duplikujesz
app/[locale]/(dashboard)/sales/_components/StatusBadge.tsx
```

Co już jest w `components/shared/`: `DataTable`, `Modal`, `ConfirmDialog`, `Pagination`, `Badge`, `forms`, `PageHeader`, `ThemeProvider`. Przed napisaniem nowego komponentu sprawdź czy nie ma tam już gotowego.

> **`components/shared/` = tylko pliki `.tsx` (komponenty React). Stałe TS, helpery, typy — NIE tutaj.**

## Stałe konfiguracyjne — zasada twarda

Stałe i helpery używane w więcej niż jednym pliku **nie mogą być duplikowane** — trafiają do `lib/`:

- **`PAGE_SIZE`** / **`PAGE_SIZE_LARGE`** (rozmiar strony w paginacji) → `lib/constants.ts`
- **`role labels`** (nazwy ról po polsku/angielsku) → `i18n/pl.json` + `i18n/en.json`
- **Status colors / status labels** (kolory i etykiety statusów per moduł) → `lib/constants.ts` lub namespace w `i18n/`

```ts
// ✅ lib/constants.ts  ← stałe TS, nie components/shared/
export const PAGE_SIZE = 25
export const PAGE_SIZE_LARGE = 50

// ❌ każdy *Client.tsx z własnym const PAGE_SIZE = 25
```

Podział jest ostry: `components/shared/` → React, `lib/` → logika/stałe/typy TS.

## CRUD — obsługa błędów

Każdy `insert/update/delete` na Supabase **musi** sprawdzać `{ error }`. Nie zostawiaj cichych awarii (RLS może odrzucić, użytkownik zobaczy „sukces"). Patrz TODO.md pkt 5.

## Hydration mismatch

Komponenty zależne od `new Date()` (różnice dni, formatowane daty) muszą mieć `suppressHydrationWarning` na elemencie ze zmienną treścią. Serwer (UTC) i klient (inna strefa) liczą różne wartości. Dotyczy `DueDateBadge`/`DaysLeftBadge` w `hostings`/`domains`.

`useState` z `localStorage` w lazy init = anty-pattern w RSC — używaj `useState(defaultValue)` + `useEffect` do hydratacji.

## Gdzie szukać szczegółów

| Pytanie | Plik |
|---|---|
| Jakie są tabele DB, jak nazywają się typy TS? | `DOCS.md` → „Baza danych" |
| Jak działa DataTable / filtry / filterOptions? | `DOCS.md` → „DataTable" / „Filtry kolumn" |
| Jakie komponenty są w `components/shared/`? | `DOCS.md` → „Biblioteka shared" |
| Paleta kolorów, status colors, animacje? | `DOCS.md` → „Design system" |
| Jak działa system uprawnień zakładek? | `DOCS.md` → „System uprawnień" |
| Znane pułapki (OLX bez `created_at`, computed cols)? | `DOCS.md` → „Znane pułapki" |
| Co jest do zrobienia w kodzie? | `TODO.md` |
