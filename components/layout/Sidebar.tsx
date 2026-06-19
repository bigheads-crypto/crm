'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard, Handshake, Star, ShoppingCart, MessageSquare,
  HeadphonesIcon, ClipboardList, MessageCircle, Users, Cpu, Settings,
  Globe, Server, Shield, Activity, ChevronLeft, ChevronRight, ChevronDown,
  BookMarked, AlertTriangle, ThumbsUp, Package, Layers, Cable, CircuitBoard,
  FileCode, UserRound, GripVertical,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Role } from '@/lib/supabase/types'
import { APP_VERSION } from '@/lib/version'

interface NavItem {
  key: string
  href: string
  icon: LucideIcon
  tabKey?: string
}

interface NavGroup {
  groupKey: string
  labelKey: string
  icon: LucideIcon
  items: NavItem[]
}

type NavEntry = NavItem | NavGroup

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'groupKey' in entry
}

function entryId(entry: NavEntry) {
  return isNavGroup(entry) ? entry.groupKey : entry.key
}

const NAV_ENTRIES: NavEntry[] = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'clients', href: '/clients', icon: UserRound },
  { key: 'salesDeals', href: '/sales-deals', icon: Handshake },
  { key: 'salesQuality', href: '/sales-quality', icon: Star },
  { key: 'sales', href: '/sales', icon: ShoppingCart },
  { key: 'salesTextLog', href: '/sales-text-log', icon: MessageSquare },
  { key: 'supportCases', href: '/support-cases', icon: HeadphonesIcon },
  { key: 'supportBacklog', href: '/support-backlog', icon: BookMarked },
  { key: 'supportLog', href: '/support-log', icon: ClipboardList },
  { key: 'supportTextLog', href: '/support-text-log', icon: MessageCircle },
  { key: 'candidates', href: '/candidates', icon: Users },
  { key: 'machines', href: '/machines', icon: Cpu },
  { key: 'machineIssues', href: '/machine-issues', icon: AlertTriangle },
  { key: 'reviews', href: '/reviews', icon: ThumbsUp },
  {
    groupKey: 'warehouse',
    labelKey: 'warehouse',
    icon: Package,
    items: [
      { key: 'warehouseZestawy', href: '/warehouse/zestawy', tabKey: 'warehouse-zestawy', icon: Layers },
      { key: 'warehouseEmulatory', href: '/warehouse', tabKey: 'warehouse', icon: Cpu },
      { key: 'warehouseWiazki', href: '/warehouse/wiazki', tabKey: 'warehouse-wiazki', icon: Cable },
      { key: 'warehouseHardware', href: '/warehouse/hardware', tabKey: 'warehouse-hardware', icon: CircuitBoard },
      { key: 'warehouseSoftware', href: '/warehouse/software', tabKey: 'warehouse-software', icon: FileCode },
    ],
  },
  { key: 'domains', href: '/domains', icon: Globe },
  { key: 'hostings', href: '/hostings', icon: Server },
  { key: 'adminUsers', href: '/admin/users', icon: Settings },
  { key: 'adminPermissions', href: '/admin/permissions', icon: Shield },
  { key: 'activityLog', href: '/admin/activity-log', icon: Activity },
]

const DEFAULT_ORDER = NAV_ENTRIES.map(entryId)
const STORAGE_KEY = 'crm-sidebar-order'

function loadOrder(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return DEFAULT_ORDER
    const parsed = JSON.parse(saved) as string[]
    const validIds = new Set(DEFAULT_ORDER)
    const filtered = parsed.filter(id => validIds.has(id))
    const missing = DEFAULT_ORDER.filter(id => !filtered.includes(id))
    return [...filtered, ...missing]
  } catch {
    return DEFAULT_ORDER
  }
}

function saveOrder(order: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)) } catch {}
}

// ─── Sortable NavItem ────────────────────────────────────────────────────────

interface SortableItemProps {
  entry: NavItem
  locale: string
  collapsed: boolean
  isActive: (href: string) => boolean
  t: ReturnType<typeof useTranslations>
}

function SortableNavItem({ entry, locale, collapsed, isActive, t }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.key })
  const active = isActive(entry.href)
  const Icon = entry.icon

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        position: 'relative',
      }}
      className="group"
    >
      <Link
        href={`/${locale}${entry.href}`}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 mb-0.5 transition-colors text-sm font-medium"
        style={{
          backgroundColor: active ? 'rgba(239, 127, 26, 0.12)' : 'transparent',
          color: active ? 'var(--accent)' : 'var(--text-muted)',
          borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
          paddingRight: collapsed ? undefined : '28px',
        }}
        title={collapsed ? String(t(entry.key as Parameters<typeof t>[0])) : undefined}
      >
        <Icon size={17} className="flex-shrink-0" />
        {!collapsed && (
          <span className="truncate flex-1">{t(entry.key as Parameters<typeof t>[0])}</span>
        )}
      </Link>
      {!collapsed && (
        <span
          {...attributes}
          {...listeners}
          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          style={{ color: 'var(--text-dim)', touchAction: 'none' }}
          title="Przeciągnij aby zmienić kolejność"
        >
          <GripVertical size={13} />
        </span>
      )}
    </div>
  )
}

// ─── Sortable NavGroup ───────────────────────────────────────────────────────

interface SortableGroupProps {
  entry: NavGroup
  locale: string
  collapsed: boolean
  isItemVisible: (item: NavItem) => boolean
  isActive: (href: string) => boolean
  isGroupActive: (group: NavGroup) => boolean
  expandedGroups: Set<string>
  toggleGroup: (key: string) => void
  t: ReturnType<typeof useTranslations>
}

function SortableNavGroup({
  entry, locale, collapsed, isItemVisible, isActive, isGroupActive, expandedGroups, toggleGroup, t,
}: SortableGroupProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.groupKey })
  const active = isGroupActive(entry)
  const expanded = expandedGroups.has(entry.groupKey)
  const visibleSubItems = entry.items.filter(isItemVisible)
  const GroupIcon = entry.icon

  if (collapsed) {
    const firstItem = visibleSubItems[0]
    return (
      <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
        <Link
          href={firstItem ? `/${locale}${firstItem.href}` : '#'}
          className="flex items-center justify-center rounded-lg px-3 py-2.5 mb-0.5 transition-colors"
          style={{ color: active ? 'var(--accent)' : 'var(--text-muted)', borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent' }}
          title={String(t(entry.labelKey as Parameters<typeof t>[0]))}
        >
          <GroupIcon size={17} />
        </Link>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="group"
    >
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => toggleGroup(entry.groupKey)}
          className="flex items-center w-full gap-3 rounded-lg px-3 py-2.5 mb-0.5 transition-colors text-sm font-medium"
          style={{ color: active ? 'var(--accent)' : 'var(--text-muted)', borderLeft: '2px solid transparent', paddingRight: '28px' }}
        >
          <GroupIcon size={17} className="flex-shrink-0" />
          <span className="truncate flex-1 text-left">{t(entry.labelKey as Parameters<typeof t>[0])}</span>
          <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms', flexShrink: 0 }} />
        </button>
        <span
          {...attributes}
          {...listeners}
          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          style={{ color: 'var(--text-dim)', touchAction: 'none' }}
          title="Przeciągnij aby zmienić kolejność"
        >
          <GripVertical size={13} />
        </span>
      </div>

      {expanded && visibleSubItems.map(item => {
        const SubIcon = item.icon
        const subActive = isActive(item.href)
        return (
          <Link
            key={item.key}
            href={`/${locale}${item.href}`}
            className="flex items-center gap-3 rounded-lg py-2 mb-0.5 transition-colors text-sm"
            style={{
              marginLeft: '14px', paddingLeft: '10px', paddingRight: '12px',
              backgroundColor: subActive ? 'rgba(239, 127, 26, 0.12)' : 'transparent',
              color: subActive ? 'var(--accent)' : 'var(--text-muted)',
              borderLeft: subActive ? '2px solid var(--accent)' : '2px solid var(--border)',
              fontSize: '13px',
            }}
          >
            <SubIcon size={14} className="flex-shrink-0" />
            <span className="truncate">{t(item.key as Parameters<typeof t>[0])}</span>
          </Link>
        )
      })}
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  role: Role
  locale: string
  allowedTabs: string[]
}

export function Sidebar({ locale, allowedTabs }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const t = useTranslations('nav')

  const [entryOrder, setEntryOrder] = useState<string[]>(DEFAULT_ORDER)

  useEffect(() => {
    setEntryOrder(loadOrder())
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const getItemTabKey = (item: NavItem) => item.tabKey ?? item.href.replace(/^\//, '')
  const isItemVisible = (item: NavItem) => allowedTabs.includes(getItemTabKey(item))
  const isEntryVisible = (entry: NavEntry) => {
    if (isNavGroup(entry)) return entry.items.some(isItemVisible)
    return allowedTabs.includes((entry as NavItem).tabKey ?? (entry as NavItem).href.replace(/^\//, ''))
  }
  const isActive = (href: string) => pathname === `/${locale}${href}`
  const isGroupActive = (group: NavGroup) => group.items.some(item => isActive(item.href))

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    NAV_ENTRIES.forEach(entry => {
      if (isNavGroup(entry) && entry.items.some(item => pathname === `/${locale}${item.href}`)) {
        initial.add(entry.groupKey)
      }
    })
    return initial
  })

  useEffect(() => {
    NAV_ENTRIES.forEach(entry => {
      if (isNavGroup(entry) && entry.items.some(item => pathname === `/${locale}${item.href}`)) {
        setExpandedGroups(prev => new Set([...prev, entry.groupKey]))
      }
    })
  }, [pathname, locale])

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const entryMap = new Map(NAV_ENTRIES.map(e => [entryId(e), e]))
  const orderedEntries = entryOrder
    .map(id => entryMap.get(id))
    .filter((e): e is NavEntry => !!e && isEntryVisible(e))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setEntryOrder(prev => {
      const oldIdx = prev.indexOf(String(active.id))
      const newIdx = prev.indexOf(String(over.id))
      const next = arrayMove(prev, oldIdx, newIdx)
      saveOrder(next)
      return next
    })
  }

  return (
    <aside
      className="relative flex flex-col h-full transition-all duration-300 flex-shrink-0"
      style={{ width: collapsed ? '64px' : '240px', backgroundColor: 'var(--sidebar)', borderRight: '1px solid var(--border)', boxShadow: '2px 0 12px rgba(0,0,0,0.3)' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-14 px-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        {!collapsed ? (
          <div className="flex flex-col items-center justify-center w-full py-1" style={{ border: '1.5px solid var(--accent)', borderRadius: '6px' }}>
            <span className="text-sm font-bold leading-tight" style={{ color: 'var(--text)' }}>4DPF</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>CRM System</span>
          </div>
        ) : (
          <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>4D</span>
        )}
      </div>

      {/* Nawigacja */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedEntries.map(entryId)} strategy={verticalListSortingStrategy}>
            {orderedEntries.map(entry => {
              if (isNavGroup(entry)) {
                return (
                  <SortableNavGroup
                    key={entry.groupKey}
                    entry={entry}
                    locale={locale}
                    collapsed={collapsed}
                    isItemVisible={isItemVisible}
                    isActive={isActive}
                    isGroupActive={isGroupActive}
                    expandedGroups={expandedGroups}
                    toggleGroup={toggleGroup}
                    t={t}
                  />
                )
              }
              return (
                <SortableNavItem
                  key={entry.key}
                  entry={entry}
                  locale={locale}
                  collapsed={collapsed}
                  isActive={isActive}
                  t={t}
                />
              )
            })}
          </SortableContext>
        </DndContext>
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
