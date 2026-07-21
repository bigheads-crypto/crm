-- =============================================================================
-- Moduł Instrukcje — spłaszczenie: KAŻDY PLIK = OSOBNY WPIS
-- =============================================================================
-- Zmiana modelu (decyzja właściciela): edytowalny (SVG) i PDF nie są parą pod
-- jednym wpisem — każdy plik to osobna pozycja w folderze, z własną nazwą,
-- językiem, numerem wersji i pobieraniem. `Instructions` staje się tabelą
-- wpisów-plików; tabela `Instruction Files` (para SVG+PDF) zostaje usunięta.
--
-- Typ pliku (SVG/PDF/inny) wynika z rozszerzenia `file_name` — bez osobnej kolumny.
-- Poprzednie wersje pliku żyją w Storage pod ścieżkami {id}/v{n}.{ext} (Archiwum).
-- =============================================================================

-- Usuwamy tabelę par SVG+PDF (model porzucony).
DROP TABLE IF EXISTS public."Instruction Files" CASCADE;

-- `Instructions` = wpis-plik. Dokładamy kolumny pliku/wersji/języka.
ALTER TABLE public."Instructions" ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE public."Instructions" ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public."Instructions" ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public."Instructions" ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public."Instructions" ADD COLUMN IF NOT EXISTS uploaded_by uuid;

ALTER TABLE public."Instructions" DROP CONSTRAINT IF EXISTS "Instructions_language_check";
ALTER TABLE public."Instructions" ADD CONSTRAINT "Instructions_language_check"
  CHECK (language IS NULL OR language = ANY (ARRAY['pl'::text, 'en'::text, 'es'::text]));

-- Zostają z poprzednich migracji: id, created_at, updated_at, folder_id (FK),
-- title (= nazwa wpisu), notes, status (active|archived).
