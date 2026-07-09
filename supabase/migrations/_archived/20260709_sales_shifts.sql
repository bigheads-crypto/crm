-- =============================================================================
-- Zmiany działu Sprzedaż (handlowiec): 08:00–16:00 i 16:00–24:00
-- =============================================================================
-- Zmiany są per dział (shift_types.department), więc to dotyczy TYLKO handlowców.
-- UPDATE w miejscu (nie DELETE) — zachowuje id, więc już wpisany grafik
-- (schedule_entries.shift_type_id) pozostaje powiązany.
--
-- Idempotentne — bezpieczne do ponownego odpalenia.
-- =============================================================================

-- Rano 08:00–16:00
UPDATE public.shift_types SET start_time = '08:00', end_time = '16:00'
  WHERE department = 'handlowiec' AND name = 'Rano';
INSERT INTO public.shift_types (department, name, start_time, end_time, color)
  SELECT 'handlowiec', 'Rano', '08:00', '16:00', '#e07818'
  WHERE NOT EXISTS (SELECT 1 FROM public.shift_types WHERE department = 'handlowiec' AND name = 'Rano');

-- Popołudnie 16:00–24:00
UPDATE public.shift_types SET start_time = '16:00', end_time = '24:00'
  WHERE department = 'handlowiec' AND name = 'Popołudnie';
INSERT INTO public.shift_types (department, name, start_time, end_time, color)
  SELECT 'handlowiec', 'Popołudnie', '16:00', '24:00', '#3b82f6'
  WHERE NOT EXISTS (SELECT 1 FROM public.shift_types WHERE department = 'handlowiec' AND name = 'Popołudnie');
