'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import { logActivity, computeChanges } from '@/lib/activity-log'
import type { SalesQuality, Role } from '@/lib/supabase/types'

const schema = z.object({
  phone: z.string().min(1, 'Wymagane'),
  salesman: z.string().optional(),
  clients_name: z.string().optional(),
  category: z.string().optional(),
  rating: z.string().optional(),
  feedback: z.string().optional(),
  detected_engine: z.string().optional(),
  summary: z.string().optional(),
  duration: z.string().optional(),
  deal_id: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const PAGE_SIZE = 25

function RatingBadge({ rating }: { rating: number }) {
  const color = rating >= 7 ? '#22c55e' : rating >= 4 ? '#f59e0b' : '#ef4444'
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold"
      style={{ backgroundColor: `${color}1a`, color }}>
      {rating}/10
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

interface Props { initialData: SalesQuality[]; initialCount: number; role: Role }

export function SalesQualityClient({ initialData, initialCount, role }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<SalesQuality | null>(null)
  const [deleteRow, setDeleteRow] = useState<SalesQuality | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterOptionsMap, setFilterOptionsMap] = useState<Record<string, string[]>>({})

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  useEffect(() => {
    async function loadOptions() {
      const supabase = createClient()
      const [{ data: s }, { data: c }, { data: e }] = await Promise.all([
        supabase.from('Sales Quality').select('salesman').not('salesman', 'is', null),
        supabase.from('Sales Quality').select('category').not('category', 'is', null),
        supabase.from('Sales Quality').select('detected_engine').not('detected_engine', 'is', null),
      ])
      setFilterOptionsMap({
        salesman: [...new Set((s ?? []).map(r => r.salesman).filter(Boolean) as string[])].sort(),
        category: [...new Set((c ?? []).map(r => r.category).filter(Boolean) as string[])].sort(),
        detected_engine: [...new Set((e ?? []).map(r => r.detected_engine).filter(Boolean) as string[])].sort(),
      })
    }
    loadOptions()
  }, [])

  const columns = useMemo<Column<SalesQuality>[]>(() => [
    { key: 'clients_name', header: 'Klient' },
    { key: 'phone', header: 'Telefon' },
    { key: 'salesman', header: 'Handlowiec', filterOptions: filterOptionsMap.salesman },
    { key: 'rating', header: 'Ocena', render: (v) => v != null ? <RatingBadge rating={Number(v)} /> : '—', filterable: false },
    { key: 'category', header: 'Kategoria', filterOptions: filterOptionsMap.category },
    { key: 'detected_engine', header: 'Silnik', filterOptions: filterOptionsMap.detected_engine },
    { key: 'duration', header: 'Czas (s)', filterable: false },
    { key: 'created_at', header: 'Data', render: (v) => v ? new Date(String(v)).toLocaleDateString('pl-PL') : '—', filterable: false },
  ], [filterOptionsMap])

  const canEdit = ['admin', 'handlowiec'].includes(role)
  const canDelete = role === 'admin'

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Sales Quality').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? [])
    setCount(total ?? 0)
    setLoading(false)
  }, [page, columnFilters, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => { reset({}); setEditRow(null); setFormError(null); setModalOpen(true) }
  const openEdit = (row: SalesQuality) => {
    reset({ phone: row.phone ?? '', salesman: row.salesman ?? '', clients_name: row.clients_name ?? '', category: row.category ?? '', rating: row.rating?.toString() ?? '', feedback: row.feedback ?? '', detected_engine: row.detected_engine ?? '', summary: row.summary ?? '', duration: row.duration?.toString() ?? '', deal_id: row.deal_id?.toString() ?? '' })
    setEditRow(row); setFormError(null); setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const payload = { ...values, rating: values.rating ? Number(values.rating) : null, duration: values.duration ? Number(values.duration) : null, deal_id: values.deal_id ? Number(values.deal_id) : null }
    const { error } = editRow
      ? await supabase.from('Sales Quality').update(payload).eq('id', editRow.id)
      : await supabase.from('Sales Quality').insert(payload)
    if (error) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }
    const changes = editRow ? computeChanges(editRow as Record<string, unknown>, values) : undefined
    void logActivity(supabase, editRow ? 'update' : 'create', 'sales-quality', editRow?.id ?? null, `Ocena: ${values.clients_name ?? values.phone}`, changes)
    setModalOpen(false); fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Sales Quality').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); alert('Błąd usuwania. Spróbuj ponownie.'); return }
    void logActivity(supabase, 'delete', 'sales-quality', deleteRow.id, `Ocena: ${deleteRow.clients_name ?? deleteRow.phone}`)
    setDeleteRow(null); setDeleteLoading(false); fetchData()
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Jakość sprzedaży</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Oceny rozmów handlowych</p>
      </div>
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        onAdd={canEdit ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as SalesQuality) : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as SalesQuality) : undefined}
        loading={loading} canEdit={canEdit} canDelete={canDelete} addLabel="Dodaj ocenę"
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? 'Edytuj ocenę' : 'Nowa ocena'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <FormField label="Telefon *" error={errors.phone?.message}><input {...register('phone')} style={inputStyle} /></FormField>
          <FormField label="Klient"><input {...register('clients_name')} style={inputStyle} /></FormField>
          <FormField label="Handlowiec"><input {...register('salesman')} style={inputStyle} /></FormField>
          <FormField label="Kategoria"><input {...register('category')} style={inputStyle} /></FormField>
          <FormField label="Ocena (0-100)" error={errors.rating?.message}><input {...register('rating')} type="number" min="0" max="100" style={inputStyle} /></FormField>
          <FormField label="Czas trwania (s)"><input {...register('duration')} type="number" style={inputStyle} /></FormField>
          <FormField label="Silnik"><input {...register('detected_engine')} style={inputStyle} /></FormField>
          <FormField label="ID transakcji"><input {...register('deal_id')} type="number" style={inputStyle} /></FormField>
          <div className="col-span-2"><FormField label="Feedback"><textarea {...register('feedback')} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} /></FormField></div>
          <div className="col-span-2"><FormField label="Podsumowanie"><textarea {...register('summary')} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} /></FormField></div>
          {formError && <p className="col-span-2 text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>}
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>Anuluj</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>{isSubmitting ? 'Zapisywanie...' : 'Zapisz'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={!!deleteRow} onClose={() => setDeleteRow(null)} onConfirm={onDelete} loading={deleteLoading} title="Usuń ocenę" description={`Usuń ocenę rozmowy z klientem "${deleteRow?.clients_name ?? deleteRow?.phone}"?`} />
    </>
  )
}
