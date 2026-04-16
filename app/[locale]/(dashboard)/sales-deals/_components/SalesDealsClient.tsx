'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import type { SalesDeal, Role } from '@/lib/supabase/types'

const schema = z.object({
  phone: z.string().min(1, 'Wymagane'),
  client_name: z.string().optional(),
  salesman: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  email: z.string().optional(),
  detected_engine: z.string().optional(),
  current_summary: z.string().optional(),
  shipping_details: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const STATUS_OPTIONS = ['open', 'pending', 'in_progress', 'closed']
const PAGE_SIZE = 25

const COLUMNS: Column<SalesDeal>[] = [
  { key: 'client_name', header: 'Klient' },
  { key: 'phone', header: 'Telefon' },
  { key: 'salesman', header: 'Handlowiec' },
  { key: 'status', header: 'Status', render: (v) => v ? <StatusBadge status={String(v)} /> : '—' },
  { key: 'category', header: 'Kategoria' },
  { key: 'detected_engine', header: 'Silnik' },
  { key: 'created_at', header: 'Utworzono', render: (v) => v ? new Date(String(v)).toLocaleDateString('pl-PL') : '—', filterable: false },
]

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: '#22c55e', pending: '#f59e0b', in_progress: '#4f6ef7', closed: '#6b7280',
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${colors[status] ?? '#6b7280'}1a`, color: colors[status] ?? '#6b7280' }}>
      {status}
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
  backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', width: '100%', outline: 'none',
}

interface Props {
  initialData: SalesDeal[]
  initialCount: number
  role: Role
}

export function SalesDealsClient({ initialData, initialCount, role }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<SalesDeal | null>(null)
  const [deleteRow, setDeleteRow] = useState<SalesDeal | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const canEdit = ['admin', 'handlowiec'].includes(role)
  const canDelete = role === 'admin'

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Sales Deals').select('*', { count: 'exact' })
    if (filter !== 'all') query = query.eq('status', filter)
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value.trim()) query = query.ilike(key, `%${value.trim()}%`)
    })
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? [])
    setCount(total ?? 0)
    setLoading(false)
  }, [page, columnFilters, filter, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => { reset({}); setEditRow(null); setModalOpen(true) }
  const openEdit = (row: SalesDeal) => { reset({ phone: row.phone ?? '', client_name: row.client_name ?? '', salesman: row.salesman ?? '', status: row.status ?? '', category: row.category ?? '', email: row.email ?? '', detected_engine: row.detected_engine ?? '', current_summary: row.current_summary ?? '', shipping_details: row.shipping_details ?? '' }); setEditRow(row); setModalOpen(true) }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    if (editRow) {
      await supabase.from('Sales Deals').update(values).eq('id', editRow.id)
    } else {
      await supabase.from('Sales Deals').insert(values)
    }
    setModalOpen(false)
    fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    await supabase.from('Sales Deals').delete().eq('id', deleteRow.id)
    setDeleteRow(null)
    setDeleteLoading(false)
    fetchData()
  }

  const filterTabs = [
    { label: 'Wszystkie', value: 'all' },
    ...STATUS_OPTIONS.map(s => ({ label: s, value: s })),
  ]

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Transakcje sprzedażowe</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Zarządzanie transakcjami sprzedażowymi</p>
      </div>

      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={COLUMNS as unknown as Column<Record<string, unknown>>[]}
        totalCount={count}
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        filterTabs={filterTabs}
        activeFilter={filter}
        onFilterChange={(v) => { setFilter(v); setPage(1) }}
        onAdd={canEdit ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as SalesDeal) : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as SalesDeal) : undefined}
        loading={loading}
        canEdit={canEdit}
        canDelete={canDelete}
        addLabel="Dodaj transakcję"
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? 'Edytuj transakcję' : 'Nowa transakcja'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <FormField label="Telefon *" error={errors.phone?.message}>
            <input {...register('phone')} style={inputStyle} placeholder="+48 000 000 000" />
          </FormField>
          <FormField label="Klient">
            <input {...register('client_name')} style={inputStyle} />
          </FormField>
          <FormField label="Handlowiec">
            <input {...register('salesman')} style={inputStyle} />
          </FormField>
          <FormField label="Status">
            <select {...register('status')} style={inputStyle}>
              <option value="">— wybierz —</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Kategoria">
            <input {...register('category')} style={inputStyle} />
          </FormField>
          <FormField label="Email">
            <input {...register('email')} style={inputStyle} />
          </FormField>
          <FormField label="Wykryty silnik">
            <input {...register('detected_engine')} style={inputStyle} />
          </FormField>
          <FormField label="Adres wysyłki">
            <input {...register('shipping_details')} style={inputStyle} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Podsumowanie">
              <textarea {...register('current_summary')} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
            </FormField>
          </div>
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>Anuluj</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
              {isSubmitting ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteRow} onClose={() => setDeleteRow(null)} onConfirm={onDelete} loading={deleteLoading}
        title="Usuń transakcję" description={`Czy na pewno chcesz usunąć transakcję klienta "${deleteRow?.client_name ?? deleteRow?.phone}"?`} />
    </>
  )
}
