import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/supabase/types'
import { TAB_DEFS, DEFAULT_PERMISSIONS } from '@/lib/permissions-config'

export async function getAllowedTabs(role: Role): Promise<string[]> {
  if (role === 'admin') {
    return Object.keys(DEFAULT_PERMISSIONS)
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('tab_permissions')
      .select('tab_key, enabled')
      .eq('role', role)

    // Tabela nie istnieje lub inny błąd DB — fallback do domyślnych uprawnień
    if (error) {
      return TAB_DEFS.map((t) => t.key).filter((key) =>
        DEFAULT_PERMISSIONS[key]?.includes(role) ?? false
      )
    }

    const overrides = new Map(
      (data ?? []).map((p: { tab_key: string; enabled: boolean }) => [p.tab_key, p.enabled])
    )

    return TAB_DEFS.map((t) => t.key).filter((tabKey) => {
      if (overrides.has(tabKey)) return overrides.get(tabKey)
      return DEFAULT_PERMISSIONS[tabKey]?.includes(role) ?? false
    })
  } catch {
    return TAB_DEFS.map((t) => t.key).filter((key) =>
      DEFAULT_PERMISSIONS[key]?.includes(role) ?? false
    )
  }
}
