'use client'

// Hook nasłuchujący rozmów telefonicznych (QUO) przez Supabase Realtime.
// n8n zapisuje do tabeli `calls`: INSERT przy status='ringing', UPDATE przy
// 'completed'/'missed'. Hook zwraca aktywne (nieobsłużone) rozmowy, na podstawie
// których montowane są popupy dla handlowca.

import { useCallback, useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Call } from '@/lib/supabase/types'

// Ile minut wstecz pobierać przy pierwszym ładowaniu — żeby otwarcie CRM nie
// wskrzeszało starych, dawno zakończonych rozmów jako popupów.
const INITIAL_LOOKBACK_MINUTES = 120

export interface UseCallNotificationsResult {
  // Nieobsłużone rozmowy (handled=false), najnowsze pierwsze.
  activeCalls: Call[]
  // Oznacza rozmowę jako obsłużoną (handled=true) — zamyka popup.
  dismissCall: (id: number) => Promise<void>
  // Ręczne odświeżenie listy z bazy.
  refetch: () => Promise<void>
}

export function useCallNotifications(enabled: boolean = true): UseCallNotificationsResult {
  const [activeCalls, setActiveCalls] = useState<Call[]>([])

  // Pierwsze pobranie nieobsłużonych rozmów z ostatnich N minut.
  const refetch = useCallback(async () => {
    const supabase = createClient()
    const since = new Date(Date.now() - INITIAL_LOOKBACK_MINUTES * 60_000).toISOString()
    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .eq('handled', false)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('useCallNotifications: błąd pobierania', error.message)
      return
    }
    setActiveCalls((data ?? []) as Call[])
  }, [])

  useEffect(() => {
    // Powiadomienia wyłączone (handlowiec poza dyżurem) — bez subskrypcji.
    if (!enabled) {
      setActiveCalls([])
      return
    }

    refetch()

    // Dedykowana instancja klienta na kanał Realtime (tworzona tylko po stronie klienta).
    const supabase = createClient()
    const channel = supabase
      .channel('calls-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calls' },
        (payload: RealtimePostgresChangesPayload<Call>) => {
          setActiveCalls((prev) => {
            // DELETE — payload.old ma tylko klucz główny
            if (payload.eventType === 'DELETE') {
              const oldId = (payload.old as Partial<Call>)?.id
              return oldId == null ? prev : prev.filter((c) => c.id !== oldId)
            }

            const row = payload.new as Call
            if (!row) return prev

            // Obsłużona rozmowa — usuń z listy aktywnych popupów
            if (row.handled) {
              return prev.filter((c) => c.id !== row.id)
            }

            const idx = prev.findIndex((c) => c.id === row.id)
            if (idx === -1) {
              // Nowa rozmowa (INSERT 'ringing') — dodaj na górę
              return [row, ...prev]
            }
            // UPDATE istniejącej (np. ringing → completed) — podmień
            const next = [...prev]
            next[idx] = row
            return next
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, refetch])

  // Zamknięcie popupa = oznaczenie rozmowy jako obsłużonej.
  const dismissCall = useCallback(async (id: number) => {
    // Optymistycznie usuń z UI, potem zapisz do bazy.
    setActiveCalls((prev) => prev.filter((c) => c.id !== id))
    const supabase = createClient()
    const { error } = await supabase.from('calls').update({ handled: true }).eq('id', id)
    if (error) {
      console.error('useCallNotifications: błąd zamykania rozmowy', error.message)
    }
  }, [])

  return { activeCalls, dismissCall, refetch }
}
