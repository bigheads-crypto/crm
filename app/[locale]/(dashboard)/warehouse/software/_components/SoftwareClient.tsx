'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField, FormActions, inputStyle } from '@/components/shared/forms'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/Badge'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import { logActivity, computeChanges } from '@/lib/activity-log'
import type { Software, Role } from '@/lib/supabase/types'

const PRODUCT_LINE_OPTIONS = ['4DPF', 'comfylock']
const PRODUCT_LINE_COLORS: Record<string, string> = {
  '4DPF': '#e07818',
  'comfylock': '#a855f7',
}

const PAGE_SIZE = 50

const schema = z.object({
  product_line: z.string().min(1, 'Wymagane'),
  name: z.string().min(1, 'Wymagane'),
  plytka: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  initialData: Software[]
  initialCount: number
  role: Role
  canWrite: boolean
  canEdit: boolean
}

export function SoftwareClient({ initialData, initialCount, canWrite, canEdit }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<Software | null>(null)
  const [deleteRow, setDeleteRow] = useState<Software | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [plytkaOptions, setPlytkaOptions] = useState<string[]>([])

  useEffect(() => {
    async function loadOptions() {
      const supabase = createClient()
      const { data: rows } = await supabase.from('Software').select('plytka').not('plytka', 'is', null)
      setPlytkaOptions(
        [...new Set((rows ?? []).map(r => r.plytka).filter(Boolean) as string[])].sort()
      )
    }
    loadOptions()
  }, [])

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const columns = useMemo<Column<Software>[]>(() => [
    {
      key: 'product_line', header: 'Linia', width: '120px', sortable: false,
      filterOptions: PRODUCT_LINE_OPTIONS,
      render: (v) => v ? <StatusBadge status={String(v)} colors={PRODUCT_LINE_COLORS} /> : '—',
    },
    { key: 'name', header: 'Program', sortable: true, filterable: true },
    {
      key: 'plytka', header: 'Płytka', width: '200px', sortable: true,
      filterOptions: plytkaOptions,
      render: (v) => v ? <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{String(v)}</span> : '—',
    },
    {
      key: 'notes', header: 'Notatki', filterable: false,
      render: (v) => v ? (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }} title={String(v)}>
          {String(v).length > 60 ? String(v).slice(0, 60) + '…' : String(v)}
        </span>
      ) : '—',
    },
  ], [plytkaOptions])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Software').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    query = query
      .order('product_line', { ascending: true })
      .order(sortKey, { ascending: sortDir === 'asc' })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? [])
    setCount(total ?? 0)
    setLoading(false)
  }, [page, columnFilters, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => {
    reset({ product_line: '4DPF', name: '', plytka: '', notes: '' })
    setEditRow(null)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (row: Software) => {
    reset({
      product_line: row.product_line ?? '4DPF',
      name: row.name,
      plytka: row.plytka ?? '',
      notes: row.notes ?? '',
    })
    setEditRow(row)
    setFormError(null)
    setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const payload = {
      product_line: values.product_line,
      name: values.name,
      plytka: values.plytka || null,
      notes: values.notes || null,
    }
    const { error } = editRow
      ? await supabase.from('Software').update(payload).eq('id', editRow.id)
      : await supabase.from('Software').insert(payload)
    if (error) { setFormError(`Błąd: ${error.message}`); return }
    const changes = editRow ? computeChanges(editRow as unknown as Record<string, unknown>, values) : undefined
    void logActivity(supabase, editRow ? 'update' : 'create', 'warehouse-software', editRow?.id ?? null, `Software: ${values.name}`, changes)
    setModalOpen(false)
    fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Software').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); alert('Błąd usuwania. Spróbuj ponownie.'); return }
    void logActivity(supabase, 'delete', 'warehouse-software', deleteRow.id, `Software: ${deleteRow.name}`)
    setDeleteRow(null)
    setDeleteLoading(false)
    fetchData()
  }

  return (
    <>
      <PageHeader
        title="Software"
        subtitle="Katalog programów i firmware emulatorów"
      />
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        totalCount={count}
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        onAdd={canWrite ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as Software) : undefined}
        onDelete={canEdit ? (row) => setDeleteRow(row as unknown as Software) : undefined}
        loading={loading}
        canEdit={canEdit}
        canDelete={canEdit}
        addLabel="Dodaj program"
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRow ? 'Edytuj program' : 'Nowy program'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <FormField label="Linia produktów *" error={errors.product_line?.message}>
            <select {...register('product_line')} style={inputStyle}>
              {PRODUCT_LINE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </FormField>
          <FormField label="Płytka">
            <input {...register('plytka')} style={inputStyle} placeholder="np. Płytka 3x chip" />
          </FormField>
          <div className="col-span-2">
            <FormField label="Nazwa programu *" error={errors.name?.message}>
              <input {...register('name')} style={inputStyle} placeholder="np. Kubota V3800 DPF + DEF v1.3" />
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Notatki">
              <textarea {...register('notes')} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} />
            </FormField>
          </div>
          {formError && (
            <p className="col-span-2 text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>
          )}
          <FormActions
            onCancel={() => setModalOpen(false)}
            isSubmitting={isSubmitting}
            className="col-span-2"
          />
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        onConfirm={onDelete}
        loading={deleteLoading}
        title="Usuń program"
        description={`Czy na pewno chcesz usunąć "${deleteRow?.name}"?`}
      />
    </>
  )
}
