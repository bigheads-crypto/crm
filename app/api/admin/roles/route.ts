import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { TAB_DEFS, ALL_ROLES } from '@/lib/permissions-config'

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

const createRoleSchema = z.object({
  roleName: z
    .string()
    .min(2, 'Minimum 2 znaki')
    .max(30, 'Maksimum 30 znaków')
    .regex(/^[a-z0-9_-]+$/, 'Tylko małe litery, cyfry, _ i -')
    .refine((n) => !ALL_ROLES.includes(n as never), 'Ta rola jest wbudowana'),
})

const deleteRoleSchema = z.object({
  roleName: z
    .string()
    .min(1)
    .refine((n) => !ALL_ROLES.includes(n as never), 'Nie można usunąć wbudowanej roli'),
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

  const parsed = createRoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const adminClient = createAdminClient()
    const { roleName } = parsed.data

    const { data: existing } = await adminClient
      .from('tab_permissions')
      .select('role')
      .eq('role', roleName)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Ta rola już istnieje' }, { status: 400 })
    }

    const rows = TAB_DEFS.map((tab) => ({
      role: roleName,
      tab_key: tab.key,
      can_view: false,
      can_write: false,
      can_edit: false,
    }))

    const { error } = await adminClient.from('tab_permissions').insert(rows)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Błąd serwera' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie' }, { status: 400 })
  }

  const parsed = deleteRoleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const adminClient = createAdminClient()
    const { roleName } = parsed.data

    const { error } = await adminClient
      .from('tab_permissions')
      .delete()
      .eq('role', roleName)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Błąd serwera' }, { status: 500 })
  }
}
