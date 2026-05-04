'use client'

import { useEffect, useState, useCallback } from 'react'
import { TAB_DEFS, ALL_ROLES } from '@/lib/permissions-config'
import type { Role } from '@/lib/supabase/types'

type PermMatrix = Record<string, Record<string, boolean>>

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  handlowiec: 'Handlowiec',
  support: 'Support',
  hr: 'HR',
  logistyka: 'Logistyka',
}

const ROLE_COLORS: Record<Role, string> = {
  admin: '#ef4444',
  manager: '#a855f7',
  handlowiec: '#e07818',
  support: '#e8a800',
  hr: '#10a872',
  logistyka: '#6b7280',
}

export function PermissionsClient() {
  const [matrix, setMatrix] = useState<PermMatrix>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [cellStatus, setCellStatus] = useState<Record<string, 'saved' | 'error'>>({})

  useEffect(() => {
    fetch('/api/admin/permissions')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setMatrix(d.permissions ?? {})
      })
      .catch((e) => setFetchError(e.message ?? 'Błąd ładowania uprawnień'))
      .finally(() => setLoading(false))
  }, [])

  const toggle = useCallback(async (tabKey: string, role: Role, current: boolean) => {
    if (role === 'admin') return
    const cellKey = `${tabKey}:${role}`
    setSaving(cellKey)

    setMatrix((prev) => ({
      ...prev,
      [tabKey]: { ...prev[tabKey], [role]: !current },
    }))

    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, tabKey, enabled: !current }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Błąd zapisu')

      setCellStatus((prev) => ({ ...prev, [cellKey]: 'saved' }))
      setTimeout(
        () => setCellStatus((prev) => { const n = { ...prev }; delete n[cellKey]; return n }),
        1500
      )
    } catch {
      setMatrix((prev) => ({
        ...prev,
        [tabKey]: { ...prev[tabKey], [role]: current },
      }))
      setCellStatus((prev) => ({ ...prev, [cellKey]: 'error' }))
      setTimeout(
        () => setCellStatus((prev) => { const n = { ...prev }; delete n[cellKey]; return n }),
        3000
      )
    } finally {
      setSaving(null)
    }
  }, [])

  if (fetchError) {
    return (
      <div style={{ color: 'var(--danger)', padding: '16px', fontSize: '14px' }}>
        Błąd: {fetchError}
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
          Uprawnienia zakładek
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Zarządzaj dostępem ról do poszczególnych zakładek. Zmiany wchodzą w życie natychmiast po przełączeniu.
        </p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '32px 0' }}>
          Ładowanie...
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '680px' }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 16px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--surface-2)',
                    borderBottom: '2px solid var(--border)',
                    minWidth: '160px',
                  }}
                >
                  Zakładka
                </th>
                {ALL_ROLES.map((role) => (
                  <th
                    key={role}
                    style={{
                      textAlign: 'center',
                      padding: '10px 12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: ROLE_COLORS[role],
                      backgroundColor: 'var(--surface-2)',
                      borderBottom: '2px solid var(--border)',
                      minWidth: '100px',
                    }}
                  >
                    {ROLE_LABELS[role]}
                    {role === 'admin' && (
                      <div
                        style={{
                          fontSize: '9px',
                          fontWeight: 400,
                          color: 'var(--text-dim)',
                          marginTop: '2px',
                          textTransform: 'none',
                        }}
                      >
                        zawsze pełny
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TAB_DEFS.map((tab, i) => (
                <tr
                  key={tab.key}
                  style={{
                    backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <td
                    style={{
                      padding: '11px 16px',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--text)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {tab.label}
                  </td>
                  {ALL_ROLES.map((role) => {
                    const cellKey = `${tab.key}:${role}`
                    const enabled = matrix[tab.key]?.[role] ?? false
                    const isAdmin = role === 'admin'
                    const isSaving = saving === cellKey
                    const status = cellStatus[cellKey]

                    return (
                      <td
                        key={role}
                        style={{
                          textAlign: 'center',
                          padding: '11px 12px',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <button
                            onClick={() => toggle(tab.key, role, enabled)}
                            disabled={isAdmin || isSaving}
                            title={
                              isAdmin
                                ? 'Admin ma zawsze dostęp do wszystkich zakładek'
                                : enabled
                                ? 'Kliknij aby zabrać dostęp'
                                : 'Kliknij aby nadać dostęp'
                            }
                            style={{
                              width: '38px',
                              height: '22px',
                              borderRadius: '11px',
                              border: 'none',
                              cursor: isAdmin ? 'not-allowed' : isSaving ? 'wait' : 'pointer',
                              position: 'relative',
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px',
                              transition: 'background 0.2s, opacity 0.2s',
                              backgroundColor: enabled
                                ? isAdmin
                                  ? 'rgba(224,120,24,0.35)'
                                  : 'var(--accent)'
                                : 'var(--border)',
                              opacity: isAdmin ? 0.45 : isSaving ? 0.65 : 1,
                            }}
                          >
                            <span
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                backgroundColor: '#fff',
                                flexShrink: 0,
                                transition: 'transform 0.2s',
                                transform: enabled ? 'translateX(16px)' : 'translateX(0)',
                                display: 'block',
                              }}
                            />
                          </button>
                          {status === 'saved' && (
                            <span style={{ fontSize: '10px', color: 'var(--success)', lineHeight: 1 }}>
                              ✓
                            </span>
                          )}
                          {status === 'error' && (
                            <span style={{ fontSize: '10px', color: 'var(--danger)', lineHeight: 1 }}>
                              ✗
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '16px' }}>
        * Rola{' '}
        <strong style={{ color: '#ef4444' }}>Admin</strong>{' '}
        zawsze ma dostęp do wszystkich zakładek — nie można tego zmienić.
      </p>
    </div>
  )
}
