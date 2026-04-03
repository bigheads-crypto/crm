// API Route dla zarządzania użytkownikami — tylko admin
// Używa service_role key po stronie serwera (nigdy nie eksponować klientowi)

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Tworzy admin client z service_role key
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY nie jest ustawiony')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Sprawdza czy żądający użytkownik jest adminem
async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

// GET /api/admin/users — lista użytkowników z profilami
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })

  try {
    const adminClient = createAdminClient()
    const { data: { users }, error } = await adminClient.auth.admin.listUsers()
    if (error) throw error

    // Pobierz profile
    const supabase = await createServerClient()
    const { data: profiles } = await supabase.from('profiles').select('*')

    // Połącz dane
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
  } catch (err) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 })
  }
}

// POST /api/admin/users — stwórz użytkownika lub zaktualizuj rolę
export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })

  try {
    const body = await request.json()
    const { action, userId, email, password, role, full_name } = body

    const adminClient = createAdminClient()
    const supabase = await createServerClient()

    if (action === 'create') {
      // Stwórz nowego użytkownika
      const { data: { user }, error } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true,
      })
      if (error) throw error

      // Dodaj profil
      await supabase.from('profiles').insert({ id: user!.id, role: role ?? 'handlowiec', full_name: full_name ?? null })
      return NextResponse.json({ success: true, userId: user!.id })
    }

    if (action === 'update_role') {
      // Zaktualizuj rolę w profilu
      await supabase.from('profiles').upsert({ id: userId, role, full_name })
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      // Usuń użytkownika (kaskadowo usuwa profil)
      const { error } = await adminClient.auth.admin.deleteUser(userId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Błąd serwera'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
