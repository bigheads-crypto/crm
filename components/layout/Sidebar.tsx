'use client'

// Sidebar nawigacyjny — chowany (collapsible), filtrowany po roli użytkownika

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  Handshake,
  Star,
  ShoppingCart,
  MessageSquare,
  HeadphonesIcon,
  ClipboardList,
  MessageCircle,
  Users,
  Cpu,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from '@/lib/supabase/types'
import { APP_VERSION } from '@/lib/version'

interface NavItem {
  key: string
  href: string
  icon: LucideIcon
  roles: Role[]
}

// Mapa nawigacji — klucz, href i dozwolone role
const NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'handlowiec', 'support', 'hr', 'logistyka'],
  },
  {
    key: 'salesDeals',
    href: '/sales-deals',
    icon: Handshake,
    roles: ['admin', 'handlowiec', 'manager'],
  },
  {
    key: 'salesQuality',
    href: '/sales-quality',
    icon: Star,
    roles: ['admin', 'handlowiec', 'manager'],
  },
  {
    key: 'sales',
    href: '/sales',
    icon: ShoppingCart,
    roles: ['admin', 'handlowiec', 'logistyka', 'manager'],
  },
  {
    key: 'salesTextLog',
    href: '/sales-text-log',
    icon: MessageSquare,
    roles: ['admin', 'handlowiec', 'manager'],
  },
  {
    key: 'supportCases',
    href: '/support-cases',
    icon: HeadphonesIcon,
    roles: ['admin', 'support', 'manager'],
  },
  {
    key: 'supportLog',
    href: '/support-log',
    icon: ClipboardList,
    roles: ['admin', 'support', 'manager'],
  },
  {
    key: 'supportTextLog',
    href: '/support-text-log',
    icon: MessageCircle,
    roles: ['admin', 'support', 'manager'],
  },
  {
    key: 'candidates',
    href: '/candidates',
    icon: Users,
    roles: ['admin', 'hr', 'manager'],
  },
  {
    key: 'machines',
    href: '/machines',
    icon: Cpu,
    roles: ['admin', 'handlowiec', 'logistyka', 'manager'],
  },
  {
    key: 'adminUsers',
    href: '/admin/users',
    icon: Settings,
    roles: ['admin'],
  },
]

interface SidebarProps {
  role: Role
  locale: string
}

export function Sidebar({ role, locale }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const t = useTranslations('nav')

  // Filtruj elementy nawigacji po roli
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))

  // Sprawdź czy link jest aktywny
  const isActive = (href: string) => {
    const fullHref = `/${locale}${href}`
    return pathname === fullHref || pathname.startsWith(`${fullHref}/`)
  }

  return (
    <aside
      className="relative flex flex-col h-full transition-all duration-300 flex-shrink-0"
      style={{
        width: collapsed ? '64px' : '240px',
        backgroundColor: 'var(--sidebar)',
        borderRight: '1px solid var(--border)',
        boxShadow: '2px 0 12px rgba(0,0,0,0.3)',
      }}
    >
      {/* Logo / nagłówek */}
      <div
        className="flex items-center justify-center h-14 px-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {!collapsed && (
          <div
            className="flex flex-col items-center justify-center w-full py-1"
            style={{
              border: '1.5px solid var(--accent)',
              borderRadius: '6px',
            }}
          >
            <span className="text-sm font-bold leading-tight" style={{ color: 'var(--text)' }}>
              4DPF
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              CRM System
            </span>
          </div>
        )}
        {collapsed && (
          <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>4D</span>
        )}
      </div>

      {/* Lista nawigacji */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.key}
              href={`/${locale}${item.href}`}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 mb-0.5 transition-colors text-sm font-medium"
              style={{
                backgroundColor: active ? 'rgba(239, 127, 26, 0.12)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
              }}
              title={collapsed ? t(item.key as Parameters<typeof t>[0]) : undefined}
            >
              <Icon size={17} className="flex-shrink-0" />
              {!collapsed && (
                <span className="truncate">{t(item.key as Parameters<typeof t>[0])}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Wersja + przycisk zwijania */}
      <div className="flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        {!collapsed && (
          <div className="px-4 pt-2 pb-0 text-center">
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>v{APP_VERSION}</span>
          </div>
        )}
        <div className="p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-lg p-2 transition-colors"
            style={{ color: 'var(--text-dim)' }}
            title={collapsed ? 'Rozwiń sidebar' : 'Zwiń sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>
    </aside>
  )
}
