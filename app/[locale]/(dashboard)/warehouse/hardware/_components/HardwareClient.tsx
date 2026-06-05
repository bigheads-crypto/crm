'use client'

import { useState, useCallback, useEffect } from 'react'
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
import type { Hardware, Role } from '@/lib/supabase/types'

const COMPONENT_TYPE_OPTIONS = ['płytka surowa', 'płytka zaprogramowana', 'obudowa']
const COMPONENT_TYPE_COLORS: Record<string, string> = {
  'płytka surowa': '#6b7280',
  'płytka zaprogramowana': '#e07818',
  'obudowa': '#3b82f6',
}

const PAGE_SIZE = 50

const schema = z.object({
  component_type: z.string().min(1, 'Wymagane'),
  name: z.string().min(1, 'Wymagane'),
  stock_qty: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

function StockBadge({ qty }: { qty: number }) {
  const color = qty >= 5 ? '#10a872' : qty >= 2 ? '#e8a800' : '#e8384f'
  return (
    <span style={{
      display: 'inline-block', minWidth: '36px', textAlign: 'center',
      padding: '2px 8px', borderRadius: '999px', fontSize: '13px', fontWeight: 600,
      backgroundColor: `${color}22`, color,
    }}>
      {qty}
    </span>
  )
}

const COLUMNS: Column<Hardware>[] = [
  {
    key: 'component_type', header: 'Typ', width: '200px', sortable: true,
    filterOptions: COMPONENT_TYPE_OPTIONS,
    render: (v) => v ? <StatusBadge status={String(v)} colors={COMPONENT_TYPE_COLORS} /> : '—',
  },
  { key: 'name', header: 'Nazwa', sortable: true, filterable: true },
  {
    key: 'stock_qty', header: 'Stan', width: '80px', sortable: true, filterable: false,
    render: (v) => <StockBadge qty={Number(v ?? 0)} />,
  },
  {
    key: 'notes', header: 'Notatki', filterable: false,
    render: (v) => v ? (
      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        {String(v).length > 60 ? String(v).slice(0, 60) + '…' : String(v)}
      </span>
    ) : '—',
  },
]

interface Props {
  initialData: Hardware[]
  initialCount: number
  role: Role
  canWrite: boolean
  canEdit: boolean
}

export function HardwareClient({ initialData, initialCount, canWrite, canEdit }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<Hardware | null>(null)
  const [deleteRow, setDeleteRow] = useState<Hardware | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('component_type')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Hardware').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? [])
    setCount(total ?? 0)
    setLoading(false)
  }, [page, columnFilters, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => {
    reset({ component_type: '', name: '', stock_qty: '0', notes: '' })
    setEditRow(null)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (row: Hardware) => {
    reset({
      component_type: row.component_type,
      name: row.name,
      stock_qty: String(row.stock_qty),
      notes: row.notes ?? '',
    })
    setEditRow(row)
    setFormError(null)
    setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const payload = {
      component_type: values.component_type,
      name: values.name,
      stock_qty: values.stock_qty ? Number(values.stock_qty) : 0,
      notes: values.notes || null,
    }
    const { error } = editRow
      ? await supabase.from('Hardware').update(payload).eq('id', editRow.id)
      : await supabase.from('Hardware').insert(payload)
    if (error) { setFormError(`Błąd: ${error.message}`); return }
    const changes = editRow ? computeChanges(editRow as unknown as Record<string, unknown>, values) : undefined
    void logActivity(supabase, editRow ? 'update' : 'create', 'warehouse-hardware', editRow?.id ?? null, `Hardware: ${values.name}`, changes)
    setModalOpen(false)
    fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Hardware').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); alert('Błąd usuwania. Spróbuj ponownie.'); return }
    void logActivity(supabase, 'delete', 'warehouse-hardware', deleteRow.id, `Hardware: ${deleteRow.name}`)
    setDeleteRow(null)
    setDeleteLoading(false)
    fetchData()
  }

  return (
    <>
      <PageHeader
        title="Hardware"
        subtitle="Płytki surowe, zaprogramowane i obudowy"
      />
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={COLUMNS as unknown as Column<Record<string, unknown>>[]}
        totalCount={count}
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        onAdd={canWrite ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as Hardware) : undefined}
        onDelete={canEdit ? (row) => setDeleteRow(row as unknown as Hardware) : undefined}
        loading={loading}
        canEdit={canEdit}
        canDelete={canEdit}
        addLabel="Dodaj komponent"
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRow ? 'Edytuj komponent' : 'Nowy komponent'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Typ komponentu *" error={errors.component_type?.message}>
              <select {...register('component_type')} style={inputStyle}>
                <option value="">— wybierz —</option>
                {COMPONENT_TYPE_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Nazwa *" error={errors.name?.message}>
              <input {...register('name')} style={inputStyle} placeholder="np. Płytka 3x chip" />
            </FormField>
          </div>
          <FormField label="Stan magazynowy">
            <input {...register('stock_qty')} type="number" min="0" style={inputStyle} />
          </FormField>
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
        title="Usuń komponent"
        description={`Czy na pewno chcesz usunąć "${deleteRow?.name}"?`}
      />
    </>
  )
}
