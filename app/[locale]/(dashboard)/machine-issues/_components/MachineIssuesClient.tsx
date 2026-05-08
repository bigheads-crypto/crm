'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import { logActivity, computeChanges } from '@/lib/activity-log'
import type { MachineIssue, Role } from '@/lib/supabase/types'

const schema = z.object({
  model: z.string().min(1, 'Model jest wymagany'),
  year: z.string().optional(),
  problem: z.string().min(1, 'Opis problemu jest wymagany'),
})
type FormData = z.infer<typeof schema>

const PAGE_SIZE = 25

const COLUMNS: Column<MachineIssue>[] = [
  { key: 'model', header: 'Model maszyny', sortable: true, filterable: true },
  { key: 'year', header: 'Rocznik', sortable: true, filterable: true },
  { key: 'problem', header: 'Problem', sortable: false, filterable: true },
]

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

const textareaStyle = {
  ...inputStyle,
  resize: 'vertical' as const,
  minHeight: '100px',
}

interface Props { initialData: MachineIssue[]; initialCount: number; role: Role }

export function MachineIssuesClient({ initialData, initialCount, role }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<MachineIssue | null>(null)
  const [deleteRow, setDeleteRow] = useState<MachineIssue | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const canEdit = ['admin', 'handlowiec', 'support', 'manager'].includes(role)
  const canDelete = role === 'admin'

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Machine Issues').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? []); setCount(total ?? 0); setLoading(false)
  }, [page, columnFilters, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => { reset({ model: '', year: '', problem: '' }); setEditRow(null); setFormError(null); setModalOpen(true) }
  const openEdit = (row: MachineIssue) => {
    reset({ model: row.model ?? '', year: row.year?.toString() ?? '', problem: row.problem ?? '' })
    setEditRow(row); setFormError(null); setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const payload = {
      model: values.model,
      year: values.year ? Number(values.year) : null,
      problem: values.problem,
    }
    const { error } = editRow
      ? await supabase.from('Machine Issues').update(payload).eq('id', editRow.id)
      : await supabase.from('Machine Issues').insert(payload)
    if (error) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }
    const changes = editRow ? computeChanges(editRow as Record<string, unknown>, values) : undefined
    void logActivity(supabase, editRow ? 'update' : 'create', 'machine-issues', editRow?.id ?? null, `Problem: ${values.model} (${values.year ?? '—'})`, changes)
    setModalOpen(false); fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Machine Issues').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); alert('Błąd usuwania. Spróbuj ponownie.'); return }
    void logActivity(supabase, 'delete', 'machine-issues', deleteRow.id, `Problem: ${deleteRow.model ?? ''} (${deleteRow.year ?? '—'})`)
    setDeleteRow(null); setDeleteLoading(false); fetchData()
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Problemy maszyn</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Powtarzające się problemy bez rozwiązania
        </p>
      </div>
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={COLUMNS as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        onAdd={canEdit ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as MachineIssue) : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as MachineIssue) : undefined}
        loading={loading} canEdit={canEdit} canDelete={canDelete} addLabel="Dodaj problem"
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? 'Edytuj problem maszyny' : 'Nowy problem maszyny'}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <FormField label="Model maszyny" error={errors.model?.message}>
            <input {...register('model')} placeholder="np. Fendt 724" style={inputStyle} />
          </FormField>
          <FormField label="Rocznik" error={errors.year?.message}>
            <input {...register('year')} type="number" placeholder="np. 2018" style={inputStyle} />
          </FormField>
          <FormField label="Opis problemu" error={errors.problem?.message}>
            <textarea {...register('problem')} placeholder="Opisz powtarzający się problem..." style={textareaStyle} />
          </FormField>
          {formError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>Anuluj</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>{isSubmitting ? 'Zapisywanie...' : 'Zapisz'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        onConfirm={onDelete}
        loading={deleteLoading}
        title="Usuń problem maszyny"
        description={`Usuń problem "${deleteRow?.model} (${deleteRow?.year ?? '—'})"?`}
      />
    </>
  )
}
