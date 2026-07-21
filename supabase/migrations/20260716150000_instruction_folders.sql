-- =============================================================================
-- Moduł Instrukcje — FOLDERY (drzewo) zamiast kolumn taksonomii
-- =============================================================================
-- Zmiana kierunku: nawigacja jak w Eksploratorze — Kubota → DPF only / DPF+SCR
-- → instrukcje lub kolejne foldery. Dowolne zagnieżdżenie, przycisk „Nowy folder".
-- Ścieżka folderów ZASTĘPUJE kolumny marka/emisja/wariant. Instrukcja = nazwany
-- wpis (`title`) w folderze; wersje językowe (SVG+PDF) dalej w `Instruction Files`.
--
-- Usuwanie folderu tylko gdy pusty: FK `parent_id` i `folder_id` = ON DELETE
-- RESTRICT (nie można skasować folderu z podfolderami ani z instrukcjami).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABELA FOLDERÓW (samoreferencyjne drzewo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."Instruction Folders" (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    parent_id bigint,               -- NULL = folder w korzeniu
    name text NOT NULL
);

-- PK dodajemy tylko gdy go nie ma — NIE dropujemy (zależą od niego FK,
-- więc drop przy ponownym uruchomieniu by się wywalił: 2BP01).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Instruction Folders_pkey'
      AND conrelid = 'public."Instruction Folders"'::regclass
  ) THEN
    ALTER TABLE public."Instruction Folders" ADD CONSTRAINT "Instruction Folders_pkey" PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE public."Instruction Folders"
    DROP CONSTRAINT IF EXISTS "Instruction Folders_parent_id_fkey";
ALTER TABLE public."Instruction Folders"
    ADD CONSTRAINT "Instruction Folders_parent_id_fkey"
    FOREIGN KEY (parent_id) REFERENCES public."Instruction Folders"(id) ON DELETE RESTRICT;

-- Unikalność nazwy w obrębie rodzica (COALESCE, by objąć też korzeń parent_id=NULL).
CREATE UNIQUE INDEX IF NOT EXISTS "Instruction Folders_parent_name_uidx"
    ON public."Instruction Folders" (COALESCE(parent_id, -1), name);
CREATE INDEX IF NOT EXISTS "Instruction Folders_parent_id_idx"
    ON public."Instruction Folders" (parent_id);

GRANT ALL ON public."Instruction Folders" TO anon, authenticated, service_role;

ALTER TABLE public."Instruction Folders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_all ON public."Instruction Folders";
CREATE POLICY authenticated_all ON public."Instruction Folders"
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. INSTRUCTIONS — foldery zamiast kolumn taksonomii
-- ---------------------------------------------------------------------------
ALTER TABLE public."Instructions"
    ADD COLUMN IF NOT EXISTS folder_id bigint;

ALTER TABLE public."Instructions"
    DROP CONSTRAINT IF EXISTS "Instructions_folder_id_fkey";
ALTER TABLE public."Instructions"
    ADD CONSTRAINT "Instructions_folder_id_fkey"
    FOREIGN KEY (folder_id) REFERENCES public."Instruction Folders"(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "Instructions_folder_id_idx"
    ON public."Instructions" (folder_id);

-- Kolumny taksonomii zastąpione ścieżką folderów — usuwamy.
ALTER TABLE public."Instructions" DROP COLUMN IF EXISTS brand;
ALTER TABLE public."Instructions" DROP COLUMN IF EXISTS emission_type;
ALTER TABLE public."Instructions" DROP COLUMN IF EXISTS engine_variant;
ALTER TABLE public."Instructions" DROP COLUMN IF EXISTS product_marking;
ALTER TABLE public."Instructions" DROP COLUMN IF EXISTS category;
-- Zostają: title (nazwa instrukcji), notes, status, folder_id, created/updated_at.
