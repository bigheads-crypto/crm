'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { UserPlus, RefreshCw } from 'lucide-react'
import type { Role } from '@/lib/supabase/types'

const ROLES: Role[] = ['admin', 'handlowiec', 'support', 'hr', 'logistyka', 'manager']

const createSchema = z.object({
  email: z.string().email('Nieprawidłowy email'),
  password: z.string().min(6, 'Min. 6 znaków'),
  role: z.enum(['admin', 'handlowiec', 'support', 'hr', 'logistyka', 'manager']),
  full_name: z.string().optional(),
})
type CreateForm = z.infer<typeof createSchema>

interface UserRow {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  role: Role
  full_name: string | null
}

function RoleBadge({ role }: { role: Role }) {
  const colors: Record<Role, string> = { admin: '#ef4444', manager: '#a855f7', handlowiec: '#4f6ef7', support: '#f59e0b', hr: '#22c55e', logistyka: '#6b7280' }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize"
      style={{ backgroundColor: `${colors[role]}1a`, color: colors[role] }}>
      {role}
    </span>
  )
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}

const inputStyle = { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', width: '100%', outline: 'none' }

const COLUMNS: Column<UserRow>[] = [
  { key: 'email', header: 'Email' },
  { key: 'full_name', header: 'Imię i nazwisko' },
  { key: 'role', header: 'Rola', render: (v) => <RoleBadge role={v as Role} /> },
  { key: 'last_sign_in_at', header: 'Ostatnie logowanie', render: (v) => v ? new Date(String(v)).toLocaleString('pl-PL') : 'Nigdy' },
  { key: 'created_at', header: 'Utworzono', render: (v) => v ? new Date(String(v)).toLocaleDateString('pl-PL') : '—' },
]

export function AdminUsersClient() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editRole, setEditRole] = useState<Role>('handlowiec')
  const [editName, setEditName] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'handlowiec' }
  })

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      setUsers(json.users ?? [])
    } catch { setError('Błąd ładowania użytkowników') }
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const onCreate = async (values: CreateForm) => {
    setError(null)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...values }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); return }
    setCreateOpen(false); reset(); fetchUsers()
  }

  const onUpdateRole = async () => {
    if (!editUser) return
    setEditSaving(true)
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_role', userId: editUser.id, role: editRole, full_name: editName }),
    })
    setEditUser(null); setEditSaving(false); fetchUsers()
  }

  const onDelete = async () => {
    if (!deleteUser) return
    setDeleteLoading(true)
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', userId: deleteUser.id }),
    })
    setDeleteUser(null); setDeleteLoading(false); fetchUsers()
  }

  const openEdit = (user: UserRow) => {
    setEditUser(user); setEditRole(user.role); setEditName(user.full_name ?? '')
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Zarządzanie użytkownikami</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Tylko administrator</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchUsers} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>
            <RefreshCw size={13} /> Odśwież
          </button>
          <button onClick={() => { reset(); setCreateOpen(true) }} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
            <UserPlus size={13} /> Nowy użytkownik
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <DataTable
        data={users as unknown as Record<string, unknown>[]}
        columns={COLUMNS as unknown as Column<Record<string, unknown>>[]}
        totalCount={users.length} page={1} onPageChange={() => {}} pageSize={100}
        onEdit={(row) => openEdit(row as unknown as UserRow)}
        onDelete={(row) => setDeleteUser(row as unknown as UserRow)}
        loading={loading} canEdit={true} canDelete={true}
        keyExtractor={(row) => (row as unknown as UserRow).id}
      />

      {/* Modal tworzenia użytkownika */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nowy użytkownik" size="md">
        <form onSubmit={handleSubmit(onCreate)} className="flex flex-col gap-3">
          <FormField label="Email *" error={errors.email?.message}><input {...register('email')} type="email" style={inputStyle} /></FormField>
          <FormField label="Hasło *" error={errors.password?.message}><input {...register('password')} type="password" style={inputStyle} /></FormField>
          <FormField label="Imię i nazwisko"><input {...register('full_name')} style={inputStyle} /></FormField>
          <FormField label="Rola *">
            <select {...register('role')} style={inputStyle}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormField>
          {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>Anuluj</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
              {isSubmitting ? 'Tworzenie...' : 'Utwórz'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal edycji roli */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edytuj — ${editUser?.email}`} size="sm">
        <div className="flex flex-col gap-3">
          <FormField label="Imię i nazwisko">
            <input value={editName} onChange={e => setEditName(e.target.value)} style={inputStyle} />
          </FormField>
          <FormField label="Rola">
            <select value={editRole} onChange={e => setEditRole(e.target.value as Role)} style={inputStyle}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormField>
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>Anuluj</button>
            <button onClick={onUpdateRole} disabled={editSaving} className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
              {editSaving ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteUser} onClose={() => setDeleteUser(null)} onConfirm={onDelete} loading={deleteLoading}
        title="Usuń użytkownika" description={`Czy na pewno chcesz usunąć użytkownika "${deleteUser?.email}"? Tej operacji nie można cofnąć.`} />
    </>
  )
}
