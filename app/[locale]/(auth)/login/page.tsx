'use client'

// Strona logowania — formularz email + hasło z Supabase Auth

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Role } from '@/lib/supabase/types'

// Schemat walidacji formularza
const loginSchema = z.object({
  email: z.string().email('Nieprawidłowy adres email'),
  password: z.string().min(6, 'Hasło musi mieć co najmniej 6 znaków'),
})

type LoginForm = z.infer<typeof loginSchema>

// Ścieżka po zalogowaniu zależna od roli
function getRedirectPath(role: Role, locale: string): string {
  switch (role) {
    case 'admin':
    case 'manager':
      return `/${locale}/dashboard`
    case 'handlowiec':
      return `/${locale}/sales-deals`
    case 'support':
      return `/${locale}/support-cases`
    case 'hr':
      return `/${locale}/candidates`
    case 'logistyka':
      return `/${locale}/sales`
    default:
      return `/${locale}/dashboard`
  }
}

export default function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  // Odczyt locale przez use() w Client Component (React 19)
  const { locale } = use(params)

  const router = useRouter()
  const t = useTranslations('auth')
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (values: LoginForm) => {
    setError(null)
    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (authError) {
      setError(t('error'))
      return
    }

    // Po zalogowaniu pobierz rolę i przekieruj
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError(t('error'))
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (profile?.role ?? 'handlowiec') as Role
    const redirectPath = getRedirectPath(role, locale)

    router.push(redirectPath)
    router.refresh()
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-2xl"
        style={{
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Nagłówek */}
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 text-xl font-bold"
            style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
          >
            4D
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            {t('title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('subtitle')}
          </p>
        </div>

        {/* Formularz */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium"
              style={{ color: 'var(--text)' }}
            >
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t('emailPlaceholder')}
              {...register('email')}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                backgroundColor: 'var(--surface)',
                border: `1px solid ${errors.email ? 'var(--danger)' : 'var(--border)'}`,
                color: 'var(--text)',
              }}
            />
            {errors.email && (
              <p className="text-xs" style={{ color: 'var(--danger)' }}>
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Hasło */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium"
              style={{ color: 'var(--text)' }}
            >
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder={t('passwordPlaceholder')}
              {...register('password')}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                backgroundColor: 'var(--surface)',
                border: `1px solid ${errors.password ? 'var(--danger)' : 'var(--border)'}`,
                color: 'var(--text)',
              }}
            />
            {errors.password && (
              <p className="text-xs" style={{ color: 'var(--danger)' }}>
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Błąd logowania */}
          {error && (
            <div
              className="rounded-lg px-3 py-2.5 text-sm"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--danger)',
              }}
            >
              {error}
            </div>
          )}

          {/* Przycisk logowania */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            {isSubmitting ? t('signingIn') : t('signIn')}
          </button>
        </form>
      </div>
    </div>
  )
}
