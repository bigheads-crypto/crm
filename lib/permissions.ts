import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/supabase/types'
import { TAB_DEFS, DEFAULT_VIEW_MAP, getDefaultPerms } from '@/lib/permissions-config'

export async function getAllowedTabs(role: Role): Promise<string[]> {
  if (role === 'admin') {
    return Object.keys(DEFAULT_VIEW_MAP)
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('tab_permissions')
      .select('tab_key, can_view')
      .eq('role', role)

    // Tabela nie istnieje lub inny błąd DB — fallback do domyślnych uprawnień
    if (error) {
      return TAB_DEFS.map((t) => t.key).filter(
        (key) => getDefaultPerms(key, role).canView
      )
    }

    const overrides = new Map(
      (data ?? []).map((p: { tab_key: string; can_view: boolean }) => [p.tab_key, p.can_view])
    )

    return TAB_DEFS.map((t) => t.key).filter((tabKey) => {
      if (overrides.has(tabKey)) return overrides.get(tabKey)
      return getDefaultPerms(tabKey, role).canView
    })
  } catch {
    return TAB_DEFS.map((t) => t.key).filter(
      (key) => getDefaultPerms(key, role).canView
    )
  }
}
