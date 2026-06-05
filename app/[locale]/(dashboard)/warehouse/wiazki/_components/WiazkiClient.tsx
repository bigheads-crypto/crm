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
import type { Wiazka, Role } from '@/lib/supabase/types'

const PRODUCT_LINE_OPTIONS = ['4DPF', 'comfylock']
const PRODUCT_LINE_COLORS: Record<string, string> = {
  '4DPF': '#e07818',
  'comfylock': '#a855f7',
}

const PAGE_SIZE = 50

const schema = z.object({
  product_line: z.string().min(1, 'Wymagane'),
  emulator: z.string().optional(),
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

const COLUMNS: Column<Wiazka>[] = [
  {
    key: 'product_line', header: 'Linia', width: '120px', sortable: false,
    filterOptions: PRODUCT_LINE_OPTIONS,
    render: (v) => v ? <StatusBadge status={String(v)} colors={PRODUCT_LINE_COLORS} /> : '—',
  },
  { key: 'emulator', header: 'Emulator', sortable: true, filterable: true },
  { key: 'name', header: 'Nazwa wiązki', sortable: true, filterable: true },
  {
    key: 'stock_qty', header: 'Stan', width: '80px', sortable: true, filterable: false,
    render: (v) => <StockBadge qty={Number(v ?? 0)} />,
  },
  { key: 'notes', header: 'Notatki', filterable: false,
    render: (v) => v ? (
      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        {String(v).length > 60 ? String(v).slice(0, 60) + '…' : String(v)}
      </span>
    ) : '—',
  },
]

interface Props {
  initialData: Wiazka[]
  initialCount: number
  role: Role
  canWrite: boolean
  canEdit: boolean
}

export function WiazkiClient({ initialData, initialCount, canWrite, canEdit }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<Wiazka | null>(null)
  const [deleteRow, setDeleteRow] = useState<Wiazka | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('emulator')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const columns = useMemo(() => COLUMNS, [])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Wiazki').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    query = query.order('product_line', { ascending: true }).order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? [])
    setCount(total ?? 0)
    setLoading(false)
  }, [page, columnFilters, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => {
    reset({ product_line: '4DPF', emulator: '', name: '', stock_qty: '0', notes: '' })
    setEditRow(null)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (row: Wiazka) => {
    reset({
      product_line: row.product_line ?? '4DPF',
      emulator: row.emulator ?? '',
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
      product_line: values.product_line,
      emulator: values.emulator || null,
      name: values.name,
      stock_qty: values.stock_qty ? Number(values.stock_qty) : 0,
      notes: values.notes || null,
    }
    const { error } = editRow
      ? await supabase.from('Wiazki').update(payload).eq('id', editRow.id)
      : await supabase.from('Wiazki').insert(payload)
    if (error) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }
    const changes = editRow ? computeChanges(editRow as unknown as Record<string, unknown>, values) : undefined
    void logActivity(supabase, editRow ? 'update' : 'create', 'warehouse-wiazki', editRow?.id ?? null, `Wiązka: ${values.name}`, changes)
    setModalOpen(false)
    fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Wiazki').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); alert('Błąd usuwania. Spróbuj ponownie.'); return }
    void logActivity(supabase, 'delete', 'warehouse-wiazki', deleteRow.id, `Wiązka: ${deleteRow.name}`)
    setDeleteRow(null)
    setDeleteLoading(false)
    fetchData()
  }

  return (
    <>
      <PageHeader
        title="Wiązki"
        subtitle="Stany magazynowe wiązek (harnessy)"
      />
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        totalCount={count}
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        onAdd={canWrite ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as Wiazka) : undefined}
        onDelete={canEdit ? (row) => setDeleteRow(row as unknown as Wiazka) : undefined}
        loading={loading}
        canEdit={canEdit}
        canDelete={canEdit}
        addLabel="Dodaj wiązkę"
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRow ? 'Edytuj wiązkę' : 'Nowa wiązka'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <FormField label="Linia produktów *" error={errors.product_line?.message}>
            <select {...register('product_line')} style={inputStyle}>
              {PRODUCT_LINE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </FormField>
          <FormField label="Stan magazynowy">
            <input {...register('stock_qty')} type="number" min="0" style={inputStyle} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Emulator (do jakiego emulatora)">
              <input {...register('emulator')} style={inputStyle} placeholder="np. Kubota V3800 DPF + DEF" />
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Nazwa wiązki *" error={errors.name?.message}>
              <input {...register('name')} style={inputStyle} placeholder="np. Kubota dpf + scr" />
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
        title="Usuń wiązkę"
        description={`Czy na pewno chcesz usunąć wiązkę "${deleteRow?.name}"?`}
      />
    </>
  )
}
