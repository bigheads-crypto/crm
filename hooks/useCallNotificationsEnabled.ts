'use client'

// Globalny przełącznik powiadomień o rozmowach (dyżur handlowca).
// Stan trzymany w localStorage; współdzielony między Navbar (przełącznik) a
// CallPopupHost (konsument) przez event okna (ten sam tab) + storage event (inne taby).

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'crm:callNotificationsEnabled'
const TOGGLE_EVENT = 'crm:callNotificationsToggle'

export function useCallNotificationsEnabled() {
  // Domyślnie włączone; hydratacja z localStorage w useEffect (anty-pattern: lazy init z localStorage w RSC).
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) setEnabled(stored === '1')
    } catch {
      // brak dostępu do localStorage — zostaje domyślne (włączone)
    }

    function onToggle(e: Event) {
      const detail = (e as CustomEvent<{ enabled: boolean }>).detail
      if (detail) setEnabled(detail.enabled)
    }
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue !== null) setEnabled(e.newValue === '1')
    }
    window.addEventListener(TOGGLE_EVENT, onToggle)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(TOGGLE_EVENT, onToggle)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      // brak dostępu do localStorage — stan zostaje tylko w pamięci
    }
    window.dispatchEvent(new CustomEvent(TOGGLE_EVENT, { detail: { enabled: next } }))
  }

  return { enabled, toggle }
}
