'use client'

// Strona 404 dla nieznanych tras w obrębie locale (np. /pl/nieistnieje).
// Renderowana wewnątrz [locale]/layout → provider next-intl dostępny.

import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { SearchX } from 'lucide-react'
import { ErrorScreen } from '@/components/shared/ErrorScreen'

export default function LocaleNotFound() {
  const t = useTranslations('errors')
  const locale = useLocale()

  return (
    <ErrorScreen
      icon={<SearchX size={22} />}
      title={t('notFoundTitle')}
      message={t('notFoundMessage')}
    >
      <Link
        href={`/${locale}/dashboard`}
        className="flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
        style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
      >
        {t('backHome')}
      </Link>
    </ErrorScreen>
  )
}
