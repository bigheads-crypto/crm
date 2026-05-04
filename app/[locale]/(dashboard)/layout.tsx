// Layout dashboardu — chroni trasy (wymaga zalogowania) i renderuje Sidebar + Navbar

import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { createClient } from '@/lib/supabase/server'
import { getAllowedTabs } from '@/lib/permissions'
import type { Role } from '@/lib/supabase/types'

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  // W Next.js 16 params jest Promise
  const { locale } = await params

  // Sprawdź czy użytkownik jest zalogowany
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/${locale}/login`)
  }

  // Pobierz profil z rolą
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'handlowiec') as Role
  const userEmail = user.email ?? ''
  const allowedTabs = await getAllowedTabs(role)

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Sidebar po lewej */}
      <Sidebar role={role} locale={locale} allowedTabs={allowedTabs} />

      {/* Główna część — Navbar + treść */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar userEmail={userEmail} locale={locale} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
