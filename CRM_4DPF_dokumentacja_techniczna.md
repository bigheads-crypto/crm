**4DPF** C R M  S Y S T E M a 

## **techniczna** 

Wewnętrzny system CRM 4DPF — architektura aplikacji, infrastruktura serwerowa, deployment i konfiguracja środowiska. 

WERSJA SYSTEMU **v2.77** I STACK **Next.js 16 · Supabase · n8n** I 

DATA DOKUMENTU **27 maja 2026** HOSTING **TrueNAS Scale · Dockge** 

Dokumentacja przygotowana dla zespołu 4DPF • dystrybucja wewnętrzna 

**4DPF** 

## **Spis treści** 

**==> picture [494 x 323] intentionally omitted <==**

**----- Start of picture text -----**<br>
1. Wprowadzenie i cel systemu 3<br>2. Stack technologiczny 4<br>3. Architektura infrastruktury 5<br>4. Deployment — GitHub → TrueNAS → Dockge 8<br>5. Konfiguracja środowiska 11<br>6. Architektura aplikacji Next.js 14<br>7. Baza danych Supabase 17<br>8. Moduły CRM — przegląd funkcjonalny 20<br>9. System uprawnień i ról 23<br>10. Komponenty współdzielone 25<br>11. Pułapki i troubleshooting 27<br>**----- End of picture text -----**<br>


CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 2 / 33 

**4DPF** 

## **1. Wprowadzenie i cel systemu** 

**CRM 4DPF** to wewnętrzny system zarządzania firmą 4DPF, zajmującą się sprzedażą i serwisem emulato‐ rów DPF/DEF do maszyn budowlanych. Aplikacja centralizuje w jednym miejscu procesy sprzedażowe, obsługę klienta, kadry oraz monitoring infrastruktury IT firmy. 

## **Co system robi** 

System obsługuje pełen cykl pracy firmy w jednym narzędziu webowym. Każdy pracownik widzi tylko te moduły, które są potrzebne na jego stanowisku — system jest _w pełni wielorolowy_ i kontrolowany przez macierz uprawnień zarządzaną z poziomu panelu admina. 

**==> picture [496 x 69] intentionally omitted <==**

**----- Start of picture text -----**<br>
15 17 6 2<br>MODUŁÓW TABEL DB RÓL JĘZYKI UI<br>**----- End of picture text -----**<br>


|**Główne obszary**|**funkcjonalne**|
|---|---|
|**OBSZAR**|**MODUŁY**|
|**Sprzedaż**|Sales Deals (leady), Sales Quality (oceny rozmów), Sales (fnalizowane|
||zamówienia), Sales Text Log (SMS)|
|**Obsługa klienta**|Support Cases, Support Log (rozmowy), Support Text Log (SMS),|
||Support Backlog, Reviews (opinie)|
|**Kadry**|Candidates (kandydaci z OLX z punktową oceną)|
|**Baza wiedzy**|Machines (maszyny budowlane), Machine Issues (powtarzające się|
||problemy)|
|**Infrastruktura**|Domains, Hostings (z datami wygaśnięcia)|
|**Administracja**|Users (zarządzanie kontami), Permissions (macierz uprawnień), Activity|
||Log|



CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 3 / 33 

**4DPF** 

## **Otoczenie systemu** 

CRM jest częścią szerszego ekosystemu firmy 4DPF. Współpracuje z platformą automatyzacji **n8n** (work‐ ‐ flow oparte na webhookach i lokalnym modelu AI), korzysta z **Supabase** jako backendu (baza Postgre SQL + Auth + RLS) oraz z lokalnego silnika **AI** , który dostarcza analizy transkrypcji rozmów handlowych i supportowych. 

**KONWENCJA NAZEWNICTWA** Większość tabel w Supabase ma nazwy ze **spacjami** i z dużej 

litery ( `Sales Deals` , `Support Case` , `Support Log` ). Trzeba o tym pamiętać przy każdym zapytaniu — Supabase jest case-sensitive. 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 4 / 33 

**4DPF** 

## **2. Stack technologiczny** 

## **Frontend i framework** 

|**TECHNOLOGIA**|**WERSJA**|**ROLA**|||||
|---|---|---|---|---|---|---|
|**Next.js**|16.2.2|Framework full-stack — App Router, Server|||Components, SSR.||
|||**Uwaga:**Next 16 ma breaking changes; konwencja|||||
|||`middleware.ts`|została zastąpiona przez||<br>`proxy.ts`|.|
|**React**|19.2.4|Biblioteka UI|||||
|**TypeScript**|^5|Statyczne typowanie w całym projekcie|||||
|**Tailwind CSS**|v4|Utility-frst CSS —|w połączeniu ze stylami inline opartymi o CSS||||
|||variables|||||
|**Turbopack**|wbudowany|Bundler trybu<br>`dev`||— szybki hot-reload|||



## **Backend i baza** 

|**TECHNOLOGIA**||**ROLA**|
|---|---|---|
|**Supabase**(self-hosted)||PostgreSQL + Auth + Storage + RLS — w naszej instalacji postawione na|
|||TrueNAS jako kontener Docker, wystawione przez Cloudfare Tunnel pod|
|||adresem<br>`supabase.custogo.com`|
|`@supabase/ssr`|^0.10|Integracja Supabase z Next.js Server Components (sesja w HTTP-only|
|||cookie)|
|`@supabase/supabase-js`||SDK do zapytań w Client Components|
|^2.101|||



CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 5 / 33 

**4DPF** 

## **Biblioteki pomocnicze** 

|**BIBLIOTEKA**|**ROLA**|||||||
|---|---|---|---|---|---|---|---|
|**next-intl**^4.9|i18n z prefksem locale (|`/pl/`|,|<br>`/en/`|)|—|<br>`localePrefix: 'always'`|
|**react-hook-form**^7.72|Formularze z minimalną|liczbą re-renderów||||||
|**zod**^4.3|Walidacja schematów + integracja przez|||||`@hookform/resolvers`||
|**recharts**^3.8|Wykresy słupkowe na dashboardzie (trendy||||||8-tygodniowe)|
|**lucide-react**^1.7|Ikony SVG|||||||
|**@radix-ui**dialog +|Dostępne (a11y) prymitywy modala i menu|||||||
|dropdown-menu||||||||
|**class-variance-**|Pomocnicze do klas Tailwind|||||||
|**authority**,**clsx**,||||||||
|**tailwind-merge**||||||||



## **Środowisko uruchomieniowe** 

|**KOMPONENT**|**SZCZEGÓŁY**|
|---|---|
|Node.js|≥ 20 LTS (wymagane przez Next.js 16)|
|Konteneryzacja|Docker / Docker Compose, zarządzane przez panel**Dockge**|
|System hosta|TrueNAS Scale (debian-based), IP wewnętrzne<br>`10.10.1.201`|
|Tunel zewnętrzny|Cloudfare Tunnel (cloudfared) — domena<br>`custogo.com`|



CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 6 / 33 

**4DPF** 

## **3. Architektura infrastruktury** 

Cała infrastruktura firmy 4DPF jest skonsolidowana na jednym serwerze **TrueNAS Scale** o adresie we‐ wnętrznym `10.10.1.201` . TrueNAS hostuje wszystkie aplikacje jako kontenery Docker, zarządzane przez ‐ panel **Dockge** . Ekspozycja na świat odbywa się przez **Cloudflare Tunnel** — bezpieczny tunel wychodzą cy z serwera do edge'a Cloudflare, dzięki czemu w domowej sieci nie trzeba otwierać żadnych portów. 

_Diagram 1 — Architektura infrastruktury 4DPF. Pojedynczy host TrueNAS Scale uruchamia trzy główne kontenery (CRM, n8n, Supabase) zarządzane z Dockge. Ekspozycja przez Cloudflare Tunnel — bez otwartych portów. Lokalny model AI na osobnym komputerze, wywoływany webhookami z n8n._ 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 7 / 33 

**4DPF** 

## **Adresy i porty** 

|**USŁUGA**|**ADRES PUBLICZNY**|**LOKALNIE**|**PORT WEWN.**|
|---|---|---|---|
|CRM 4DPF|`crm.custogo.com`|`10.10.1.201:3000`|3000|
|n8n|`n8n.custogo.com`|`10.10.1.201:5678`|5678|
|Supabase Studio + API|`supabase.custogo.com`|`10.10.1.201:8000`|8000 (Kong)|
|Dockge (panel)|tylko LAN|`10.10.1.201:5001`|5001|
|TrueNAS Web UI|tylko LAN|`10.10.1.201:443`|443|
|Lokalne AI|tylko LAN|komputer biurowy|—|



**DLACZEGO CLOUDFLARE TUNNEL** Tunel jest połączeniem _wychodzącym_ z serwera do Cloudflare — to oznacza, że na routerze nie trzeba otwierać żadnych portów. Cloudflare odpowiada za TLS, DDoS protection i WAF na warstwie edge. Z punktu widzenia użytkownika końcowego CRM, n8n i Supabase są zwykłymi adresami HTTPS, ale w rzeczywistości są ukryte za tunelem. 

## **Lokalny model AI** 

‐ Lokalny silnik AI działa na osobnym komputerze w sieci biurowej i jest wykorzystywany przez n8n do auto matycznej analizy transkrypcji rozmów (Sales Quality, Support Log). n8n wywołuje go przez HTTP w sieci LAN — model nie jest wystawiony na zewnątrz. Dzięki temu wrażliwe dane klientów (treści rozmów, dane kontaktowe) nigdy nie opuszczają naszej sieci. 

‐ Typowy przepływ: rozmowa zostaje nagrana → transkrypcja jest wysyłana webhookiem do n8n → n8n po syła ją do lokalnego AI z odpowiednim promptem (kategoryzacja, ocena, podsumowanie) → wynik trafia do Supabase do kolumn `summary` , `category` , `detected_engine` , `rating` w odpowiedniej tabeli ( `Sa‐ les Quality` , `Support Log` ). 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 8 / 33 

**4DPF** 

## **4. Deployment — GitHub → TrueNAS → Dockge** 

CRM jest wdrażany metodą _GitOps-light_ : programista pracuje lokalnie, zmiany commituje na GitHub, a na serwerze TrueNAS odbywa się ręczny lub półautomatyczny pull i restart kontenera z poziomu panelu Dockge. Cały kod aplikacji żyje w jednym repozytorium, włącznie z plikiem `docker-compose.yml` . 

_Diagram 2 — Pipeline deploymentu CRM 4DPF. Programista pracuje lokalnie, push na GitHub, na serwerze ręczne wywołanie pull + rebuild z poziomu panelu Dockge._ 

## **Struktura docker-compose dla CRM** 

Stos CRM w Dockge to pojedynczy serwis Next.js zbudowany na obrazie `node:20-alpine` . Build odbywa się w kontenerze (w `Dockerfile` z multi-stage build), dzięki czemu finalny obraz nie zawiera zbędnych zależności dev. Plik `compose.yml` wygląda mniej więcej tak: 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 9 / 33 

**4DPF** 

## **`services:`** 

```
  crm:
build: .
container_name: crm
restart: unless-stopped
ports:
      - "3000:3000"
env_file:
      - .env.local
volumes:
      - ./public:/app/public:ro
networks:
      - dockge_net
networks:
  dockge_net:
external:true
```

## **Procedura wdrożenia (krok po kroku)** 

1. **Lokalnie:** testuj zmianę w `npm run dev` . Przed pushem zaktualizuj `lib/version.ts` — numer musi się zgadzać z tytułem commita (np. `v2.77` ). 

2. **Push:** `git commit -m "v2.77 — krótki opis"` + `git push origin main` . 3. **Serwer — pull:** wejdź do Dockge ( `10.10.1.201:5001` ), wybierz stos `crm` , kliknij „Pull" lub przez SSH: `cd /mnt/tank/dockge/crm && git pull` . 

4. **Rebuild + restart:** w Dockge przycisk „Update" lub przez SSH: `docker compose up -d --build` . Build trwa około 2–5 minut (kompilacja Next.js). 

5. **Weryfikacja:** otwórz `crm.custogo.com` , sprawdź czy login działa i czy numer wersji w stopce zgadza się z nową wartością. 

6. **Rollback (jeśli coś się popsuło):** `git reset --hard <poprzedni-commit> && docker compose up` 

   - `-d --build` . 

**WAŻNE** Po każdej zmianie schematu bazy w Supabase (dodanie kolumny, nowa tabela) trzeba zaktualizować typy w `lib/supabase/types.ts` ręcznie. Brak synchronizacji typów = błędy TypeScript przy buildzie i potencjalne runtime crashe. 

## **Restart bez rebuildu** 

Jeżeli zmienia się tylko zmienna środowiskowa (np. nowy klucz Supabase), nie ma potrzeby rebuildu obrazu — wystarczy `docker compose restart crm` w Dockge. Build jest potrzebny tylko gdy zmienił się kod aplikacji, plik `package.json` lub `Dockerfile` . 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 10 / 33 

**4DPF** 

## **5. Konfiguracja środowiska** 

## **Zmienne środowiskowe CRM** 

Plik `.env.local` w korzeniu projektu (nigdy nie commituj — jest w `.gitignore` ). Wymagane do działa‐ nia aplikacji: 

|**ZMIENNA**|**WARTOŚĆ / PRZYKŁAD**|
|---|---|
|`NEXT_PUBLIC_SUPABASE_URL`|`https://supabase.custogo.com`|
|`NEXT_PUBLIC_SUPABASE_ANON_KEY`|publiczny klucz anon JWT z Supabase Studio|
|`SUPABASE_SERVICE_ROLE_KEY`|klucz service_role JWT — używany TYLKO w API Routes|
||(admin SDK). Nigdy nie wystawiać na klienta.|
|`NODE_ENV`|`production`|



**KRYTYCZNE BEZPIECZEŃSTWO** `SUPABASE_SERVICE_ROLE_KEY` daje pełen dostęp do bazy z pominięciem RLS. Może być używany tylko w plikach które nie trafiają do bundle'a klienta: `app/ api/admin/users/route.ts` , `lib/supabase/server.ts` dla operacji administracyjnych. Nigdy nie używaj prefiksu `NEXT_PUBLIC_` przy tym kluczu. 

## **Konfiguracja Cloudflare Tunnel** 

Tunnel działa jako osobna usługa `cloudflared` w kontenerze obok CRM/n8n/Supabase. Konfiguracja w pliku `config.yml` : 

```
tunnel: <uuid-tunelu>
credentials-file: /etc/cloudflared/<uuid>.json
ingress:
  - hostname: crm.custogo.com
service: http://crm:3000
  - hostname: n8n.custogo.com
service: http://n8n:5678
  - hostname: supabase.custogo.com
service: http://supabase-kong:8000
  - service: http_status:404
```

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 11 / 33 

**4DPF** 

Cloudflare dashboard → Zero Trust → Networks → Tunnels — tam widać status każdego tunelu i można zarządzać public hostname'ami bez modyfikowania `config.yml` . 

## **Konfiguracja Dockge** 

‐ Dockge przechowuje wszystkie stosy w katalogu `/mnt/tank/dockge/<nazwa-stosu>` . Każdy stos = osob ny folder z `compose.yml` + ewentualne pliki konfiguracyjne. Panel webowy widoczny na `10.10.1.201:5001` (tylko z LAN — nie wystawione w tunelu). 

|**STOS**|**LOKALIZACJA**|**NOTATKA**||
|---|---|---|---|
|`crm`|`/mnt/tank/dockge/crm`|Klonowane z GitHub przez|<br>`git clone`|
|`n8n`|`/mnt/tank/dockge/n8n`|Persystent volume<br>`./n8n_data`||
|`supabase`|`/mnt/tank/dockge/supabase`|Multi-kontener: Postgres, Kong, Auth, Storage,||
|||Studio||
|`cloudflared`|`/mnt/tank/dockge/cloudflared`|Tunel do edge'a Cloudfare||



## **Konfiguracja n8n** 

n8n korzysta z własnej bazy SQLite (domyślnie) lub może być przepięty na Supabase Postgres. W naszej instalacji workflows obsługują m.in.: 

- **Transkrypcja rozmów** — webhook od systemu telefonii → upload audio → STT (Whisper lokalny) → zapis transkrypcji do `Sales Quality.full_transcript` lub `Support Log.full_transcript` w Supabase. 

- **Analiza AI** — transkrypcja → wywołanie lokalnego modelu AI z promptem → klasyfikacja kategorii, ocena, podsumowanie → zapis do odpowiednich kolumn w Supabase. 

- **Archiwizacja SMS** — wiadomości SMS są wpisywane przez webhook do tabel `Sales Text Log` i 

   - `Support Text Log` . 

- **Powiązanie z głównymi tabelami** — n8n po klasyfikacji aktualizuje powiązane `Sales Deals` / `Support Case` . 

## **Konfiguracja Supabase (self-hosted)** 

Self-hosted Supabase to multi-kontener stos: `postgres` (baza), `auth` (GoTrue), `storage-api` , `post‐ grest` (REST), `kong` (API gateway), `studio` (panel admina), `realtime` , `meta` . Wszystkie nasłuchują we wspólnej sieci dockerowej, do świata wychodzi tylko Kong (port 8000). Kluczowe ustawienia w pliku `.env` stosu Supabase: 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 12 / 33 

**4DPF** 

|**ZMIENNA**|**CO KONFIGURUJE**|||||
|---|---|---|---|---|---|
|`POSTGRES_PASSWORD`|Hasło do bazy postgres — odpowiada za poziom dostępu service_role|||||
|`JWT_SECRET`|Sekret podpisujący JWT — z niego pochodzą|||`ANON_KEY`|i|
||`SERVICE_ROLE_KEY`|||||
|`SITE_URL`|`https://crm.custogo.com`|— używane przy redirectach po||||
||confrmation email|||||
|`API_EXTERNAL_URL`|`https://supabase.custogo.com`||— adres po którym klient JS|||
||sięga do API|||||
|`DASHBOARD_USERNAME /`|Login do Studio (panel SQL + zarządzanie tabelami)|||||
|`PASSWORD`||||||



## **Backup i snapshoty** 

TrueNAS Scale ma wbudowane snapshoty ZFS na poziomie wolumenu — zalecane **codzienne** snapsho‐ ‐ ty pul z danymi Supabase (zachowane przez 14 dni) i n8n (przez 30 dni). Odtworzenie = rollback snap shotu w TrueNAS UI + restart stosu w Dockge. Snapshoty ZFS są incrementalne i nie zajmują dużo miejsca aż do momentu intensywnych zmian danych. 

**PRAKTYCZNA PORADA** Przed większą zmianą schematu bazy (migracja, dodanie kolumny) zrób 

ręczny snapshot puli `tank/dockge/supabase` z poziomu TrueNAS. To 30 sekund pracy, a w razie problemu daje czysty rollback bez utraty danych. 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 13 / 33 

**4DPF** 

## **6. Architektura aplikacji Next.js** 

CRM zbudowany jest na **Next.js 16 App Router** z dwuwarstwowym wzorcem stron: Server Components do pobierania danych i autoryzacji, Client Components do interaktywnego UI. Cała autoryzacja przechodzi przez `proxy.ts` (Next 16 zastępuje nim klasyczny `middleware.ts` ) i funkcję `requireAuth()` . 

_Diagram 4 — Przepływ żądania w aplikacji CRM. Server Component pobiera dane SSR, Client Component hydratuje stan i obsługuje kolejne zmiany (filtry, paginacja, CRUD) bezpośrednio przez REST API Supabase._ 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 14 / 33 

**4DPF** 

## **Struktura folderów** 

## `app/` 

```
  page.tsx                      → redirect do /pl/login
  [locale]/
```

```
    page.tsx                    → redirect do /[locale]/login
    layout.tsx                  → NextIntlClientProvider (tłumaczenia)
    (auth)/
      login/                    → strona logowania (Supabase Auth)
```

```
    (dashboard)/                → wszystkie chronione widoki
      layout.tsx                → Sidebar + Navbar + ThemeProvider
      dashboard/                → strona główna z KPI i wykresami
```

```
        page.tsx                → Server Component
```

```
          SalesDealsClient.tsx  → Client Component
      candidates/, machines/, sales/, sales-quality/, ...
      admin/users/, admin/permissions/, admin/activity-log/
      settings/                 → profil użytkownika
  api/
    admin/users/route.ts        → REST API (POST/PATCH/DELETE) — service_role
    admin/permissions/route.ts  → GET/POST macierzy uprawnień
```

```
proxy.ts                        → middleware Next 16 (auth + locale)
next.config.ts                  → next-intl plugin + allowedDevOrigins
i18n/request.ts                 → konfiguracja next-intl
```

```
lib/
```

```
  auth/helpers.ts               → requireAuth, getCurrentUser, getRedirectPath
  supabase/client.ts            → createClient() dla 'use client'
  supabase/server.ts            → createClient() dla Server Components
  supabase/types.ts             → typy TS dla wszystkich tabel
  supabase/filters.ts           → applyColumnFilters(query, filters)
  permissions.ts                → getAllowedTabs(role)
  permissions-config.ts         → TAB_DEFS, ALL_ROLES, DEFAULT_VIEW_MAP
  version.ts                    → APP_VERSION (aktualnie 2.67)
```

```
components/
  layout/Sidebar.tsx            → bar boczny z filtrowaniem po roli
  layout/Navbar.tsx             → pasek górny z dropdown użytkownika
  shared/DataTable.tsx          → uniwersalna tabela z filtrami/sortowaniem
  shared/Modal.tsx              → animowany modal
  shared/ConfirmDialog.tsx      → potwierdzenie usuwania
  shared/Pagination.tsx         → nawigacja stron
  shared/ThemeProvider.tsx      → init motywu z localStorage
  shared/PageHeader.tsx         → tytuł + subtitle + actions
  shared/forms.tsx              → inputStyle, FormField, FormActions
  shared/Badge.tsx              → DueDate/DaysLeft/Status/Direction
```

## **Wzorzec strony — Server + Client** 

Każdy moduł dashboardu działa w jednolitym, dwuwarstwowym wzorcu: 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 15 / 33 

**4DPF** 

## **1.** **`page.tsx` (Server Component)** 

Wykonuje się na serwerze, ma dostęp do Supabase z service-side klienta i nie zostanie wysłany do przeglądarki. Odpowiedzialny za: 

- autoryzację — `requireAuth(locale)` redirectuje na `/login` jeśli brak sesji, • pobranie pierwszej strony danych (25 rekordów) + zliczenie totala, • renderowanie odpowiedniego Client Componentu z `initialData` jako props. 

## **2.** **`*Client.tsx` (Client Component)** 

Hydratowany w przeglądarce, zarządza całym stanem interakcyjnym: 

- stan: `data, count, page, sortKey, sortDir, columnFilters` , 

- `fetchData()` jako `useCallback` — odpytuje Supabase z `applyColumnFilters()` + sortowaniem + 

- paginacją, 

- CRUD: modal z formularzem (react-hook-form + zod), insert/update/delete przez Supabase JS SDK, • po każdej operacji ponownie wywołuje `fetchData()` aby odświeżyć widok. 

## **Internacjonalizacja** 

`next-intl` z `localePrefix: 'always'` — każdy URL zawiera prefiks języka ( `/pl/dashboard` , `/en/ dashboard` ). Dwie obsługiwane locale: `pl` (domyślna), `en` . Aktualnie tłumaczone są elementy nawigacji w Sidebar; reszta UI jest po polsku. 

## **System motywów** 

Motywy oparte o CSS Custom Properties ( `var(--accent)` itd.) na `:root` . Zmiana motywu = podmiana 3 zmiennych w runtime bez przeładowania strony. Stan motywu w `localStorage` pod kluczem `crm-the‐ me` , inicjowany przez `ThemeProvider` przy starcie aplikacji. 6 dostępnych motywów: pomarańcz (domyśl‐ ny 4DPF), niebieski, zielony, fioletowy, czerwony, morski. 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 16 / 33 

**4DPF** 

## **7. Baza danych Supabase** 

Baza PostgreSQL hostowana w kontenerze Supabase na TrueNAS. Wszystkie tabele zabezpieczone przez **Row Level Security (RLS)** — z poziomu klienta z anon key nie da się pominąć autoryzacji. Opera‐ cje administracyjne (zarządzanie użytkownikami) idą przez API Routes z `SUPABASE_SERVICE_ROLE_KEY` , który pomija RLS. 

_Diagram 3 — Schemat bazy danych Supabase (uproszczony). Główne klastry: Sprzedaż (pomarańcz), Support (czerwony), Baza wiedzy i kadry. Strzałki = relacje przez FK. Wszystkie tabele z RLS._ 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 17 / 33 

**4DPF** 

## **Wszystkie tabele i ich przeznaczenie** 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 18 / 33 

**4DPF** 

|**TABELA SUPABASE**|**TABELA SUPABASE**|**TABELA SUPABASE**|**TYP TS**|**CO ZAWIERA**|||||
|---|---|---|---|---|---|---|---|---|
|`profiles`|||`Profile`|Rozszerzenie Supabase Auth — rola pracownika, imię i|||||
|||||nazwisko (powiązanie 1:1 z|`auth.users`|przez|`id`|)|
|`OLX`|||`OLXCandidate`|Kandydaci z OLX z ocenami punktowymi (wykształcenie, język,|||||
|||||doświadczenie, ocena ogólna — wszystko w skali /100), link do|||||
|||||CV|||||
|`Machines`|||`Machine`|Baza maszyn budowlanych — marka, model, rok,|||silnik, typ||
|||||fltru (DPF/DEF), konfguracja emulatora|||||
|`Machine Issues`|||`MachineIssue`|Lista powtarzających się problemów maszyn (problem + model|||||
|||||+ rok)|||||
|`Sales Deals`|||`SalesDeal`|Leady/transakcje sprzedażowe — status, kontakt,|||||
|||||podsumowanie aktualne|||||
|`Sales Quality`|||`SalesQuality`|Oceny rozmów handlowych|w skali /10 — kategoria,||||
|||||sprzedawca, transkrypcja, feedback|||||
|`Sales Text Log`|||`SalesTextLog`|Historia SMS/chat z klientami sprzedaży — IN/OUT, treść,|||||
|||||media JSON|||||
|`Sales`|||`Sale`|Sfnalizowane zamówienia — wysyłka, faktura, tracking, PayPal|||||
|`Support Case`|||`SupportCase`|Sprawy serwisowe klientów|— status, ostatni agent, kategoria,||||
|||||rozwiązanie|||||
|`Support Log`|||`SupportLog`|Logi indywidualnych rozmów supportu — transkrypcja, opis|||||
|||||problemu, rekomendacja|||||
|`Support Text Log`|||`SupportTextLog`|SMS supportu — analogicznie do Sales Text Log|||||
|`Support Backlog`|||`SupportBacklog`|Główna sprawa klienta + log interakcji (Support Backlog Log)|||||
|`reviews`|||`Review`|Linki do opinii wysłane do klientów po sprawie — kanał,|||||
|||||technik, statusy napisał/wystawił|||||
|`domains`|||`Domain`|Domeny frmy z datą wygaśnięcia|||||
|`hostings`|||`Hosting`|Serwery/hostingi z datą wygaśnięcia|||||
|`tab_permissions`|||—|Macierz uprawnień<br>`(role, tab_key, can_view,`|||||
|||||`can_write, can_edit)`|||||
||||||||||



CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 19 / 33 

**4DPF** 

## **RLS — Row Level Security** 

Każda tabela ma włączone RLS i przynajmniej jedną politykę. Typowy wzorzec: 

```
ALTER TABLE "Sales Deals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_sales_deals"
ON "Sales Deals" FOR SELECT TO authenticated
USING (true);
```

```
-- INSERT/UPDATE/DELETE — w zależności od polityki danej tabeli,
-- najczęściej "authenticated" lub sprawdzanie roli w profiles
```

## **Wyzwania bazy** 

- **Tabela** **`OLX` nie ma kolumny** **`created_at`** — domyślny `sortKey` w komponencie musi być `'id'` (nie `'created_at'` ), inaczej PostgREST zwróci błąd. 

- **Kolumny wyliczane** jak `days_left` nie istnieją w bazie — przy sortowaniu trzeba mapować je na realną kolumnę ( `days_left → due_date` ) przed wysłaniem zapytania. 

• **Hydration mismatch z** **`new Date()`** — komponenty renderujące różnicę dni muszą mieć `suppressHydrationWarning` , bo serwer (UTC) i klient (lokalna strefa) liczą różnie. 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 20 / 33 

**4DPF** 

## **8. Moduły CRM — przegląd funkcjonalny** 

System składa się z 15 modułów dashboardowych + 3 modułów administracyjnych. Każdy moduł ma własny katalog w `app/[locale]/(dashboard)/` i działa w tym samym wzorcu Server + Client Component opisanym w sekcji 6. 

## **Sprzedaż** 

## **Dashboard** **`/dashboard`** 

**admin manager** Widok startowy dla adminów i managerów. Zawiera 4 karty KPI (aktywne transakcje, ‐ otwarte sprawy supportu, kandydaci OLX, zamówienia w bieżącym miesiącu), 2 wykresy słupkowe Re charts (trendy 8-tygodniowe Sales Deals i Support Cases) oraz panel ostatniej aktywności. 

## **Sales Deals** **`/sales-deals`** 

**admin manager handlowiec** Główny CRM sprzedażowy — leady/transakcje. Statusy: `open → pending → in_progress → closed` . Filtrowanie po sprzedawcy, kategorii silnika, statusie. Pełny CRUD z modalem. Powiązanie z `Sales Text Log` przez `deal_id` . 

## **Sales Quality** **`/sales-quality`** 

**admin manager handlowiec** Ocena jakości rozmów handlowych przez managera lub team leada. Skala /10 (zielony ≥7, żółty ≥4, czerwony <4). Pole `full_transcript` z pełną transkrypcją (uzupełniane automatycznie przez n8n + lokalne AI). Powiązanie z Sales Deals. 

## **Sales** **`/sales`** 

**admin manager handlowiec logistyka** Sfinalizowane zamówienia (po zakończeniu negocjacji w Sa‐ les Deals). Dane wysyłkowe, fakturowe, numer trackingu kuriera, numer faktury PayPal. Powiązanie z Machines przez `machine_id` . 

## **Sales Text Log** **`/sales-text-log`** 

**admin manager handlowiec** Archiwum SMS/chat w procesie sprzedaży. Kierunek IN/OUT z badge'em kolorowym. Pełna treść + podsumowanie AI. Wpisywane automatycznie przez n8n. 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 21 / 33 

**4DPF** 

## **Obsługa klienta (Support)** 

## **Support Cases** **`/support-cases`** 

**admin manager support** Zarządzanie sprawami serwisowymi. Statusy: `open → in_progress → pen‐ ding → resolved → closed` . Śledzenie ostatniego agenta, kategorii problemu, silnika. Powiązanie z Support Log przez `last_interaction_id` . 

## **Support Backlog** **`/support-backlog`** 

**admin manager support** Lista bieżących spraw + log kolejnych aktualizacji. Każda sprawa ma swój ‐ log interakcji (Support Backlog Log). Akcje „Nowa sprawa" + „Aktualizacja" w prawym górnym rogu na główka. 

## **Support Log** **`/support-log`** 

**admin manager support** Logi indywidualnych rozmów supportu — czas trwania, opis problemu, reko‐ mendacja, pełna transkrypcja. Powiązane z Support Cases przez `case_id` . 

## **Support Text Log** **`/support-text-log`** 

**admin manager support** Archiwum wiadomości tekstowych supportu — analogicznie do Sales Text Log. 

## **Reviews** **`/reviews`** 

**admin manager support** Lista wysłanych linków do opinii klientów — kanał (Google/SMS/Email), technik obsługujący, statusy `napisano` , `napisać` , `wystawił` . 

## **Kadry** 

## **Candidates** **`/candidates`** 

**admin manager hr** Baza kandydatów z OLX z ocenami w 4 kryteriach (wykształcenie, język, do‐ świadczenie, ocena ogólna). Link do CV w Supabase Storage lub zewnętrzny URL. Domyślne sortowanie po `id` (brak `created_at` w tej tabeli). 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 22 / 33 

**4DPF** 

## **Baza wiedzy** 

## **Machines** **`/machines`** 

**admin manager handlowiec logistyka** Baza maszyn budowlanych z parametrami silnika, typu filtru i konfiguracji emulatora. Status zwrotu (jeśli wymiana lub reklamacja). 

## **Machine Issues** **`/machine-issues`** 

**admin manager handlowiec support logistyka** Powtarzające się problemy maszyn bez gotowego rozwiązania — model, rok, opis problemu. Słownik pomocniczy dla techników. 

## **Infrastruktura IT** 

## **Domeny** **`/domains` i Hostingi** **`/hostings`** 

**admin manager** Monitoring infrastruktury IT z datami wygaśnięcia. Automatyczne kolorowanie wg progów:  zielony  >30  dni,  żółty  ≤30  dni,  czerwony  ≤7  dni  lub  po  terminie  ( `DueDateBadge` + `DaysLeftBadge` z biblioteki shared). 

## **Administracja** 

## **Admin — Users** **`/admin/users`** 

**admin** Panel zarządzania kontami pracowników. Tworzenie nowych kont (email + hasło + rola), zmiana ‐ roli, usuwanie konta. Operacje przez API Route `/api/admin/users` z Supabase Admin SDK (servi ce_role). 

## **Admin — Permissions** **`/admin/permissions`** 

**admin** Macierz  uprawnień:  wiersze  =  zakładki,  kolumny  =  role  ×  (Wyświetlanie  /  Wpisywanie  / Edytowanie). Zapisuje do tabeli `tab_permissions` przez API Route. Admin zawsze ma pełny dostęp (early return bez zapytania DB). 

## **Admin — Activity Log** **`/admin/activity-log`** 

**admin manager** Log akcji użytkowników — kto, co, kiedy. Pomocny przy debugu i audycie. 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 23 / 33 

**4DPF** 

## **Settings** **`/settings`** 

Dostępne dla wszystkich zalogowanych ról — link w dropdown menu Navbar (ikona użytkownika prawy górny róg). Karta z danymi konta (email, imię, rola) + formularz zmiany hasła (min. 6 znaków, walidacja zgodności) + wybór motywu kolorystycznego. 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 24 / 33 

**4DPF** 

## **9. System uprawnień i ról** 

System ma **6 ról** + dynamicznie konfigurowalną macierz uprawnień. Każda rola ma domyślny zestaw wi‐ docznych zakładek (fallback), ale admin może go zmienić z poziomu panelu `/admin/permissions` . Auto‐ ryzacja działa **dwuwarstwowo** : Sidebar pokazuje tylko dozwolone linki, a każda strona dodatkowo weryfi‐ kuje rolę server-side i redirectuje nieuprawnionego użytkownika. 

## **Role** 

|**ROLA**|**DOMYŚLNY WIDOK**|||**STRONA STARTOWA PO**|
|---|---|---|---|---|
|||||**LOGOWANIU**|
|**admin**|Wszystkie zakładki + administracja (users,|permissions,||`/dashboard`|
||activity-log)||||
|**manager**|Wszystkie zakładki oprócz<br>`admin/users`|i|<br>`admin/`|`/dashboard`|
||`permissions`||||
|**handlowiec**|Sales Deals, Sales Quality, Sales, Sales Text Log, Machines,|||`/sales-deals`|
||Machine Issues||||
|**support**|Support Cases, Support Backlog, Support Log, Support Text|||`/support-cases`|
||Log, Reviews, Machine Issues||||
|**hr**|Candidates|||`/candidates`|
|**logistyka**|Sales, Machines, Machine Issues|||`/sales`|



## **Tabela** **`tab_permissions`** 

Konfigurowalny zestaw uprawnień per (rola, zakładka). Trzy typy uprawnień: 

- `can_view` — czy widzi zakładkę w Sidebar i może wejść na stronę 

- `can_write` — czy może tworzyć nowe rekordy 

- `can_edit` — czy może edytować istniejące rekordy 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 25 / 33 

**4DPF** 

```
CREATE TABLE tab_permissions (
  role text NOT NULL,
  tab_key text NOT NULL,
  can_view boolean NOT NULL DEFAULTtrue,
  can_write boolean NOT NULL DEFAULTtrue,
  can_edit boolean NOT NULL DEFAULTtrue,
PRIMARY KEY (role, tab_key)
```

```
);
ALTER TABLE tab_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_tab_permissions"
ON tab_permissions FOR SELECT TO authenticated USING (true);
```

## **Przepływ autoryzacji** 

1. Użytkownik wchodzi na chronioną ścieżkę → `proxy.ts` weryfikuje cookie JWT z Supabase Auth. Brak sesji → redirect na `/[locale]/login` . 

2. Server Component strony wywołuje `requireAuth(locale)` → pobiera `user` + `profile` z tabeli `profiles` . Brak profilu → kolejny redirect. 

3. `DashboardLayout` wywołuje `getAllowedTabs(role)` server-side i przekazuje listę dozwolonych zakładek do Sidebar. 

4. `Sidebar` filtruje `NAV_ITEMS` po liście — pracownik widzi tylko swoje moduły. 5. Strona Server Component ponownie sprawdza rolę (defensywnie, bo URL można wpisać ręcznie) i redirectuje nieuprawnionego. 

6. Operacje CRUD (insert/update/delete) idą bezpośrednio do Supabase i są blokowane na poziomie **RLS** , jeśli polityka tabeli tego wymaga. 

## **Plik** **`lib/permissions-config.ts`** 

Centralna definicja ról, zakładek i domyślnych map widoczności. Konfiguracja Edge: dodanie nowej roli wymaga tylko zmiany `ALL_ROLES` + `DEFAULT_VIEW` + opcjonalnie wpisów w `tab_permissions` . 

```
export const ALL_ROLES: Role[] = [
'admin', 'manager', 'handlowiec',
'support', 'hr', 'logistyka'
]
export const TAB_DEFS: TabDef[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'sales-deals', label: 'Transakcje' },
// ... 15 zakładek
  { key: 'admin/activity-log', label: 'Logi aktywności' },
]
```

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 26 / 33 

**4DPF** 

**STATUS IMPLEMENTACJI** Aktualnie aktywnie egzekwowane jest `can_view` (filtrowanie Sidebar + guard strony). Pola `can_write` i `can_edit` są zapisywane w bazie, ale jeszcze nie podpięte do przycisków „Dodaj"/„Edytuj" w komponentach. Pełne podpięcie to zadanie kolejnej iteracji. 

## **API administracyjne** 

Operacje na kontach użytkowników wymagają klucza `service_role` , więc idą przez API Routes: 

|**ENDPOINT**|**METODA**|**DZIAŁANIE**|
|---|---|---|
|`/api/admin/users`|GET|Lista wszystkich kont + ról|
|`/api/admin/users`|POST|Utworzenie nowego konta (email + hasło + rola)|
|`/api/admin/users`|PATCH|Zmiana roli istniejącego użytkownika|
|`/api/admin/users`|DELETE|Usunięcie konta z auth.users + profles|
|`/api/admin/permissions`|GET|Pobranie aktualnej macierzy uprawnień|
|`/api/admin/permissions`|POST|Upsert<br>`(role, tab_key, can_view, can_write,`|
|||`can_edit)`|



**TODO BEZPIECZEŃSTWA** Plik `app/api/admin/users/route.ts` ma znane luki opisane w `sugerowane_zmiany.md` punkt 4: brak walidacji wejścia, możliwy mass assignment, race condition, wyciek szczegółów błędów do klienta. Do zaadresowania w kolejnej iteracji refactoringu. 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 27 / 33 

**4DPF** 

## **10. Komponenty współdzielone** 

‐ Po refaktorze (sesje 2026-04 — 2026-05) zduplikowane wzorce z modułów zostały wyciągnięte do katalo gu `components/shared/` .  Aktualnie  8  wspólnych  komponentów  obsługuje  15  modułów  dashboardu, eliminując kopiowanie kodu. 

## **DataTable** 

‐ Kluczowy komponent — uniwersalna tabela z filtrowaniem per-kolumna w stylu **Google Sheets** , sortowa niem, paginacją i resize kolumn drag-and-drop. Konfigurowana przez interfejs `Column<T>` : `key, header, render?, width?, sortable?, filterable?, filterOptions?` . 

## **Typy filtrów** 

|**WARUNEK**|||||**MAPOWANIE NA SUPABASE**|**MAPOWANIE NA SUPABASE**|**MAPOWANIE NA SUPABASE**|**MAPOWANIE NA SUPABASE**|||
|---|---|---|---|---|---|---|---|---|---|---|
|`contains`|||||`.ilike(key, '%v%')`|||— case-insensitive|||
|`not_contains`|||||`.filter(key, 'not.ilike', '%v%')`||||||
|`equals`|||||`.eq(key, v)`||||||
|`not_equals`|||||`.neq(key, v)`||||||
|`starts_with`|||/|<br>`ends_with`|`.ilike`|z odpowiednim wzorcem|||||
|`is_empty`|/|<br>`is_not_empty`|||`.or('col.is.null,col.eq.')`||||/|<br>`.not.is.null`|
|`one_of`|||||`.in(key, values)`||— multi-select checkboxy||||



## **filterOptions — statyczne vs dynamiczne** 

Kolumny ze stałymi wartościami (np. `status` ) mają `filterOptions: ['open', 'closed', ...]` w defi‐ nicji. Kolumny z wartościami z bazy (np. `salesman` , `category` , `detected_engine` ) ładują opcje w `use‐ Effect` na mount i muszą być przekazane jako `useMemo` — nie jako stała modułowa. 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 28 / 33 

**4DPF** 

## **Modal i ConfirmDialog** 

`Modal` z animowanym overlay (blur 0→12px + opacity) i panelem (scale 0.94→1, cubic-bezier 0.28s). Box-shadow 3-warstwowy z pomarańczową obwódką i poświatą. Górny gradient akcentu jako sygnatura wizualna. `ConfirmDialog` używa Modal pod spodem, dodaje przyciski „Anuluj" / „Usuń". 

## **forms.tsx** 

Wspólne style i kontrolki formularzy używane przez 12 modułów: 

- `inputStyle` / `textareaStyle` — style inline dla input/textarea/select (tło `--surface` , border `--` 

- `border` , padding, rounded) 

- `FormField` — opakowanie etykieta + input + komunikat błędu. Props: `label, error?, children` 

- • `FormActions` — stopka modala z przyciskami Anuluj/Zapisz. Props: `onCancel, isSubmitting?, cancelLabel?, submitLabel?, className?` 

## **Badge.tsx** 

- `getDiffDays(dateStr)` — helper liczący dni do podanej daty 

- `DueDateBadge` — data + tło: 🔴 >30 dni, 🔴 ≤30, 🔴 ≤7 lub po terminie (z `suppressHydrationWarning` ) 

- • `DaysLeftBadge` — sama liczba pozostałych dni z tym samym schematem • `StatusBadge` — generyczny pill ze statusem + mapa kolorów `colors: Record<string,string>` podawana lokalnie przez moduł 

- `DirectionBadge` — IN/OUT badge dla logów tekstowych (kierunek wiadomości) 

## **PageHeader** 

Jednolity nagłówek strony — tytuł + opcjonalny subtitle + opcjonalne `actions` (przyciski) po prawej. Uży‐ wany przez wszystkie 15 stron dashboardu. Domyślny wrapper `mb-6` ; gdy są `actions` dodatkowo `flex items-start justify-between` . 

## **ThemeProvider** 

Wczytuje zapisany motyw z `localStorage` (klucz `crm-theme` ) przy starcie aplikacji. Ustawia 3 zmienne CSS na `:root` : `--accent` , `--accent-hover` , `--accent-soft` . Działa bez zewnętrznego state mana‐ gement. 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 29 / 33 

**4DPF** 

## **Sidebar i Navbar** 

`Sidebar` z filtrowaniem po roli, możliwością zwijania (pełna szerokość → tylko ikony). Aktywny link: ‐ pomarańczowe tło `rgba(239,127,26,0.12)` + lewy border `2px solid var(--accent)` . Logo z obra mówką akcentu. 

`Navbar` górny pasek z dynamicznym tytułem strony (mapa `PATH_TO_TITLE` ) i dropdown menu użytkow‐ nika (avatar → Profil / Wyloguj). 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 30 / 33 

**4DPF** 

## **11. Pułapki i troubleshooting** 

## **Next.js 16 — breaking changes** 

**INNE NIŻ W TRAINING DATA LLM-ÓW** Next.js 16 ma istotne zmiany względem 14/15: `middleware.ts` → `proxy.ts` , Server Components są domyślne, Turbopack wbudowany. Przed wprowadzeniem zmian w kodzie zawsze sprawdzaj aktualną dokumentację w `node_modules/ next/dist/docs/` — nie wszystko co dział w starszych wersjach jeszcze działa. 

## **Kolumny i tabele** 

- **Spacje w nazwach tabel** : Supabase jest case-sensitive i wymaga dokładnych nazw — `'Sales Deals'` , `'Support Case'` , `'Sales Quality'` . Bez cudzysłowów (lub w JS bez backticków) zapytania się nie powiodą. 

- **Tabela OLX nie ma** **`created_at`** — domyślny `sortKey` w CandidatesClient musi być `'id'` . Próba sortowania po nieistniejącej kolumnie = błąd PostgREST. 

- **Kolumny wyliczane** jak `days_left` w domains/hostings nie istnieją w DB — przy sortowaniu trzeba mapować: `const dbSortKey = sortKey === 'days_left' ? 'due_date' : sortKey` . 

## **Hydration mismatch** 

Komponenty renderujące wartości zależne od aktualnego czasu (różnica dni, formatowana data) muszą mieć `suppressHydrationWarning` na elemencie ze zmienną treścią. Serwer (UTC) i klient (lokalna strefa) obliczają różne wartości → React regeneruje drzewo i może rzucać warningi. Dotyczy `DaysLeftBadge` i `DueDateBadge` w modułach `domains` i `hostings` . 

## **Filtry kolumn — częste błędy** 

- **filterOptions jako pusta tablica** cofa kolumnę do trybu tekstowego (warunek `filterOptions?.length` , nie samo `filterOptions` ). 

- **Dynamiczne filterOptions wymagają useMemo** — gdy wartości są pobierane z bazy w `useEffect` , definicja kolumn musi być w `useMemo` z deps na `filterOptionsMap` , nie jako stała modułowa. 

- **columnFilters w deps useCallback** — zmiana filtra musi wyzwolić nowe zapytanie, więc `fetchData` musi mieć `columnFilters` w deps array. 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 31 / 33 

**4DPF** 

## **Kolory i design system** 

**STARE KOLORY DO USUNIĘCIA** W kodzie nadal mogą występować `#4f6ef7` , `#3d5ce0` , `rgba(79,110,247,...)` — to stary niebieski sprzed rebrandingu. Wszystkie powinny być zamienione na `var(--accent)` lub odpowiednio `rgba(239,127,26,...)` / `rgba(224,120,24,...)` . Lista plików do poprawy w `sugerowane_zmiany.md` punkt 6. 

## **Częste problemy infrastrukturalne** 

|**PROBLEM**||**DIAGNOZA**|**ROZWIĄZANIE**||
|---|---|---|---|---|
|Aplikacja niedostępna pod||Tunel Cloudfare nie działa lub|Dockge → sprawdź status kontenera||
|`crm.custogo.com`||kontener CRM padł|`crm` i<br>`cloudflared` ; restart jeśli||
||||potrzeba||
|Login nie działa — „Invalid||Niezgodny<br>`JWT_SECRET`|Zsynchronizuj zmienne w<br>`.env.local`||
|login credentials"||Supabase z używanym anon|CRM z<br>`.env` stosu Supabase||
|||key|||
|Build pada na typach po||Niezaktualizowane<br>`lib/`|Ręcznie dodaj/zmień typ + uruchom|`npm`|
|zmianie schematu||`supabase/types.ts`|`run build` lokalnie przed pushem||
|n8n workfow nie zapisuje||Wygasły token lub zła rola RLS|Sprawdź credentials w n8n → użyj||
|danych do Supabase|||`SERVICE_ROLE_KEY` dla operacji||
||||systemowych||
|Wolny start aplikacji po||Pierwszy request triggeruje cold|Normalne zachowanie po rebuildzie;||
|deployu||start Next + cache miss|subsequent requesty są szybkie||
|Po<br>`git pull`|brakuje|Zmieniło się<br>`package.json`|Rebuild z<br>`--build` :<br>`docker compose`||
|paczek|||`up -d --build`||
|Cloudfare zwraca 502||Tunel działa, ale serwis nie|Sprawdź logi kontenera w Dockge||
|||odpowiada|(zakładka „Logs"); zwykle wymagany||
||||restart||



## **Konwencje commitów** 

• Tytuł commita zawiera numer wersji (np. `v2.77 — naprawiono filtry dynamiczne` ) • Numer w tytule musi być zgodny z `APP_VERSION` w `lib/version.ts` • Zmiany wdrażać **po jednej na raz** — czekać na potwierdzenie użytkownika przed kolejną 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 32 / 33 

**4DPF** 

- Refaktor osobno od feature'ów — łatwiejszy rollback 

## **Lista priorytetów do następnej iteracji** 

Zawartość pliku `sugerowane_zmiany.md` : 

- **Krytyczne:** walidacja wejścia + obsługa błędów w `app/api/admin/users/route.ts` ; obsługa `{ error }` po CRUD w 16 miejscach w `*Client.tsx` . 

- **Wysokie:** zamiana starych kolorów `#ef7f1a` / `#4f6ef7` na zmienne CSS; hydration mismatch w `SettingsClient.tsx` ; weryfikacja czy `proxy.ts` faktycznie działa w produkcji Next 16. 

- • **Średnie:** podpięcie `can_write` / `can_edit` z tabeli `tab_permissions` do przycisków „Dodaj"/ „Edytuj" w komponentach. 

---

> **UWAGA — poniższe sekcje nie są częścią oficjalnej dokumentacji v2.77.**
> Zostały dodane ręcznie i opisują zmiany wprowadzone w wersjach **v2.69 – v2.77**.
> Oficjalny dokument PDF/DOCX nie został jeszcze zaktualizowany.

---

## **12. Moduł Magazyn (v2.77)**

Moduł Magazyn to rozwijana grupa zakładek w Sidebarze, grupująca 5 pod-modułów związanych z inwentarzem fizycznym i cyfrowym firmy. Sidebar obsługuje teraz typ `NavGroup` — klikalne nagłówki grup z ikoną `ChevronDown`, które rozwijają/zwijają listę pod-zakładek. Gdy sidebar jest zwinięty do ikon, kliknięcie ikony grupy przenosi na pierwszą widoczną pod-zakładkę.

### **Struktura routingu**

```
app/[locale]/(dashboard)/warehouse/
  page.tsx                          → Emulatory
  _components/WarehouseClient.tsx
  zestawy/
    page.tsx                        → Zestawy
    _components/SetsClient.tsx
  wiazki/
    page.tsx                        → Wiązki
    _components/WiazkiClient.tsx
  hardware/
    page.tsx                        → Hardware
    _components/HardwareClient.tsx
  software/
    page.tsx                        → Software
    _components/SoftwareClient.tsx
```

### **Pod-moduły**

#### **Emulatory `/warehouse`**

**admin manager handlowiec logistyka** Katalog emulatorów DPF/DEF ze stanami magazynowymi. Tabela Supabase: `Products`.

| Kolumna | Opis |
|---|---|
| `name` | Nazwa emulatora |
| `plytka` | Typ płytki PCB (dynamiczny filtr z bazy) |
| `program` | Wersja firmware (tekst) |
| `category` | Typ: `emulator`, `rura`, `pompa`, `inne` |
| `stock_qty` | Stan magazynowy (badge kolorowy) |
| `price_default` | Cena domyślna w EUR |
| `notes` | Notatki |

#### **Zestawy `/warehouse/zestawy`**

**admin manager handlowiec logistyka** Katalog gotowych zestawów (emulator + wiązka). Tabela Supabase: `Zestawy`.

```sql
CREATE TABLE "Zestawy" (
  id integer primary key generated always as identity,
  nr integer unique not null,
  name text not null,
  emulator_program text,
  wiazka text,
  notes text,
  instrukcja text,
  created_at timestamptz default now() not null
);
```

#### **Wiązki `/warehouse/wiazki`**

**admin manager handlowiec logistyka** Stany magazynowe wiązek (harness). Tabela Supabase: `Wiazki`. Zawiera kolumnę `product_line` (`4DPF` / `comfylock`) — dane zawsze posortowane: 4DPF u góry, comfylock na dole (stały sort priorytetowy przed sortowaniem użytkownika).

```sql
CREATE TABLE "Wiazki" (
  id integer primary key generated always as identity,
  product_line text not null default '4DPF',
  emulator text,
  name text not null,
  stock_qty integer not null default 0,
  notes text,
  created_at timestamptz default now() not null
);
```

#### **Hardware `/warehouse/hardware`**

**admin manager logistyka** Inwentarz komponentów fizycznych: płytki surowe, płytki zaprogramowane, obudowy. Tabela Supabase: `Hardware`. Typ komponentu (`component_type`) wybierany z trzech opcji: `płytka surowa`, `płytka zaprogramowana`, `obudowa` — każdy z odrębnym kolorem badge'a.

```sql
CREATE TABLE "Hardware" (
  id integer primary key generated always as identity,
  component_type text not null,
  name text not null,
  stock_qty integer not null default 0,
  notes text,
  created_at timestamptz default now() not null
);
```

#### **Software `/warehouse/software`**

**admin manager handlowiec logistyka** Katalog programów i firmware emulatorów. Tabela Supabase: `Software`. Zawiera kolumnę `product_line` (4DPF / comfylock) i `plytka` — dynamiczny filtr z wartości obecnych w tabeli. Dane zawsze posortowane tak samo jak Wiązki.

```sql
CREATE TABLE "Software" (
  id integer primary key generated always as identity,
  product_line text not null default '4DPF',
  name text not null,
  plytka text,
  notes text,
  created_at timestamptz default now() not null
);
```

### **Uprawnienia magazynu**

| tab_key | Domyślne role |
|---|---|
| `warehouse` | admin, manager, logistyka, handlowiec |
| `warehouse-zestawy` | admin, manager, logistyka, handlowiec |
| `warehouse-wiazki` | admin, manager, logistyka, handlowiec |
| `warehouse-hardware` | admin, manager, logistyka |
| `warehouse-software` | admin, manager, logistyka, handlowiec |

### **Ważna poprawka — filtry w komponentach magazynu (v2.75)**

Wszystkie komponenty `*Client.tsx` w module Magazyn wymagają `useEffect` wywołującego `fetchData` przy zmianie filtrów, sortowania i strony:

```tsx
const fetchData = useCallback(async () => {
  // ...zapytanie z applyColumnFilters + order + range
}, [page, columnFilters, sortKey, sortDir])

useEffect(() => { fetchData() }, [fetchData])
```

Bez tego `useEffect` filtry i sortowanie działają **tylko** po operacjach CRUD, a nie przy interakcji użytkownika z dropdownem filtra. Jest to wzorzec wymagany przez wszystkie moduły — jego pominięcie powoduje brak reakcji UI na zmiany filtrów.

### **Konwencja product_line**

Wiązki i Software mają kolumnę `product_line` z dwiema wartościami:

| Wartość | Kolor badge | Opis |
|---|---|---|
| `4DPF` | pomarańcz `#e07818` | Produkty głównej linii emulatorów |
| `comfylock` | fiolet `#a855f7` | Produkty linii ComfyLock / Keyless |

Sort priorytetowy `product_line ASC` jest zawsze dodawany jako **pierwsza** klauzula `.order()` w zapytaniu Supabase, przed sortem wybranym przez użytkownika.

---

## **Kontakt techniczny** 

Repozytorium kodu znajduje się na GitHubie. Wszystkie zmiany przechodzą przez `main` . Serwer firmowy z całym stosem aplikacji: TrueNAS Scale, `10.10.1.201` , panel Dockge na porcie `5001` . Adresy produk‐ cyjne: `crm.custogo.com` , `n8n.custogo.com` , `supabase.custogo.com` . 

**DOKUMENTACJA PRZYGOTOWANA AUTOMATYCZNIE** Niniejszy dokument został wygenerowany na podstawie analizy kodu źródłowego CR 

CRM 4DPF — Dokumentacja techniczna • v2.77 • strona 33 / 33 

