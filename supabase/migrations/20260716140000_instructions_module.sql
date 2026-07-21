-- =============================================================================
-- Moduł Instrukcje — baza instrukcji instalacji powiązanych z produktami/zestawami
-- =============================================================================
-- Taksonomia: marka -> typ emisji -> wariant silnikowy (+ wewnętrzne oznaczenie).
-- Model 2-poziomowy, bo 1 instrukcja = do 3 wersji językowych (PL/EN/ES),
-- a każda wersja = 2 pliki (edytowalny SVG z Inkscape + PDF):
--   public."Instructions"       — logiczna instrukcja (taksonomia + materiały)
--   public."Instruction Files"  — wersje językowe (SVG + PDF + numer wersji)
--
-- RLS: jak inne tabele danych — pełny dostęp dla `authenticated`. Uprawnienia
-- zakładek (view/write/edit) egzekwuje warstwa aplikacji (getTabWritePerms),
-- klucz zakładki `instructions` dochodzi w kodzie (lib/permissions-config.ts).
--
-- Pliki: prywatny bucket Storage `instructions`. Struktura kluczy obiektów
-- (folder = prefiks klucza, object storage nie ma pustych folderów):
--   {instruction_id}/active/{lang}.{ext}      — aktualne pliki
--   {instruction_id}/archive/{ts}_{lang}.{ext} — poprzednie wersje (Archiwum)
--   {instruction_id}/materials/{filename}      — dodatkowe materiały (dowolne formaty)
-- Ścieżki kluczowane po instruction_id (stabilne przy zmianie nazwy marki);
-- czytelna taksonomia żyje w tabeli i w UI, nie w ścieżce pliku.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABELE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."Instructions" (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    brand text NOT NULL,               -- marka (CAT, Cummins, Deutz…)
    emission_type text,                -- typ emisji (DPF, DPF+SCR, SCR…) — opcjonalny
    engine_variant text,               -- wariant silnikowy (C3.4, V1505…) — opcjonalny
    product_marking text,              -- wewn. oznaczenie produktu („Nowy plastik", „Stare")
    title text,                        -- etykieta / dla dokumentów ogólnych (CAN Logger…)
    category text,                     -- np. 'general' dla pozycji bez maszyny
    notes text,
    status text NOT NULL DEFAULT 'active'   -- active | archived (ukrycie całej instrukcji)
);

CREATE TABLE IF NOT EXISTS public."Instruction Files" (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    instruction_id bigint NOT NULL,
    language text NOT NULL,             -- pl | en | es
    svg_path text,                     -- klucz obiektu w buckecie: plik edytowalny
    pdf_path text,                     -- klucz obiektu w buckecie: PDF
    svg_name text,                     -- oryginalna nazwa pliku (do pobierania)
    pdf_name text,
    version integer NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'active',  -- active | archived (poprzednie wersje)
    uploaded_by uuid,
    uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. OGRANICZENIA (PK, FK, CHECK)
-- ---------------------------------------------------------------------------
ALTER TABLE public."Instructions"
    ADD CONSTRAINT "Instructions_pkey" PRIMARY KEY (id);
ALTER TABLE public."Instructions"
    ADD CONSTRAINT "Instructions_status_check"
    CHECK (status = ANY (ARRAY['active'::text, 'archived'::text]));

ALTER TABLE public."Instruction Files"
    ADD CONSTRAINT "Instruction Files_pkey" PRIMARY KEY (id);
ALTER TABLE public."Instruction Files"
    ADD CONSTRAINT "Instruction Files_language_check"
    CHECK (language = ANY (ARRAY['pl'::text, 'en'::text, 'es'::text]));
ALTER TABLE public."Instruction Files"
    ADD CONSTRAINT "Instruction Files_status_check"
    CHECK (status = ANY (ARRAY['active'::text, 'archived'::text]));
ALTER TABLE public."Instruction Files"
    ADD CONSTRAINT "Instruction Files_instruction_id_fkey"
    FOREIGN KEY (instruction_id) REFERENCES public."Instructions"(id) ON DELETE CASCADE;

-- Indeks pod JOIN po instrukcji.
CREATE INDEX IF NOT EXISTS "Instruction Files_instruction_id_idx"
    ON public."Instruction Files" (instruction_id);

-- Najwyżej jedna AKTYWNA wersja na (instrukcja, język) — poprzednie idą do archiwum.
CREATE UNIQUE INDEX IF NOT EXISTS "Instruction Files_active_lang_uidx"
    ON public."Instruction Files" (instruction_id, language)
    WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 3. GRANT-y (nowe tabele — role API self-hosted Supabase)
-- ---------------------------------------------------------------------------
GRANT ALL ON public."Instructions"      TO anon, authenticated, service_role;
GRANT ALL ON public."Instruction Files" TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. RLS — jak inne tabele danych: pełny dostęp dla `authenticated`.
-- ---------------------------------------------------------------------------
ALTER TABLE public."Instructions"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Instruction Files" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_all ON public."Instructions";
CREATE POLICY authenticated_all ON public."Instructions"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_all ON public."Instruction Files";
CREATE POLICY authenticated_all ON public."Instruction Files"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. STORAGE — prywatny bucket `instructions` + polityki dostępu
-- ---------------------------------------------------------------------------
-- file_size_limit = 300 MB (zapas nad plikiem surowym ~200 MB). UWAGA: limit
-- bucketu nie może przekroczyć globalnego FILE_SIZE_LIMIT serwisu `storage`
-- (env w stacku Dockge) — ustaw go na ≥ 300 MB, inaczej upload zostanie odrzucony.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('instructions', 'instructions', false, 314572800)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      public          = EXCLUDED.public;

-- Dostęp do obiektów bucketu dla zalogowanych (fine-grained perms po stronie
-- aplikacji; pliki serwowane przez signed URL). Anon nie ma dostępu.
DROP POLICY IF EXISTS "instructions_objects_authenticated_all" ON storage.objects;
CREATE POLICY "instructions_objects_authenticated_all" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'instructions')
    WITH CHECK (bucket_id = 'instructions');
