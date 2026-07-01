'use client'

// Granica błędu dla całego drzewa [locale] (dashboard i podstrony).
// Łapie nieoczekiwane wyjątki Server/Client Components i pokazuje brandowany fallback
// zamiast surowego ekranu Next.js. Opakowane przez [locale]/layout, więc provider
// next-intl jest dostępny → używamy useTranslations.

import { useEffect } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { ErrorScreen } from '@/components/shared/ErrorScreen'

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errors')
  const locale = useLocale()

  useEffect(() => {
    // Log dla diagnostyki (widoczny w konsoli / logach serwera)
    console.error(error)
  }, [error])

  return (
    <ErrorScreen
      icon={<AlertTriangle size={22} />}
      title={t('genericTitle')}
      message={t('genericMessage')}
    >
      <button
        onClick={reset}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
        style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
      >
        <RotateCw size={14} />
        {t('retry')}
      </button>
      <Link
        href={`/${locale}/dashboard`}
        className="flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
        style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
      >
        {t('backHome')}
      </Link>
    </ErrorScreen>
  )
}
