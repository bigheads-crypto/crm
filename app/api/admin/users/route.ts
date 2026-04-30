import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

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

const VALID_ROLES = ['admin', 'manager', 'handlowiec', 'support', 'hr', 'logistyka'] as const

const createSchema = z.object({
  action: z.literal('create'),
  email: z.string().email('Nieprawidłowy email'),
  password: z.string().min(6, 'Hasło min. 6 znaków'),
  role: z.enum(VALID_ROLES).default('handlowiec'),
  full_name: z.string().max(100).nullable().optional(),
})

const updateRoleSchema = z.object({
  action: z.literal('update_role'),
  userId: z.string().uuid('Nieprawidłowe userId'),
  role: z.enum(VALID_ROLES),
  full_name: z.string().max(100).nullable().optional(),
})

const deleteSchema = z.object({
  action: z.literal('delete'),
  userId: z.string().uuid('Nieprawidłowe userId'),
})

const bodySchema = z.discriminatedUnion('action', [createSchema, updateRoleSchema, deleteSchema])

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })

  try {
    const adminClient = createAdminClient()
    const { data: { users }, error } = await adminClient.auth.admin.listUsers()
    if (error) throw error

    const { data: profiles } = await adminClient.from('profiles').select('*')

    const result = users.map((u) => {
      const profile = profiles?.find((p) => p.id === u.id)
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        role: profile?.role ?? 'handlowiec',
        full_name: profile?.full_name ?? null,
      }
    })

    return NextResponse.json({ users: result })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Błąd serwera' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const adminClient = createAdminClient()
    const data = parsed.data

    if (data.action === 'create') {
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
      })
      if (createError) return NextResponse.json({ error: `Auth: ${createError.message}` }, { status: 500 })

      const { error: profileError } = await adminClient.from('profiles').upsert({
        id: created.user.id,
        role: data.role ?? 'handlowiec',
        full_name: data.full_name || null,
      }, { onConflict: 'id' })

      if (profileError) {
        await adminClient.auth.admin.deleteUser(created.user.id)
        return NextResponse.json({ error: `Profil: ${profileError.message}` }, { status: 500 })
      }

      return NextResponse.json({ success: true, userId: created.user.id })
    }

    if (data.action === 'update_role') {
      const { error } = await adminClient
        .from('profiles')
        .update({ role: data.role, full_name: data.full_name || null })
        .eq('id', data.userId)
      if (error) return NextResponse.json({ error: `Profil: ${error.message}` }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (data.action === 'delete') {
      if (data.userId === admin.id) {
        return NextResponse.json({ error: 'Nie możesz usunąć własnego konta' }, { status: 400 })
      }
      const { error } = await adminClient.auth.admin.deleteUser(data.userId)
      if (error) return NextResponse.json({ error: `Auth: ${error.message}` }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Błąd serwera' }, { status: 500 })
  }
}
