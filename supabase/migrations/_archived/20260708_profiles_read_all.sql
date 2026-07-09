-- =============================================================================
-- profiles — odczyt dla wszystkich zalogowanych
-- =============================================================================
-- Problem: dotychczasowa polityka RLS na `profiles` pozwalała czytać tylko
-- własny wiersz (auth.uid() = id). Przez to moduł Grafik nie widział
-- współpracowników działu, a dropdown handlowców w Zamówieniach był niepełny.
--
-- profiles zawiera tylko: id, role, full_name, is_lead, created_at.
-- Maile i hasła są w auth.users (nie tutaj), więc szeroki odczyt jest bezpieczny.
--
-- Polityki SELECT sumują się (OR), więc ta nowa polityka poszerza dostęp;
-- ewentualną starą politykę „własny wiersz" można zostawić (staje się nadmiarowa).
--
-- Idempotentne — bezpieczne do ponownego odpalenia.
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_read_all_profiles ON public.profiles;
CREATE POLICY authenticated_read_all_profiles
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
