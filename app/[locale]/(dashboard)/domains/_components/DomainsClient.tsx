'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import type { Domain, Role } from '@/lib/supabase/types'

const schema = z.object({
  domain: z.string().optional(),
  provider: z.string().optional(),
  due_date: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const PAGE_SIZE = 25

function getDiffDays(due: string) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const date = new Date(due)
  date.setHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function DueDateBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: 'var(--text-dim)' }}>—</span>
  const date = new Date(value)
  const diff = getDiffDays(value)
  const color = diff < 0 ? '#e8384f' : diff < 30 ? '#e8a800' : '#10a872'
  return (
    <span suppressHydrationWarning style={{ color, fontWeight: 500 }}>
      {date.toLocaleDateString('pl-PL')}
    </span>
  )
}

function DaysLeftBadge({ days }: { days: number | null }) {
  if (days == null) return <span style={{ color: 'var(--text-dim)' }}>—</span>
  const expired = days < 0
  const soon = days >= 0 && days < 30
  const color = expired ? '#e8384f' : soon ? '#e8a800' : '#10a872'
  const label = expired
    ? `${Math.abs(days)} dni temu`
    : days === 0
    ? 'Dziś!'
    : `${days} dni`
  return (
    <span suppressHydrationWarning style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 9px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 600,
      backgroundColor: `${color}22`,
      color,
      border: `1px solid ${color}44`,
    }}>
      {label}
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

const inputStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '14px',
  width: '100%',
  outline: 'none',
}

interface Props { initialData: Domain[]; initialCount: number; role: Role }

export function DomainsClient({ initialData, initialCount, role }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<Domain | null>(null)
  const [deleteRow, setDeleteRow] = useState<Domain | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [providerOptions, setProviderOptions] = useState<string[]>([])

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const canEdit = ['admin', 'manager'].includes(role)
  const canDelete = role === 'admin'

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    async function loadOptions() {
      const supabase = createClient()
      const { data: p } = await supabase.from('domains').select('provider').not('provider', 'is', null)
      setProviderOptions([...new Set((p ?? []).map(r => r.provider).filter(Boolean) as string[])].sort())
    }
    loadOptions()
  }, [])

  const columns = useMemo<Column<Domain>[]>(() => [
    { key: 'domain', header: 'Domena', sortable: true, filterable: true },
    { key: 'provider', header: 'Dostawca', sortable: true, filterable: true, filterOptions: providerOptions },
    {
      key: 'due_date',
      header: 'Data wygaśnięcia',
      sortable: true,
      render: (v) => <DueDateBadge value={v as string | null} />,
    },
    {
      key: 'days_left',
      header: 'Pozostało',
      sortable: true,
      render: (v) => <DaysLeftBadge days={v as number | null} />,
    },
    {
      key: 'created_at',
      header: 'Dodano',
      sortable: true,
      render: (v) => v ? new Date(v as string).toLocaleDateString('pl-PL') : '—',
    },
  ], [providerOptions])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('domains').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    const dbSortKey = sortKey === 'days_left' ? 'due_date' : sortKey
    query = query.order(dbSortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? [])
    setCount(total ?? 0)
    setLoading(false)
  }, [page, columnFilters, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => { reset({}); setEditRow(null); setModalOpen(true) }
  const openEdit = (row: Domain) => {
    reset({
      domain: row.domain ?? '',
      provider: row.provider ?? '',
      due_date: row.due_date ? row.due_date.slice(0, 10) : '',
    })
    setEditRow(row)
    setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const payload = {
      domain: values.domain || null,
      provider: values.provider || null,
      due_date: values.due_date || null,
    }
    if (editRow) {
      await supabase.from('domains').update(payload).eq('id', editRow.id)
    } else {
      await supabase.from('domains').insert(payload)
    }
    setModalOpen(false)
    fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    await createClient().from('domains').delete().eq('id', deleteRow.id)
    setDeleteRow(null)
    setDeleteLoading(false)
    fetchData()
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Domeny</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Zarządzanie domenami internetowymi
        </p>
      </div>
      <DataTable
        data={data.map(r => ({ ...r, days_left: r.due_date ? getDiffDays(r.due_date) : null })) as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        totalCount={count}
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        onAdd={canEdit ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as Domain) : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as Domain) : undefined}
        loading={loading}
        canEdit={canEdit}
        canDelete={canDelete}
        addLabel="Dodaj domenę"
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? 'Edytuj domenę' : 'Nowa domena'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <FormField label="Domena">
            <input {...register('domain')} placeholder="np. przyklad.pl" style={inputStyle} />
          </FormField>
          <FormField label="Dostawca">
            <input {...register('provider')} placeholder="np. OVH, home.pl" style={inputStyle} />
          </FormField>
          <FormField label="Data wygaśnięcia">
            <input {...register('due_date')} type="date" style={inputStyle} />
          </FormField>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>
              Anuluj
            </button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
              {isSubmitting ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        onConfirm={onDelete}
        loading={deleteLoading}
        title="Usuń domenę"
        description={`Usuń domenę "${deleteRow?.domain}"?`}
      />
    </>
  )
}
