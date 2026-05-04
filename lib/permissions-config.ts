import type { Role } from '@/lib/supabase/types'

export const ALL_ROLES: Role[] = ['admin', 'manager', 'handlowiec', 'support', 'hr', 'logistyka']
export const EDITABLE_ROLES: Role[] = ['manager', 'handlowiec', 'support', 'hr', 'logistyka']

export interface TabDef {
  key: string
  label: string
}

export interface TabPerms {
  canView: boolean
  canWrite: boolean
  canEdit: boolean
}

export const PERM_TYPES: { key: keyof TabPerms; label: string }[] = [
  { key: 'canView', label: 'Wyświetlanie' },
  { key: 'canWrite', label: 'Wpisywanie' },
  { key: 'canEdit', label: 'Edytowanie' },
]

export const TAB_DEFS: TabDef[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'sales-deals', label: 'Transakcje' },
  { key: 'sales-quality', label: 'Jakość sprzedaży' },
  { key: 'sales', label: 'Zamówienia' },
  { key: 'sales-text-log', label: 'SMS Sprzedaż' },
  { key: 'support-cases', label: 'Sprawy support' },
  { key: 'support-log', label: 'Log support' },
  { key: 'support-text-log', label: 'SMS Support' },
  { key: 'candidates', label: 'Kandydaci' },
  { key: 'machines', label: 'Maszyny' },
  { key: 'domains', label: 'Domeny' },
  { key: 'hostings', label: 'Hostingi' },
  { key: 'admin/activity-log', label: 'Logi aktywności' },
]

// Które role mogą widzieć daną zakładkę (domyślne)
const DEFAULT_VIEW: Record<string, Role[]> = {
  'dashboard': ['admin', 'manager', 'handlowiec', 'support', 'hr', 'logistyka'],
  'sales-deals': ['admin', 'handlowiec', 'manager'],
  'sales-quality': ['admin', 'handlowiec', 'manager'],
  'sales': ['admin', 'handlowiec', 'logistyka', 'manager'],
  'sales-text-log': ['admin', 'handlowiec', 'manager'],
  'support-cases': ['admin', 'support', 'manager'],
  'support-log': ['admin', 'support', 'manager'],
  'support-text-log': ['admin', 'support', 'manager'],
  'candidates': ['admin', 'hr', 'manager'],
  'machines': ['admin', 'handlowiec', 'logistyka', 'manager'],
  'domains': ['admin', 'manager'],
  'hostings': ['admin', 'manager'],
  'admin/users': ['admin'],
  'admin/permissions': ['admin'],
  'admin/activity-log': ['admin', 'manager'],
}

export function getDefaultPerms(tabKey: string, role: Role): TabPerms {
  const canView = DEFAULT_VIEW[tabKey]?.includes(role) ?? false
  return { canView, canWrite: canView, canEdit: canView }
}

export const DEFAULT_VIEW_MAP = DEFAULT_VIEW
