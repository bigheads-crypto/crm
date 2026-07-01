'use client'

// Współdzielone hooki dla modułów *Client.tsx z DataTable.
// Cel: mniej round-tripów do Supabase przy montowaniu (optymalizacja #3 + #4).

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Wywołuje `fetchData` przy każdej zmianie jego referencji (zmiana strony,
 * sortu, filtrów), ale POMIJA pierwsze — montujące — wywołanie. Dane dla stanu
 * domyślnego (page=1, brak filtrów, domyślny sort) przyszły już z SSR jako
 * `initialData`, więc mount-fetch to zbędny, podwójny fetch (opt #4).
 *
 * Zastępuje wzorzec: `useEffect(() => { fetchData() }, [fetchData])`.
 *
 * WARUNEK: domyślny sort klienta musi zgadzać się z `order(...)` w page.tsx (SSR).
 */
export function useFetchOnParamChange(fetchData: () => void) {
  const isMount = useRef(true)
  useEffect(() => {
    if (isMount.current) {
      isMount.current = false
      return
    }
    fetchData()
  }, [fetchData])
}

type OptionsMap = Record<string, string[]>
type CacheEntry = { at: number; map: OptionsMap }

const OPTIONS_TTL = 5 * 60 * 1000 // 5 min
const optionsCache = new Map<string, CacheEntry>()

async function scanDistinct(table: string, columns: string[]): Promise<OptionsMap> {
  const supabase = createClient()
  const results = await Promise.all(
    columns.map((col) => supabase.from(table).select(col).not(col, 'is', null))
  )
  const map: OptionsMap = {}
  columns.forEach((col, i) => {
    const rows = (results[i].data ?? []) as unknown as Record<string, unknown>[]
    map[col] = [...new Set(rows.map((r) => r[col]).filter(Boolean) as string[])].sort()
  })
  return map
}

/**
 * Ładuje listy wartości (distinct per kolumna) do filtrów kolumnowych DataTable.
 * Wynik cache'owany per tabela w pamięci (TTL 5 min) — kolejne wejścia w moduł
 * w tej samej sesji nie powtarzają pełnych skanów kolumn (opt #3).
 *
 * Zwraca mapę `{ kolumna: string[] }`. Przy braku danych zwraca `{}` do czasu
 * załadowania (kolumny dostają wtedy `undefined` w filterOptions — jak dotąd).
 */
export function useFilterOptions(table: string, columns: string[]): OptionsMap {
  const [map, setMap] = useState<OptionsMap>(() => optionsCache.get(table)?.map ?? {})
  const colsKey = columns.join(',')
  const colsRef = useRef(columns)
  colsRef.current = columns

  useEffect(() => {
    const cached = optionsCache.get(table)
    if (cached && Date.now() - cached.at < OPTIONS_TTL) {
      setMap(cached.map)
      return
    }
    let active = true
    scanDistinct(table, colsRef.current).then((result) => {
      optionsCache.set(table, { at: Date.now(), map: result })
      if (active) setMap(result)
    })
    return () => {
      active = false
    }
  }, [table, colsKey])

  return map
}
