'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField, FormActions, inputStyle } from '@/components/shared/forms'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/Badge'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import { logActivity, computeChanges } from '@/lib/activity-log'
import type { Hardware } from '@/lib/supabase/types'

const COMPONENT_TYPE_OPTIONS = ['płytka surowa', 'płytka zaprogramowana', 'obudowa']
const COMPONENT_TYPE_COLORS: Record<string, string> = {
  'płytka surowa': '#6b7280',
  'płytka zaprogramowana': '#e07818',
  'obudowa': '#3b82f6',
}

const PAGE_SIZE = 50

type FormData = {
  component_type: string
  name: string
  stock_qty?: string
  notes?: string
}

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

interface Props {
  initialData: Hardware[]
  initialCount: number
  canWrite: boolean
  canEdit: boolean
}

export function HardwareClient({ initialData, initialCount, canWrite, canEdit }: Props) {
  const t = useTranslations('warehouse')

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

  const columns = useMemo<Column<Hardware>[]>(() => [
    {
      key: 'component_type', header: t('hardware.colType'), width: '200px', sortable: true,
      filterOptions: COMPONENT_TYPE_OPTIONS,
      render: (v) => v ? <StatusBadge status={String(v)} colors={COMPONENT_TYPE_COLORS} /> : '—',
    },
    { key: 'name', header: t('hardware.colName'), sortable: true, filterable: true },
    {
      key: 'stock_qty', header: t('hardware.colStock'), width: '80px', sortable: true, filterable: false,
      render: (v) => <StockBadge qty={Number(v ?? 0)} />,
    },
    {
      key: 'notes', header: t('hardware.colNotes'), filterable: false,
      render: (v) => v ? (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {String(v).length > 60 ? String(v).slice(0, 60) + '…' : String(v)}
        </span>
      ) : '—',
    },
  ], [t])

  const schema = z.object({
    component_type: z.string().min(1, t('required')),
    name: z.string().min(1, t('required')),
    stock_qty: z.string().optional(),
    notes: z.string().optional(),
  })

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
    if (error) { setFormError(t('saveError')); return }
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
    if (error) { setDeleteLoading(false); alert(t('deleteError')); return }
    void logActivity(supabase, 'delete', 'warehouse-hardware', deleteRow.id, `Hardware: ${deleteRow.name}`)
    setDeleteRow(null)
    setDeleteLoading(false)
    fetchData()
  }

  return (
    <>
      <PageHeader
        title={t('hardware.title')}
        subtitle={t('hardware.subtitle')}
      />
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
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
        addLabel={t('hardware.addLabel')}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRow ? t('hardware.modalEdit') : t('hardware.modalAdd')}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label={`${t('hardware.fieldType')} *`} error={errors.component_type?.message}>
              <select {...register('component_type')} style={inputStyle}>
                <option value="">{t('selectPlaceholder')}</option>
                {COMPONENT_TYPE_OPTIONS.map(tp => (
                  <option key={tp} value={tp}>{tp}</option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label={`${t('hardware.fieldName')} *`} error={errors.name?.message}>
              <input {...register('name')} style={inputStyle} placeholder="np. Płytka 3x chip" />
            </FormField>
          </div>
          <FormField label={t('hardware.fieldStock')}>
            <input {...register('stock_qty')} type="number" min="0" style={inputStyle} />
          </FormField>
          <div className="col-span-2">
            <FormField label={t('hardware.fieldNotes')}>
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
        title={t('hardware.deleteTitle')}
        description={t('hardware.deleteDesc', { name: deleteRow?.name ?? '' })}
      />
    </>
  )
}
