// Konfiguracja next-intl dla App Router
// Plik wymagany przez createNextIntlPlugin w next.config.ts

import { getRequestConfig } from 'next-intl/server'

const locales = ['pl', 'en']
const defaultLocale = 'pl'

export default getRequestConfig(async ({ requestLocale }) => {
  // Pobierz locale z segmentu [locale] w URL
  let locale = await requestLocale

  // Fallback do domyślnego locale jeśli brak lub nieobsługiwany
  if (!locale || !locales.includes(locale)) {
    locale = defaultLocale
  }

  return {
    locale,
    messages: (await import(`../i18n/${locale}.json`)).default,
  }
})
