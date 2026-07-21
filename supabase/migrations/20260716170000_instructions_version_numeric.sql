-- =============================================================================
-- Moduł Instrukcje — numer wersji dziesiętny (np. v1.5)
-- =============================================================================
-- Zmiana `Instructions.version` z integer na numeric, żeby obsłużyć wersje
-- ułamkowe (v1.5, v2.3…) i inkrementację o 0.1. Domyślna wartość zostaje 1.
-- =============================================================================

ALTER TABLE public."Instructions" ALTER COLUMN version DROP DEFAULT;
ALTER TABLE public."Instructions" ALTER COLUMN version TYPE numeric USING version::numeric;
ALTER TABLE public."Instructions" ALTER COLUMN version SET DEFAULT 1;

-- Odśwież cache schematu PostgREST (zmiana typu kolumny).
NOTIFY pgrst, 'reload schema';
