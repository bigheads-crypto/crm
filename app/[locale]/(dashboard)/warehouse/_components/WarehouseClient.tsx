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
import type { Product, Role } from '@/lib/supabase/types'

const CATEGORY_OPTIONS = ['emulator', 'rura', 'pompa', 'inne']
const CATEGORY_COLORS: Record<string, string> = {
  emulator: '#a855f7',
  rura: '#e07818',
  pompa: '#3b82f6',
  inne: '#6b7280',
}
const PAGE_SIZE = 50

const schema = z.object({
  name: z.string().min(1, 'Wymagane'),
  plytka: z.string().optional(),
  program: z.string().optional(),
  category: z.string().optional(),
  stock_qty: z.string().optional(),
  price_default: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

function StockBadge({ qty }: { qty: number }) {
  const color = qty >= 10 ? '#10a872' : qty >= 3 ? '#e8a800' : '#e8384f'
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

interface Props { initialData: Product[]; initialCount: number; role: Role; canWrite: boolean; canEdit: boolean }

export function WarehouseClient({ initialData, initialCount, role, canWrite, canEdit }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<Product | null>(null)
  const [deleteRow, setDeleteRow] = useState<Product | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [plytkaOptions, setPlytkaOptions] = useState<string[]>([])

  useEffect(() => {
    async function loadOptions() {
      const supabase = createClient()
      const { data: rows } = await supabase
        .from('Products')
        .select('plytka')
        .not('plytka', 'is', null)
      setPlytkaOptions(
        [...new Set((rows ?? []).map(r => r.plytka).filter(Boolean) as string[])].sort()
      )
    }
    loadOptions()
  }, [])

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const columns = useMemo<Column<Product>[]>(() => [
    { key: 'name', header: 'Nazwa', sortable: true, filterable: true },
    {
      key: 'plytka', header: 'Płytka', width: '180px', sortable: true,
      filterOptions: plytkaOptions,
      render: (v) => v ? (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{String(v)}</span>
      ) : '—',
    },
    {
      key: 'program', header: 'Program', filterable: true,
      render: (v) => v ? (
        <span style={{ fontSize: '12px' }} title={String(v)}>
          {String(v).length > 40 ? String(v).slice(0, 40) + '…' : String(v)}
        </span>
      ) : '—',
    },
    {
      key: 'stock_qty', header: 'Stan', width: '80px', sortable: true, filterable: false,
      render: (v) => <StockBadge qty={Number(v ?? 0)} />,
    },
    {
      key: 'category', header: 'Typ', width: '110px', sortable: true,
      render: (v) => v ? <StatusBadge status={String(v)} colors={CATEGORY_COLORS} /> : '—',
      filterOptions: CATEGORY_OPTIONS,
    },
    { key: 'notes', header: 'Notatki', filterable: false,
      render: (v) => v ? (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }} title={String(v)}>
          {String(v).length > 50 ? String(v).slice(0, 50) + '…' : String(v)}
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
    let query = supabase.from('Products').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? [])
    setCount(total ?? 0)
    setLoading(false)
  }, [page, columnFilters, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => {
    reset({ name: '', plytka: '', program: '', category: '', stock_qty: '0', price_default: '', notes: '' })
    setEditRow(null)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (row: Product) => {
    reset({
      name: row.name,
      plytka: row.plytka ?? '',
      program: row.program ?? '',
      category: row.category ?? '',
      stock_qty: String(row.stock_qty),
      price_default: row.price_default != null ? String(row.price_default) : '',
      notes: row.notes ?? '',
    })
    setEditRow(row)
    setFormError(null)
    setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const payload = {
      name: values.name,
      plytka: values.plytka || null,
      program: values.program || null,
      category: values.category || null,
      stock_qty: values.stock_qty ? Number(values.stock_qty) : 0,
      price_default: values.price_default ? Number(values.price_default) : null,
      notes: values.notes || null,
    }
    const { error } = editRow
      ? await supabase.from('Products').update(payload).eq('id', editRow.id)
      : await supabase.from('Products').insert(payload)
    if (error) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }
    const changes = editRow ? computeChanges(editRow as unknown as Record<string, unknown>, values) : undefined
    void logActivity(supabase, editRow ? 'update' : 'create', 'warehouse', editRow?.id ?? null, `Produkt: ${values.name}`, changes)
    setModalOpen(false)
    fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Products').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); alert('Błąd usuwania. Spróbuj ponownie.'); return }
    void logActivity(supabase, 'delete', 'warehouse', deleteRow.id, `Produkt: ${deleteRow.name}`)
    setDeleteRow(null)
    setDeleteLoading(false)
    fetchData()
  }

  return (
    <>
      <PageHeader
        title="Emulatory"
        subtitle="Katalog emulatorów i stanów magazynowych"
      />
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        onAdd={canWrite ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as Product) : undefined}
        onDelete={canEdit ? (row) => setDeleteRow(row as unknown as Product) : undefined}
        loading={loading} canEdit={canEdit} canDelete={canEdit} addLabel="Dodaj emulator"
        sortKey={sortKey} sortDir={sortDir} onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? 'Edytuj emulator' : 'Nowy emulator'}>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label="Nazwa *" error={errors.name?.message}>
              <input {...register('name')} style={inputStyle} placeholder="np. Mercedes MP3" />
            </FormField>
          </div>
          <FormField label="Płytka">
            <input {...register('plytka')} style={inputStyle} placeholder="np. Metalbox 1x chip" />
          </FormField>
          <FormField label="Kategoria">
            <select {...register('category')} style={inputStyle}>
              <option value="">— wybierz —</option>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
          <div className="col-span-2">
            <FormField label="Program (wersja firmware)">
              <input {...register('program')} style={inputStyle} placeholder="np. For mercedes e5 v 2.4" />
            </FormField>
          </div>
          <FormField label="Stan magazynowy">
            <input {...register('stock_qty')} type="number" min="0" style={inputStyle} />
          </FormField>
          <FormField label="Cena domyślna (€)">
            <input {...register('price_default')} type="number" step="0.01" style={inputStyle} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Notatki">
              <textarea {...register('notes')} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} />
            </FormField>
          </div>
          {formError && <p className="col-span-2 text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>}
          <FormActions onCancel={() => setModalOpen(false)} isSubmitting={isSubmitting} className="col-span-2" />
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteRow} onClose={() => setDeleteRow(null)} onConfirm={onDelete} loading={deleteLoading}
        title="Usuń emulator"
        description={`Czy na pewno chcesz usunąć "${deleteRow?.name}"?`}
      />
    </>
  )
}
