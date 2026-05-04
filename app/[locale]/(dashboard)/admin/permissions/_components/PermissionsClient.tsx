'use client'

import { useEffect, useState, useCallback } from 'react'
import { TAB_DEFS, ALL_ROLES, PERM_TYPES } from '@/lib/permissions-config'
import type { Role, } from '@/lib/supabase/types'
import type { TabPerms } from '@/lib/permissions-config'

type PermMatrix = Record<string, Record<string, TabPerms>>

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

const PERM_FULL: Record<keyof TabPerms, string> = {
  canView: 'Wyświetlanie',
  canWrite: 'Wpisywanie',
  canEdit: 'Edytowanie',
}

const PERM_SHORT: Record<keyof TabPerms, string> = {
  canView: 'W',
  canWrite: 'Wp',
  canEdit: 'Ed',
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

  const toggle = useCallback(
    async (tabKey: string, role: Role, permType: keyof TabPerms, current: boolean) => {
      if (role === 'admin') return
      const cellKey = `${tabKey}:${role}:${permType}`
      setSaving(cellKey)

      setMatrix((prev) => ({
        ...prev,
        [tabKey]: {
          ...prev[tabKey],
          [role]: { ...prev[tabKey]?.[role], [permType]: !current },
        },
      }))

      try {
        const res = await fetch('/api/admin/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, tabKey, permType, enabled: !current }),
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
          [tabKey]: {
            ...prev[tabKey],
            [role]: { ...prev[tabKey]?.[role], [permType]: current },
          },
        }))
        setCellStatus((prev) => ({ ...prev, [cellKey]: 'error' }))
        setTimeout(
          () => setCellStatus((prev) => { const n = { ...prev }; delete n[cellKey]; return n }),
          3000
        )
      } finally {
        setSaving(null)
      }
    },
    []
  )

  if (fetchError) {
    return (
      <div style={{ color: 'var(--danger)', padding: '16px', fontSize: '14px' }}>
        Błąd: {fetchError}
      </div>
    )
  }

  const thBase: React.CSSProperties = {
    backgroundColor: 'var(--surface-2)',
    borderBottom: '2px solid var(--border)',
    padding: '8px 6px',
    textAlign: 'center',
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
          Uprawnienia zakładek
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Zarządzaj dostępem ról do poszczególnych zakładek. Zmiany wchodzą w życie natychmiast.
        </p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '32px 0' }}>
          Ładowanie...
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              {/* Wiersz 1 — nazwy ról */}
              <tr>
                <th
                  rowSpan={2}
                  style={{
                    ...thBase,
                    textAlign: 'left',
                    padding: '10px 16px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                    minWidth: '150px',
                    borderRight: '1px solid var(--border)',
                    verticalAlign: 'bottom',
                  }}
                >
                  Zakładka
                </th>
                {ALL_ROLES.map((role) => (
                  <th
                    key={role}
                    colSpan={3}
                    style={{
                      ...thBase,
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: ROLE_COLORS[role],
                      borderLeft: '1px solid var(--border)',
                      paddingBottom: '6px',
                    }}
                  >
                    {ROLE_LABELS[role]}
                    {role === 'admin' && (
                      <div style={{ fontSize: '9px', fontWeight: 400, color: 'var(--text-dim)', marginTop: '2px', textTransform: 'none' }}>
                        zawsze pełny
                      </div>
                    )}
                  </th>
                ))}
              </tr>
              {/* Wiersz 2 — nazwy uprawnień */}
              <tr>
                {ALL_ROLES.map((role) =>
                  PERM_TYPES.map(({ key: permType }) => {
                    const isAdmin = role === 'admin'
                    return (
                      <th
                        key={`${role}:${permType}`}
                        style={{
                          ...thBase,
                          fontSize: '10px',
                          fontWeight: 500,
                          color: 'var(--text-dim)',
                          textTransform: 'none',
                          padding: '5px 6px 8px',
                          minWidth: isAdmin ? '72px' : '36px',
                          borderLeft: permType === 'canView' ? '1px solid var(--border)' : undefined,
                        }}
                      >
                        {isAdmin ? PERM_FULL[permType] : PERM_SHORT[permType]}
                      </th>
                    )
                  })
                )}
              </tr>
            </thead>
            <tbody>
              {TAB_DEFS.map((tab, i) => (
                <tr
                  key={tab.key}
                  style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}
                >
                  <td
                    style={{
                      padding: '10px 16px',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--text)',
                      borderBottom: '1px solid var(--border)',
                      borderRight: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.label}
                  </td>
                  {ALL_ROLES.map((role) => {
                    const perms = matrix[tab.key]?.[role] ?? { canView: false, canWrite: false, canEdit: false }
                    const isAdmin = role === 'admin'

                    return PERM_TYPES.map(({ key: permType }) => {
                      const cellKey = `${tab.key}:${role}:${permType}`
                      const checked = perms[permType]
                      const isSaving = saving === cellKey
                      const status = cellStatus[cellKey]

                      return (
                        <td
                          key={cellKey}
                          style={{
                            textAlign: 'center',
                            padding: '10px 6px',
                            borderBottom: '1px solid var(--border)',
                            borderLeft: permType === 'canView' ? '1px solid var(--border)' : undefined,
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <button
                              onClick={() => !isAdmin && !isSaving && toggle(tab.key, role, permType, checked)}
                              title={isAdmin ? 'Admin ma zawsze pełny dostęp' : undefined}
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '3px',
                                border: checked
                                  ? '2px solid var(--success)'
                                  : '2px solid var(--border)',
                                backgroundColor: checked ? 'var(--success)' : 'transparent',
                                cursor: isAdmin ? 'not-allowed' : isSaving ? 'wait' : 'pointer',
                                opacity: isAdmin ? 0.35 : isSaving ? 0.5 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                padding: 0,
                                transition: 'background 0.15s, border-color 0.15s',
                              }}
                            >
                              {checked && (
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </button>
                            {status === 'saved' && (
                              <span style={{ fontSize: '9px', color: 'var(--success)', lineHeight: 1 }}>✓</span>
                            )}
                            {status === 'error' && (
                              <span style={{ fontSize: '9px', color: 'var(--danger)', lineHeight: 1 }}>✗</span>
                            )}
                          </div>
                        </td>
                      )
                    })
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '16px' }}>
        * Rola <strong style={{ color: '#ef4444' }}>Admin</strong> zawsze ma pełny dostęp — nie można tego zmienić.
      </p>
    </div>
  )
}
