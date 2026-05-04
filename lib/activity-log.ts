import type { SupabaseClient } from '@supabase/supabase-js'

export interface ActivityChange {
  field: string
  from: unknown
  to: unknown
}

export function computeChanges(
  oldRow: Record<string, unknown>,
  newValues: Record<string, unknown>
): ActivityChange[] {
  return Object.entries(newValues)
    .filter(([key]) => key in oldRow)
    .filter(([key, val]) => String(oldRow[key] ?? '') !== String(val ?? ''))
    .map(([key, val]) => ({ field: key, from: oldRow[key], to: val }))
}

export async function logActivity(
  supabase: SupabaseClient,
  action: 'create' | 'update' | 'delete',
  tabKey: string,
  recordId: string | number | null,
  summary: string,
  changes?: ActivityChange[]
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const details = changes?.length
      ? JSON.stringify({ summary, changes })
      : summary
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action,
      tab_key: tabKey,
      record_id: recordId != null ? String(recordId) : null,
      details,
    })
  } catch {
    // silent fail — nie blokuj UI z powodu błędu logowania
  }
}
