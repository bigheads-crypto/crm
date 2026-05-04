import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { TAB_DEFS, ALL_ROLES, DEFAULT_PERMISSIONS } from '@/lib/permissions-config'

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY nie jest ustawiony')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })

  try {
    const adminClient = createAdminClient()
    const { data: dbPerms, error } = await adminClient
      .from('tab_permissions')
      .select('role, tab_key, enabled')

    if (error) throw error

    const result: Record<string, Record<string, boolean>> = {}

    for (const tab of TAB_DEFS) {
      result[tab.key] = {}
      for (const role of ALL_ROLES) {
        if (role === 'admin') {
          result[tab.key][role] = true
          continue
        }
        const dbEntry = (dbPerms ?? []).find(
          (p: { role: string; tab_key: string; enabled: boolean }) =>
            p.role === role && p.tab_key === tab.key
        )
        result[tab.key][role] =
          dbEntry !== undefined
            ? dbEntry.enabled
            : (DEFAULT_PERMISSIONS[tab.key]?.includes(role) ?? false)
      }
    }

    return NextResponse.json({ permissions: result })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Błąd serwera' }, { status: 500 })
  }
}

const upsertSchema = z.object({
  role: z.enum(['manager', 'handlowiec', 'support', 'hr', 'logistyka']),
  tabKey: z.string().refine((k) => TAB_DEFS.some((t) => t.key === k), 'Nieznana zakładka'),
  enabled: z.boolean(),
})

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie' }, { status: 400 })
  }

  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const adminClient = createAdminClient()
    const { role, tabKey, enabled } = parsed.data

    const { error } = await adminClient
      .from('tab_permissions')
      .upsert({ role, tab_key: tabKey, enabled }, { onConflict: 'role,tab_key' })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Błąd serwera' }, { status: 500 })
  }
}
