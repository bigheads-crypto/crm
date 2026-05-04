'use client'

// Navbar — górny pasek z tytułem strony, przełącznikiem języka i menu użytkownika

import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { LogOut, ChevronDown, UserCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Mapowanie fragmentu URL na klucz tłumaczenia tytułu
const PATH_TO_TITLE: Record<string, string> = {
  dashboard: 'Dashboard',
  'sales-deals': 'Transakcje',
  'sales-quality': 'Jakość sprzedaży',
  sales: 'Zamówienia',
  'sales-text-log': 'SMS Sprzedaż',
  'support-cases': 'Sprawy supportu',
  'support-log': 'Log supportu',
  'support-text-log': 'SMS Support',
  candidates: 'Kandydaci',
  machines: 'Maszyny',
  users: 'Użytkownicy',
  permissions: 'Uprawnienia zakładek',
  settings: 'Profil użytkownika',
}

interface NavbarProps {
  userEmail: string
  locale: string
}

export function Navbar({ userEmail, locale }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Pobierz tytuł strony z pathname
  const segments = pathname.split('/').filter(Boolean)
  const lastSegment = segments[segments.length - 1] || ''
  const pageTitle = PATH_TO_TITLE[lastSegment] || '4DPF CRM'

  // Przełącz język zachowując resztę ścieżki
  const switchLocale = (newLocale: string) => {
    const parts = pathname.split('/')
    parts[1] = newLocale // zastąp segment locale
    router.push(parts.join('/'))
  }

  // Wyloguj użytkownika
  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/${locale}/login`)
  }

  // Inicjały użytkownika do avatara
  const initials = userEmail
    ? userEmail.split('@')[0].slice(0, 2).toUpperCase()
    : '??'

  return (
    <header
      className="flex items-center justify-between h-14 px-6 flex-shrink-0"
      style={{
        backgroundColor: 'var(--sidebar)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Tytuł strony */}
      <h1 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
        {pageTitle}
      </h1>

      <div className="flex items-center gap-3">
        {/* Przełącznik języka PL / EN */}
        <div
          className="flex items-center gap-0.5 rounded-lg p-1"
          style={{ backgroundColor: 'var(--surface)' }}
        >
          {['pl', 'en'].map((loc) => (
            <button
              key={loc}
              onClick={() => switchLocale(loc)}
              className="rounded-md px-2.5 py-1 text-xs font-semibold uppercase transition-colors"
              style={{
                backgroundColor: locale === loc ? 'var(--accent)' : 'transparent',
                color: locale === loc ? '#ffffff' : 'var(--text-muted)',
              }}
            >
              {loc}
            </button>
          ))}
        </div>

        {/* Menu użytkownika */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              {/* Avatar z inicjałami */}
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
              >
                {initials}
              </div>
              <span className="text-sm hidden sm:block" style={{ color: 'var(--text)' }}>
                {userEmail.split('@')[0]}
              </span>
              <ChevronDown size={13} />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-44 rounded-xl p-1.5 shadow-xl"
              style={{
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
              }}
              align="end"
              sideOffset={6}
            >
              {/* Email użytkownika */}
              <div className="px-3 py-2 mb-1" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>
                  {userEmail}
                </p>
              </div>

              {/* Profil użytkownika */}
              <DropdownMenu.Item
                onSelect={() => router.push(`/${locale}/settings`)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none transition-colors"
                style={{ color: 'var(--text)' }}
              >
                <UserCircle size={13} />
                Profil użytkownika
              </DropdownMenu.Item>

              {/* Wyloguj */}
              <DropdownMenu.Item
                onSelect={handleSignOut}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none transition-colors"
                style={{ color: 'var(--danger)' }}
              >
                <LogOut size={13} />
                Wyloguj się
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
