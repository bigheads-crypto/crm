'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserCircle, Lock, Mail, User } from 'lucide-react'

interface SettingsClientProps {
  userEmail: string
  fullName: string
  role: string
}

export function SettingsClient({ userEmail, fullName, role }: SettingsClientProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwStatus, setPwStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [pwLoading, setPwLoading] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPwStatus({ type: 'error', msg: 'Nowe hasła nie są zgodne.' })
      return
    }
    if (newPassword.length < 6) {
      setPwStatus({ type: 'error', msg: 'Hasło musi mieć co najmniej 6 znaków.' })
      return
    }

    setPwLoading(true)
    setPwStatus(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    setPwLoading(false)
    if (error) {
      setPwStatus({ type: 'error', msg: error.message })
    } else {
      setPwStatus({ type: 'success', msg: 'Hasło zostało zmienione.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    manager: 'Manager',
    handlowiec: 'Handlowiec',
    support: 'Support',
    hr: 'HR',
    logistyka: 'Logistyka',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
        Profil użytkownika
      </h2>

      {/* Karta — informacje o koncie */}
      <div
        className="rounded-xl p-6 space-y-4"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {userEmail.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {fullName || userEmail.split('@')[0]}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {roleLabels[role] || role}
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <InfoRow icon={<Mail size={14} />} label="E-mail" value={userEmail} />
          <InfoRow icon={<User size={14} />} label="Imię i nazwisko" value={fullName || '—'} />
          <InfoRow icon={<UserCircle size={14} />} label="Rola" value={roleLabels[role] || role} />
        </div>
      </div>

      {/* Karta — zmiana hasła */}
      <div
        className="rounded-xl p-6"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-5">
          <Lock size={15} style={{ color: 'var(--accent)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Zmiana hasła
          </h3>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <FormField
            label="Nowe hasło"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="Minimum 6 znaków"
          />
          <FormField
            label="Potwierdź nowe hasło"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Powtórz nowe hasło"
          />

          {pwStatus && (
            <p
              className="text-xs px-3 py-2 rounded-lg"
              style={{
                color: pwStatus.type === 'success' ? 'var(--success)' : 'var(--danger)',
                backgroundColor:
                  pwStatus.type === 'success'
                    ? 'rgba(16,168,114,0.1)'
                    : 'rgba(232,56,79,0.1)',
              }}
            >
              {pwStatus.msg}
            </p>
          )}

          <button
            type="submit"
            disabled={pwLoading}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--accent)',
              color: '#fff',
              opacity: pwLoading ? 0.6 : 1,
            }}
          >
            {pwLoading ? 'Zapisywanie…' : 'Zmień hasło'}
          </button>
        </form>
      </div>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2.5"
      style={{ backgroundColor: 'var(--surface-2)' }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <span className="text-xs w-32 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: 'var(--text)' }}>
        {value}
      </span>
    </div>
  )
}

function FormField({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
        style={{
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      />
    </div>
  )
}
