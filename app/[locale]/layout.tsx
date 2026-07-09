// Layout dla wszystkich stron z obsługą locale
// Opakowuje zawartość w NextIntlClientProvider

import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { checkPublicEnv } from '@/lib/env'
import { ConfigErrorScreen } from '@/components/shared/ConfigErrorScreen'

const locales = ['pl', 'en']

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  // W Next.js 16 params jest Promise
  const { locale } = await params

  // Jeśli locale nie jest obsługiwany, zwróć 404
  if (!locales.includes(locale)) {
    notFound()
  }

  // Załaduj tłumaczenia dla danego locale
  const messages = await getMessages()

  // Walidacja konfiguracji przy starcie: gdy brakuje zmiennych połączenia z bazą,
  // pokaż czytelny ekran zamiast surowego crasha (wewnątrz providera → i18n działa).
  const env = checkPublicEnv()

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      {env.ok ? children : <ConfigErrorScreen missing={env.missing} />}
    </NextIntlClientProvider>
  )
}
