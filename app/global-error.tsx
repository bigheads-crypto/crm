'use client'

// Globalna granica błędu — łapie wyjątki rzucone w SAMYM root/[locale] layout
// (gdy zwykły error.tsx nie zdąży się zamontować). Zastępuje root layout, więc
// musi renderować własne <html>/<body> i importować globalne style.
//
// UWAGA i18n: tutaj provider next-intl NIE jest dostępny (jesteśmy ponad nim),
// więc wyjątkowo teksty są wpisane wprost. Domyślny język aplikacji to polski.

import { useEffect } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { ErrorScreen } from '@/components/shared/ErrorScreen'
import './globals.css'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="pl" className="dark h-full">
      <body className="h-full">
        <ErrorScreen
          icon={<AlertTriangle size={22} />}
          title="Coś poszło nie tak"
          message="Wystąpił nieoczekiwany błąd aplikacji. Spróbuj ponownie."
        >
          <button
            onClick={reset}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
            style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
          >
            <RotateCw size={14} />
            Spróbuj ponownie
          </button>
        </ErrorScreen>
      </body>
    </html>
  )
}
