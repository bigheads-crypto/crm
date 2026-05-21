'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField, FormActions, inputStyle } from '@/components/shared/forms'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import { logActivity, computeChanges } from '@/lib/activity-log'
import type { SupportLog, Role } from '@/lib/supabase/types'

const schema = z.object({
  phone: z.string().optional(),
  clients_name: z.string().optional(),
  email: z.string().optional(),
  support_agent: z.string().optional(),
  category: z.string().optional(),
  detected_engine: z.string().optional(),
  duration: z.string().optional(),
  case_id: z.string().optional(),
  summary: z.string().optional(),
  problem_description: z.string().optional(),
  support_recommendation: z.string().optional(),
  full_transcript: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const PAGE_SIZE = 25

interface Props { initialData: SupportLog[]; initialCount: number; role: Role; canWrite: boolean; canEdit: boolean }

export function SupportLogClient({ initialData, initialCount, role, canWrite, canEdit }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [loading, setLoading] = useState(false)
  const [detailRow, setDetailRow] = useState<SupportLog | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<SupportLog | null>(null)
  const [deleteRow, setDeleteRow] = useState<SupportLog | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterOptionsMap, setFilterOptionsMap] = useState<Record<string, string[]>>({})

  const canDelete = canEdit

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  useEffect(() => {
    async function loadOptions() {
      const supabase = createClient()
      const [{ data: a }, { data: c }, { data: e }] = await Promise.all([
        supabase.from('Support Log').select('support_agent').not('support_agent', 'is', null),
        supabase.from('Support Log').select('category').not('category', 'is', null),
        supabase.from('Support Log').select('detected_engine').not('detected_engine', 'is', null),
      ])
      setFilterOptionsMap({
        support_agent: [...new Set((a ?? []).map(r => r.support_agent).filter(Boolean) as string[])].sort(),
        category: [...new Set((c ?? []).map(r => r.category).filter(Boolean) as string[])].sort(),
        detected_engine: [...new Set((e ?? []).map(r => r.detected_engine).filter(Boolean) as string[])].sort(),
      })
    }
    loadOptions()
  }, [])

  const { register, handleSubmit, reset, formState: { errors: _errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Support Log').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? []); setCount(total ?? 0); setLoading(false)
  }, [page, columnFilters, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => { reset({}); setEditRow(null); setFormError(null); setModalOpen(true) }
  const openEdit = (row: SupportLog) => {
    reset({
      phone: row.phone ?? '', clients_name: row.clients_name ?? '', email: row.email ?? '',
      support_agent: row.support_agent ?? '', category: row.category ?? '', detected_engine: row.detected_engine ?? '',
      duration: row.duration?.toString() ?? '', case_id: row.case_id?.toString() ?? '',
      summary: row.summary ?? '', problem_description: row.problem_description ?? '',
      support_recommendation: row.support_recommendation ?? '', full_transcript: row.full_transcript ?? '',
    })
    setEditRow(row); setFormError(null); setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const payload = { ...values, duration: values.duration ? Number(values.duration) : null, case_id: values.case_id ? Number(values.case_id) : null }
    const { error } = editRow
      ? await supabase.from('Support Log').update(payload).eq('id', editRow.id)
      : await supabase.from('Support Log').insert(payload)
    if (error) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }
    const changes = editRow ? computeChanges(editRow as unknown as Record<string, unknown>, values) : undefined
    void logActivity(supabase, editRow ? 'update' : 'create', 'support-log', editRow?.id ?? null, `Log: ${values.clients_name ?? values.phone ?? '—'}`, changes)
    setModalOpen(false); fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Support Log').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); alert('Błąd usuwania. Spróbuj ponownie.'); return }
    void logActivity(supabase, 'delete', 'support-log', deleteRow.id, `Log: ${deleteRow.clients_name ?? deleteRow.phone ?? '—'}`)
    setDeleteRow(null); setDeleteLoading(false); fetchData()
  }

  const baseColumns = useMemo<Column<SupportLog>[]>(() => [
    { key: 'clients_name', header: 'Klient' },
    { key: 'phone', header: 'Telefon' },
    { key: 'support_agent', header: 'Agent', filterOptions: filterOptionsMap.support_agent },
    { key: 'category', header: 'Kategoria', filterOptions: filterOptionsMap.category },
    { key: 'detected_engine', header: 'Silnik', filterOptions: filterOptionsMap.detected_engine },
    { key: 'duration', header: 'Czas (s)' },
    { key: 'case_id', header: 'ID sprawy' },
    { key: 'created_at', header: 'Data', render: (v) => v ? new Date(String(v)).toLocaleDateString('pl-PL') : '—' },
  ], [filterOptionsMap])

  const columnsWithDetail = useMemo<Column<SupportLog>[]>(() => [
    ...baseColumns,
    { key: 'id', header: 'Szczegóły', filterable: false, render: (_, row) => (
      <button onClick={() => setDetailRow(row)} className="text-xs underline" style={{ color: 'var(--accent)' }}>Pokaż</button>
    )}
  ], [baseColumns])

  return (
    <>
      <PageHeader title="Log supportu" subtitle="Historia rozmów supportu" />
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columnsWithDetail as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        loading={loading} canEdit={canEdit} canDelete={canDelete}
        onAdd={canWrite ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as SupportLog) : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as SupportLog) : undefined}
        addLabel="Dodaj wpis"
        sortKey={sortKey} sortDir={sortDir} onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? 'Edytuj wpis' : 'Nowy wpis'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <FormField label="Telefon"><input {...register('phone')} style={inputStyle} /></FormField>
          <FormField label="Klient"><input {...register('clients_name')} style={inputStyle} /></FormField>
          <FormField label="Email"><input {...register('email')} style={inputStyle} /></FormField>
          <FormField label="Agent"><input {...register('support_agent')} style={inputStyle} /></FormField>
          <FormField label="Kategoria"><input {...register('category')} style={inputStyle} /></FormField>
          <FormField label="Silnik"><input {...register('detected_engine')} style={inputStyle} /></FormField>
          <FormField label="Czas (s)"><input {...register('duration')} type="number" style={inputStyle} /></FormField>
          <FormField label="ID sprawy"><input {...register('case_id')} type="number" style={inputStyle} /></FormField>
          <div className="col-span-2"><FormField label="Podsumowanie"><textarea {...register('summary')} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} /></FormField></div>
          <div className="col-span-2"><FormField label="Opis problemu"><textarea {...register('problem_description')} style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} /></FormField></div>
          <div className="col-span-2"><FormField label="Rekomendacja"><textarea {...register('support_recommendation')} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} /></FormField></div>
          <div className="col-span-2"><FormField label="Pełny transkrypt"><textarea {...register('full_transcript')} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} /></FormField></div>
          {formError && <p className="col-span-2 text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>}
          <FormActions onCancel={() => setModalOpen(false)} isSubmitting={isSubmitting} className="col-span-2" />
        </form>
      </Modal>

      <Modal open={!!detailRow} onClose={() => setDetailRow(null)} title={`Rozmowa — ${detailRow?.clients_name ?? detailRow?.phone}`} size="lg">
        {detailRow && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Agent', detailRow.support_agent], ['Kategoria', detailRow.category],
                ['Silnik', detailRow.detected_engine], ['Czas', detailRow.duration ? `${detailRow.duration}s` : '—'],
                ['ID sprawy', detailRow.case_id], ['Data', detailRow.created_at ? new Date(detailRow.created_at).toLocaleString('pl-PL') : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-dim)' }}>{label}</p>
                  <p style={{ color: 'var(--text)' }}>{value ?? '—'}</p>
                </div>
              ))}
            </div>
            {detailRow.problem_description && (
              <div><p className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Opis problemu</p>
                <p className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}>{detailRow.problem_description}</p></div>
            )}
            {detailRow.support_recommendation && (
              <div><p className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Rekomendacja</p>
                <p className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}>{detailRow.support_recommendation}</p></div>
            )}
            {detailRow.summary && (
              <div><p className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Podsumowanie</p>
                <p className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}>{detailRow.summary}</p></div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteRow} onClose={() => setDeleteRow(null)} onConfirm={onDelete} loading={deleteLoading} title="Usuń wpis" description={`Usuń wpis dla "${deleteRow?.clients_name ?? deleteRow?.phone ?? '—'}"?`} />
    </>
  )
}
