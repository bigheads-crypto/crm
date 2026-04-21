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
import type { SupportCase, Role } from '@/lib/supabase/types'

const schema = z.object({
  phone: z.string().min(1, 'Wymagane'),
  clients_name: z.string().optional(),
  status: z.string().optional(),
  last_agent: z.string().optional(),
  current_category: z.string().optional(),
  detected_engine: z.string().optional(),
  current_problem_summary: z.string().optional(),
  current_recommendation: z.string().optional(),
  final_resolution: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const STATUS_OPTIONS = ['open', 'pending', 'in_progress', 'resolved', 'closed']
const PAGE_SIZE = 25

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { open: '#ef4444', pending: '#f59e0b', in_progress: '#ef7f1a', resolved: '#22c55e', closed: '#6b7280' }
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

const inputStyle = { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', width: '100%', outline: 'none' }

interface Props { initialData: SupportCase[]; initialCount: number; role: Role }

export function SupportCasesClient({ initialData, initialCount, role }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<SupportCase | null>(null)
  const [deleteRow, setDeleteRow] = useState<SupportCase | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [sortKey, setSortKey] = useState('last_contact_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterOptionsMap, setFilterOptionsMap] = useState<Record<string, string[]>>({})

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  useEffect(() => {
    async function loadOptions() {
      const supabase = createClient()
      const [{ data: a }, { data: c }, { data: e }] = await Promise.all([
        supabase.from('Support Case').select('last_agent').not('last_agent', 'is', null),
        supabase.from('Support Case').select('current_category').not('current_category', 'is', null),
        supabase.from('Support Case').select('detected_engine').not('detected_engine', 'is', null),
      ])
      setFilterOptionsMap({
        last_agent: [...new Set((a ?? []).map(r => r.last_agent).filter(Boolean) as string[])].sort(),
        current_category: [...new Set((c ?? []).map(r => r.current_category).filter(Boolean) as string[])].sort(),
        detected_engine: [...new Set((e ?? []).map(r => r.detected_engine).filter(Boolean) as string[])].sort(),
      })
    }
    loadOptions()
  }, [])

  const columns = useMemo<Column<SupportCase>[]>(() => [
    { key: 'clients_name', header: 'Klient' },
    { key: 'phone', header: 'Telefon' },
    { key: 'status', header: 'Status', render: (v) => v ? <StatusBadge status={String(v)} /> : '—', filterOptions: STATUS_OPTIONS },
    { key: 'last_agent', header: 'Agent', filterOptions: filterOptionsMap.last_agent },
    { key: 'current_category', header: 'Kategoria', filterOptions: filterOptionsMap.current_category },
    { key: 'detected_engine', header: 'Silnik', filterOptions: filterOptionsMap.detected_engine },
    { key: 'last_contact_at', header: 'Ostatni kontakt', render: (v) => v ? new Date(String(v)).toLocaleDateString('pl-PL') : '—' },
  ], [filterOptionsMap])

  const canEdit = ['admin', 'support'].includes(role)
  const canDelete = role === 'admin'

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Support Case').select('*', { count: 'exact' })
    if (filter !== 'all') query = query.eq('status', filter)
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? []); setCount(total ?? 0); setLoading(false)
  }, [page, columnFilters, filter, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => { reset({}); setEditRow(null); setModalOpen(true) }
  const openEdit = (row: SupportCase) => {
    reset({ phone: row.phone ?? '', clients_name: row.clients_name ?? '', status: row.status ?? '', last_agent: row.last_agent ?? '', current_category: row.current_category ?? '', detected_engine: row.detected_engine ?? '', current_problem_summary: row.current_problem_summary ?? '', current_recommendation: row.current_recommendation ?? '', final_resolution: row.final_resolution ?? '' })
    setEditRow(row); setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    if (editRow) { await supabase.from('Support Case').update(values).eq('id', editRow.id) }
    else { await supabase.from('Support Case').insert(values) }
    setModalOpen(false); fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    await createClient().from('Support Case').delete().eq('id', deleteRow.id)
    setDeleteRow(null); setDeleteLoading(false); fetchData()
  }

  const filterTabs = [{ label: 'Wszystkie', value: 'all' }, ...STATUS_OPTIONS.map(s => ({ label: s, value: s }))]

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Sprawy supportu</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Zarządzanie sprawami klientów</p>
      </div>
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        filterTabs={filterTabs} activeFilter={filter} onFilterChange={(v) => { setFilter(v); setPage(1) }}
        onAdd={canEdit ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as SupportCase) : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as SupportCase) : undefined}
        loading={loading} canEdit={canEdit} canDelete={canDelete} addLabel="Dodaj sprawę"
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? 'Edytuj sprawę' : 'Nowa sprawa'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <FormField label="Telefon *" error={errors.phone?.message}><input {...register('phone')} style={inputStyle} /></FormField>
          <FormField label="Klient"><input {...register('clients_name')} style={inputStyle} /></FormField>
          <FormField label="Status">
            <select {...register('status')} style={inputStyle}>
              <option value="">— wybierz —</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Agent"><input {...register('last_agent')} style={inputStyle} /></FormField>
          <FormField label="Kategoria"><input {...register('current_category')} style={inputStyle} /></FormField>
          <FormField label="Silnik"><input {...register('detected_engine')} style={inputStyle} /></FormField>
          <div className="col-span-2"><FormField label="Opis problemu"><textarea {...register('current_problem_summary')} style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} /></FormField></div>
          <div className="col-span-2"><FormField label="Rekomendacja"><textarea {...register('current_recommendation')} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} /></FormField></div>
          <div className="col-span-2"><FormField label="Finalne rozwiązanie"><textarea {...register('final_resolution')} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} /></FormField></div>
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>Anuluj</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>{isSubmitting ? 'Zapisywanie...' : 'Zapisz'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={!!deleteRow} onClose={() => setDeleteRow(null)} onConfirm={onDelete} loading={deleteLoading} title="Usuń sprawę" description={`Usuń sprawę klienta "${deleteRow?.clients_name ?? deleteRow?.phone}"?`} />
    </>
  )
}
