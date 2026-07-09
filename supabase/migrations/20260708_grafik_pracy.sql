-- =============================================================================
-- Grafik pracy — Etap 1: schemat DB + RLS
-- =============================================================================
-- Model: "dział" = rola pracownika (profiles.role). Kierownik działu = profil
-- z is_lead=true (zarządza grafikiem wszystkich o tej samej roli). Admin ma
-- dostęp globalny do wszystkich działów.
--
-- Uruchom w Supabase SQL Editor. Idempotentne (safe do ponownego odpalenia).
-- =============================================================================

-- --------------------------------------------------------------------------
-- 0. Kierownik działu — flaga na profiles
-- --------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_lead boolean NOT NULL DEFAULT false;

-- --------------------------------------------------------------------------
-- 1. Helpery RLS (SECURITY DEFINER — czytają profiles bez rekurencji RLS)
-- --------------------------------------------------------------------------
-- UWAGA: nie "current_role" — to zarezerwowane słowo w Postgresie.
CREATE OR REPLACE FUNCTION public.my_role()
  RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.my_is_lead()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(is_lead, false) FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.my_is_admin()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(role = 'admin', false) FROM public.profiles WHERE id = auth.uid()
$$;

-- Czy bieżący użytkownik może EDYTOWAĆ grafik danego działu
-- (kierownik tego działu lub admin).
CREATE OR REPLACE FUNCTION public.can_manage_department(dept text)
  RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT public.my_is_admin()
      OR (public.my_is_lead() AND public.my_role() = dept)
$$;

-- --------------------------------------------------------------------------
-- 2. shift_types — słownik zmian per dział
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_types (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  department  text NOT NULL,                 -- rola/dział, do którego należy zmiana
  name        text NOT NULL,                 -- np. 'Rano', 'Popołudnie', 'Nocka'
  start_time  time,
  end_time    time,
  color       text                           -- kolor badge (hex), np. '#e07818'
);

CREATE INDEX IF NOT EXISTS shift_types_department_idx
  ON public.shift_types (department);

-- --------------------------------------------------------------------------
-- 3. schedule_entries — właściwy grafik (kto / kiedy / jaka zmiana)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule_entries (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at     timestamptz NOT NULL DEFAULT now(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date      date NOT NULL,
  shift_type_id  bigint REFERENCES public.shift_types(id) ON DELETE SET NULL,
  department     text NOT NULL,              -- dział grafiku (= rola pracownika)
  status         text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'published')),
  note           text,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (user_id, work_date)                -- jedna zmiana na osobę na dzień
);

CREATE INDEX IF NOT EXISTS schedule_entries_dept_date_idx
  ON public.schedule_entries (department, work_date);
CREATE INDEX IF NOT EXISTS schedule_entries_user_idx
  ON public.schedule_entries (user_id);

-- --------------------------------------------------------------------------
-- 4. availability — dostępność wpisywana przez pracownika
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date    date NOT NULL,
  department   text NOT NULL,                -- = rola pracownika (do scope'u kierownika)
  kind         text NOT NULL DEFAULT 'available'
               CHECK (kind IN ('available', 'unavailable', 'preferred')),
  shift_pref   bigint REFERENCES public.shift_types(id) ON DELETE SET NULL,
  note         text,
  UNIQUE (user_id, work_date)
);

CREATE INDEX IF NOT EXISTS availability_user_date_idx
  ON public.availability (user_id, work_date);
CREATE INDEX IF NOT EXISTS availability_dept_date_idx
  ON public.availability (department, work_date);

-- --------------------------------------------------------------------------
-- 5. shift_swaps — zamiany dniówek (kolega akceptuje -> kierownik zatwierdza)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_swaps (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at         timestamptz NOT NULL DEFAULT now(),
  department         text NOT NULL,          -- dział zamiany (scope kierownika)
  requester_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_entry_id bigint NOT NULL REFERENCES public.schedule_entries(id) ON DELETE CASCADE,
  target_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_entry_id    bigint NOT NULL REFERENCES public.schedule_entries(id) ON DELETE CASCADE,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','accepted','rejected','approved','cancelled')),
  resolved_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at        timestamptz
);

CREATE INDEX IF NOT EXISTS shift_swaps_dept_status_idx
  ON public.shift_swaps (department, status);
CREATE INDEX IF NOT EXISTS shift_swaps_target_idx
  ON public.shift_swaps (target_id);
CREATE INDEX IF NOT EXISTS shift_swaps_requester_idx
  ON public.shift_swaps (requester_id);

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.shift_types      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_swaps      ENABLE ROW LEVEL SECURITY;

-- ---- shift_types --------------------------------------------------------
DROP POLICY IF EXISTS shift_types_select ON public.shift_types;
CREATE POLICY shift_types_select ON public.shift_types
  FOR SELECT TO authenticated
  USING (department = public.my_role() OR public.my_is_admin());

DROP POLICY IF EXISTS shift_types_write ON public.shift_types;
CREATE POLICY shift_types_write ON public.shift_types
  FOR ALL TO authenticated
  USING (public.can_manage_department(department))
  WITH CHECK (public.can_manage_department(department));

-- ---- schedule_entries ---------------------------------------------------
-- Cały dział widzi swój grafik; admin widzi wszystko.
DROP POLICY IF EXISTS schedule_entries_select ON public.schedule_entries;
CREATE POLICY schedule_entries_select ON public.schedule_entries
  FOR SELECT TO authenticated
  USING (department = public.my_role() OR public.my_is_admin());

-- Edytuje tylko kierownik działu (lub admin).
DROP POLICY IF EXISTS schedule_entries_write ON public.schedule_entries;
CREATE POLICY schedule_entries_write ON public.schedule_entries
  FOR ALL TO authenticated
  USING (public.can_manage_department(department))
  WITH CHECK (public.can_manage_department(department));

-- ---- availability -------------------------------------------------------
-- Widzi: swoje wiersze + kierownik działu + admin.
DROP POLICY IF EXISTS availability_select ON public.availability;
CREATE POLICY availability_select ON public.availability
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_manage_department(department)
  );

-- Zapisuje/edytuje/usuwa: tylko własne wiersze (i tylko dla swojego działu).
DROP POLICY IF EXISTS availability_write ON public.availability;
CREATE POLICY availability_write ON public.availability
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND department = public.my_role());

-- ---- shift_swaps --------------------------------------------------------
-- Widzą: uczestnicy + kierownik działu + admin.
DROP POLICY IF EXISTS shift_swaps_select ON public.shift_swaps;
CREATE POLICY shift_swaps_select ON public.shift_swaps
  FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR target_id = auth.uid()
    OR public.can_manage_department(department)
  );

-- Tworzy: tylko własną prośbę, we własnym dziale.
DROP POLICY IF EXISTS shift_swaps_insert ON public.shift_swaps;
CREATE POLICY shift_swaps_insert ON public.shift_swaps
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND department = public.my_role());

-- Aktualizuje: requester (anuluje), target (akceptuje/odrzuca), kierownik/admin (zatwierdza).
-- Egzekwowanie dozwolonych przejść statusu robi warstwa aplikacji.
DROP POLICY IF EXISTS shift_swaps_update ON public.shift_swaps;
CREATE POLICY shift_swaps_update ON public.shift_swaps
  FOR UPDATE TO authenticated
  USING (
    requester_id = auth.uid()
    OR target_id = auth.uid()
    OR public.can_manage_department(department)
  )
  WITH CHECK (
    requester_id = auth.uid()
    OR target_id = auth.uid()
    OR public.can_manage_department(department)
  );

-- Usuwa: requester lub kierownik/admin.
DROP POLICY IF EXISTS shift_swaps_delete ON public.shift_swaps;
CREATE POLICY shift_swaps_delete ON public.shift_swaps
  FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR public.can_manage_department(department));

-- =============================================================================
-- Seed — domyślne zmiany dla działów pracowniczych (edytowalne z UI później)
-- =============================================================================
INSERT INTO public.shift_types (department, name, start_time, end_time, color)
SELECT d, s.name, s.start_time, s.end_time, s.color
FROM (VALUES ('handlowiec'), ('support'), ('logistyka'), ('hr')) AS dept(d)
CROSS JOIN (VALUES
  ('Rano',       TIME '08:00', TIME '16:00', '#e07818'),
  ('Popołudnie', TIME '14:00', TIME '22:00', '#3b82f6')
) AS s(name, start_time, end_time, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.shift_types t
  WHERE t.department = dept.d AND t.name = s.name
);
