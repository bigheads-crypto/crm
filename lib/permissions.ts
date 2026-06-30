import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/supabase/types'
import { TAB_DEFS, DEFAULT_VIEW_MAP, getDefaultPerms } from '@/lib/permissions-config'

interface TabPermRow { tab_key: string; can_view: boolean; can_write: boolean; can_edit: boolean }

// Wszystkie uprawnienia roli jednym zapytaniem, cache'owane per żądanie.
// Dzięki temu getAllowedTabs() (layout) i getTabWritePerms() (page) współdzielą
// JEDEN round-trip do `tab_permissions` zamiast dwóch osobnych.
// Zwraca null gdy tabela nie istnieje / błąd DB → fallback do domyślnych uprawnień.
const getRolePermissionRows = cache(async (role: Role): Promise<TabPermRow[] | null> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('tab_permissions')
      .select('tab_key, can_view, can_write, can_edit')
      .eq('role', role)

    if (error) return null
    return (data ?? []) as TabPermRow[]
  } catch {
    return null
  }
})

export async function getTabWritePerms(role: Role, tabKey: string): Promise<{ canWrite: boolean; canEdit: boolean }> {
  if (role === 'admin') return { canWrite: true, canEdit: true }

  const rows = await getRolePermissionRows(role)
  const row = rows?.find((r) => r.tab_key === tabKey)

  // Brak wiersza (tabela bez wpisu) lub błąd DB — domyślne uprawnienia
  if (!row) {
    const defaults = getDefaultPerms(tabKey, role)
    return { canWrite: defaults.canWrite, canEdit: defaults.canEdit }
  }

  return { canWrite: row.can_write, canEdit: row.can_edit }
}

export async function getAllowedTabs(role: Role): Promise<string[]> {
  if (role === 'admin') {
    return Object.keys(DEFAULT_VIEW_MAP)
  }

  const rows = await getRolePermissionRows(role)

  // Tabela nie istnieje lub inny błąd DB — fallback do domyślnych uprawnień
  if (rows === null) {
    return TAB_DEFS.map((t) => t.key).filter(
      (key) => getDefaultPerms(key, role).canView
    )
  }

  const overrides = new Map(rows.map((p) => [p.tab_key, p.can_view]))

  return TAB_DEFS.map((t) => t.key).filter((tabKey) => {
    if (overrides.has(tabKey)) return overrides.get(tabKey)!
    return getDefaultPerms(tabKey, role).canView
  })
}
