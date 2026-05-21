'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField, FormActions, inputStyle } from '@/components/shared/forms'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import { DirectionBadge } from '@/components/shared/Badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { logActivity, computeChanges } from '@/lib/activity-log'
import type { SupportTextLog, Role } from '@/lib/supabase/types'

const schema = z.object({
  phone: z.string().optional(),
  direction: z.string().optional(),
  summary: z.string().optional(),
  full_message: z.string().optional(),
  case_id: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const PAGE_SIZE = 25

const COLUMNS: Column<SupportTextLog>[] = [
  { key: 'phone', header: 'Telefon' },
  { key: 'direction', header: 'Kierunek', render: (v) => v ? <DirectionBadge dir={String(v)} /> : '—' },
  { key: 'summary', header: 'Podsumowanie', width: '35%' },
  { key: 'case_id', header: 'ID sprawy' },
  { key: 'created_at', header: 'Data', render: (v) => v ? new Date(String(v)).toLocaleDateString('pl-PL') : '—' },
]

interface Props { initialData: SupportTextLog[]; initialCount: number; role: Role; canWrite: boolean; canEdit: boolean }

export function SupportTextLogClient({ initialData, initialCount, role, canWrite, canEdit }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<SupportTextLog | null>(null)
  const [deleteRow, setDeleteRow] = useState<SupportTextLog | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const canDelete = canEdit

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Support Text Log').select('*', { count: 'exact' })
    if (filter !== 'all') query = query.eq('direction', filter)
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? []); setCount(total ?? 0); setLoading(false)
  }, [page, columnFilters, filter, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => { reset({}); setEditRow(null); setFormError(null); setModalOpen(true) }
  const openEdit = (row: SupportTextLog) => {
    reset({ phone: row.phone ?? '', direction: row.direction ?? '', summary: row.summary ?? '', full_message: row.full_message ?? '', case_id: row.case_id?.toString() ?? '' })
    setEditRow(row); setFormError(null); setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const payload = { ...values, case_id: values.case_id ? Number(values.case_id) : null }
    const { error } = editRow
      ? await supabase.from('Support Text Log').update(payload).eq('id', editRow.id)
      : await supabase.from('Support Text Log').insert(payload)
    if (error) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }
    const changes = editRow ? computeChanges(editRow as unknown as Record<string, unknown>, values) : undefined
    void logActivity(supabase, editRow ? 'update' : 'create', 'support-text-log', editRow?.id ?? null, `SMS: ${values.phone ?? '—'}`, changes)
    setModalOpen(false); fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Support Text Log').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); alert('Błąd usuwania. Spróbuj ponownie.'); return }
    void logActivity(supabase, 'delete', 'support-text-log', deleteRow.id, `SMS: ${deleteRow.phone ?? '—'}`)
    setDeleteRow(null); setDeleteLoading(false); fetchData()
  }

  const columnsWithExpand: Column<SupportTextLog>[] = [
    ...COLUMNS,
    { key: 'full_message', header: 'Wiadomość', render: (_, row) => (
      <button onClick={() => setExpandedId(expandedId === row.id ? null : row.id)} className="text-xs underline" style={{ color: 'var(--accent)' }}>
        {expandedId === row.id ? 'Zwiń' : 'Pokaż'}
      </button>
    )}
  ]

  const filterTabs = [
    { label: 'Wszystkie', value: 'all' },
    { label: '↓ Przychodzące', value: 'inbound' },
    { label: '↑ Wychodzące', value: 'outbound' },
  ]

  return (
    <>
      <PageHeader title="SMS Support" subtitle="Log wiadomości tekstowych supportu" />
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columnsWithExpand as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        filterTabs={filterTabs} activeFilter={filter} onFilterChange={(v) => { setFilter(v); setPage(1) }}
        loading={loading} canEdit={canEdit} canDelete={canDelete}
        onAdd={canWrite ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as SupportTextLog) : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as SupportTextLog) : undefined}
        addLabel="Dodaj wpis"
        sortKey={sortKey} sortDir={sortDir} onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? 'Edytuj wpis' : 'Nowy wpis SMS'}>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <FormField label="Telefon"><input {...register('phone')} style={inputStyle} /></FormField>
          <FormField label="Kierunek">
            <select {...register('direction')} style={inputStyle}>
              <option value="">— wybierz —</option>
              <option value="inbound">↓ Przychodzące</option>
              <option value="outbound">↑ Wychodzące</option>
            </select>
          </FormField>
          <FormField label="ID sprawy"><input {...register('case_id')} type="number" style={inputStyle} /></FormField>
          <div className="col-span-2"><FormField label="Podsumowanie"><textarea {...register('summary')} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} /></FormField></div>
          <div className="col-span-2"><FormField label="Pełna wiadomość"><textarea {...register('full_message')} style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} /></FormField></div>
          {formError && <p className="col-span-2 text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>}
          <FormActions onCancel={() => setModalOpen(false)} isSubmitting={isSubmitting} className="col-span-2" />
        </form>
      </Modal>

      {expandedId && (() => {
        const msg = data.find(d => d.id === expandedId)
        return msg ? (
          <div className="mt-4 rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <p className="font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Pełna wiadomość — {msg.phone}</p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{msg.full_message ?? '(brak treści)'}</p>
          </div>
        ) : null
      })()}

      <ConfirmDialog open={!!deleteRow} onClose={() => setDeleteRow(null)} onConfirm={onDelete} loading={deleteLoading} title="Usuń wpis" description={`Usuń SMS dla numeru "${deleteRow?.phone ?? '—'}"?`} />
    </>
  )
}
