'use client'

import { useEffect, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { TAB_DEFS, ALL_ROLES, PERM_TYPES } from '@/lib/permissions-config'
import type { Role } from '@/lib/supabase/types'
import type { TabPerms } from '@/lib/permissions-config'
import { Modal } from '@/components/shared/Modal'
import { FormField, FormActions, inputStyle } from '@/components/shared/forms'

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

function getRoleLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] ?? role
}

function getRoleColor(role: string): string {
  return (ROLE_COLORS as Record<string, string>)[role] ?? '#6b7280'
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
  const [customRoles, setCustomRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [cellStatus, setCellStatus] = useState<Record<string, 'saved' | 'error'>>({})

  const [showAddModal, setShowAddModal] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addSubmitting, setAddSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/admin/permissions')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setMatrix(d.permissions ?? {})
        setCustomRoles(d.customRoles ?? [])
      })
      .catch((e) => setFetchError(e.message ?? 'Błąd ładowania uprawnień'))
      .finally(() => setLoading(false))
  }, [])

  const toggle = useCallback(
    async (tabKey: string, role: string, permType: keyof TabPerms, current: boolean) => {
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

  const handleAddRole = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const name = newRoleName.trim().toLowerCase()

      if (!name) { setAddError('Podaj nazwę roli'); return }
      if (!/^[a-z0-9_-]{2,30}$/.test(name)) {
        setAddError('Tylko małe litery, cyfry, _ i - (2–30 znaków)')
        return
      }
      if (ALL_ROLES.includes(name as Role) || customRoles.includes(name)) {
        setAddError('Ta rola już istnieje')
        return
      }

      setAddSubmitting(true)
      setAddError(null)
      try {
        const res = await fetch('/api/admin/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleName: name }),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error ?? 'Błąd tworzenia roli')

        // Aktualizuj lokalny stan bez przeładowania
        setCustomRoles((prev) => [...prev, name])
        setMatrix((prev) => {
          const updated = { ...prev }
          for (const tab of TAB_DEFS) {
            updated[tab.key] = {
              ...updated[tab.key],
              [name]: { canView: false, canWrite: false, canEdit: false },
            }
          }
          return updated
        })
        setShowAddModal(false)
        setNewRoleName('')
      } catch (err) {
        setAddError((err as Error).message)
      } finally {
        setAddSubmitting(false)
      }
    },
    [newRoleName, customRoles]
  )

  const handleDeleteRole = useCallback(async (roleName: string) => {
    if (!confirm(`Usunąć rolę „${roleName}"? Wszystkie przypisane uprawnienia zostaną skasowane.`)) return

    try {
      const res = await fetch('/api/admin/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleName }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Błąd usuwania roli')

      setCustomRoles((prev) => prev.filter((r) => r !== roleName))
      setMatrix((prev) => {
        const updated = { ...prev }
        for (const tab of TAB_DEFS) {
          if (updated[tab.key]) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [roleName]: _removed, ...rest } = updated[tab.key]
            updated[tab.key] = rest
          }
        }
        return updated
      })
    } catch (err) {
      alert((err as Error).message)
    }
  }, [])

  if (fetchError) {
    return (
      <div style={{ color: 'var(--danger)', padding: '16px', fontSize: '14px' }}>
        Błąd: {fetchError}
      </div>
    )
  }

  const allRoles = [...ALL_ROLES, ...customRoles]

  const thBase: CSSProperties = {
    backgroundColor: 'var(--surface-2)',
    borderBottom: '2px solid var(--border)',
    padding: '8px 6px',
    textAlign: 'center',
  }

  return (
    <div>
      {/* Nagłówek */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
            Uprawnienia zakładek
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Zarządzaj dostępem ról do poszczególnych zakładek. Zmiany wchodzą w życie natychmiast.
          </p>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setNewRoleName(''); setAddError(null) }}
          style={{
            backgroundColor: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          + Nowa rola
        </button>
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
                {allRoles.map((role) => {
                  const isCustom = !ALL_ROLES.includes(role as Role)
                  return (
                    <th
                      key={role}
                      colSpan={3}
                      style={{
                        ...thBase,
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: getRoleColor(role),
                        borderLeft: '1px solid var(--border)',
                        paddingBottom: '6px',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        {getRoleLabel(role)}
                        {isCustom && (
                          <button
                            onClick={() => handleDeleteRole(role)}
                            title="Usuń tę rolę"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-dim)',
                              fontSize: '12px',
                              lineHeight: 1,
                              padding: '1px 3px',
                              borderRadius: '3px',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)' }}
                          >
                            ×
                          </button>
                        )}
                      </span>
                      {role === 'admin' && (
                        <div style={{ fontSize: '9px', fontWeight: 400, color: 'var(--text-dim)', marginTop: '2px', textTransform: 'none' }}>
                          zawsze pełny
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
              {/* Wiersz 2 — nazwy uprawnień */}
              <tr>
                {allRoles.map((role) =>
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
                  {allRoles.map((role) => {
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

      {/* Modal — nowa rola */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Nowa rola"
        size="sm"
      >
        <form onSubmit={handleAddRole} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <FormField label="Nazwa roli" error={addError ?? undefined}>
            <input
              style={inputStyle}
              value={newRoleName}
              onChange={(e) => { setNewRoleName(e.target.value); setAddError(null) }}
              placeholder="np. serwisant"
              autoFocus
              autoComplete="off"
            />
          </FormField>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            Tylko małe litery, cyfry, podkreślnik i myślnik (2–30 znaków).
            Nowa rola zostanie dodana z wyłączonymi uprawnieniami do wszystkich zakładek.
          </p>
          <FormActions
            onCancel={() => setShowAddModal(false)}
            isSubmitting={addSubmitting}
            submitLabel="Dodaj rolę"
            submittingLabel="Tworzenie..."
          />
        </form>
      </Modal>
    </div>
  )
}
