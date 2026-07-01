'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useFetchOnParamChange } from '@/lib/hooks/table-data'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField, FormActions, inputStyle } from '@/components/shared/forms'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import { logActivity, computeChanges } from '@/lib/activity-log'
import type { Zestaw, Product, Wiazka } from '@/lib/supabase/types'
import { PAGE_SIZE_LARGE as PAGE_SIZE } from '@/lib/constants'

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'PLN']

type FormData = {
  nr: string
  name: string
  emulator_program?: string
  wiazka?: string
  notes?: string
  instrukcja?: string
  price?: string
  price_currency?: string
}

interface Props {
  initialData: Zestaw[]
  initialCount: number
  canWrite: boolean
  canEdit: boolean
}

export function SetsClient({ initialData, initialCount, canWrite, canEdit }: Props) {
  const t = useTranslations('warehouse')

  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<Zestaw | null>(null)
  const [deleteRow, setDeleteRow] = useState<Zestaw | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('nr')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [emulators, setEmulators] = useState<Product[]>([])
  const [wiazki, setWiazki] = useState<Wiazka[]>([])

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('Products').select('*').eq('category', 'emulator').order('name'),
      supabase.from('Wiazki').select('*').order('name'),
    ]).then(([{ data: e }, { data: w }]) => {
      setEmulators(e ?? [])
      setWiazki(w ?? [])
    })
  }, [])

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const columns = useMemo<Column<Zestaw>[]>(() => [
    {
      key: 'nr', header: t('zestawy.colNr'), width: '60px', sortable: true, filterable: false,
      render: (v) => (
        <span style={{
          display: 'inline-block', minWidth: '28px', textAlign: 'center',
          padding: '2px 6px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
          backgroundColor: 'rgba(224,120,24,0.15)', color: 'var(--accent)',
        }}>
          {String(v)}
        </span>
      ),
    },
    { key: 'name', header: t('zestawy.colName'), sortable: true, filterable: true },
    {
      key: 'emulator_program', header: t('zestawy.colEmulatorProgram'), width: '220px',
      filterOptions: emulators.map(e => e.name),
      render: (v) => v ? (
        <span title={String(v)} style={{ fontSize: '12px' }}>{String(v)}</span>
      ) : '—',
    },
    {
      key: 'wiazka', header: t('zestawy.colWiazka'), width: '160px',
      filterOptions: wiazki.map(w => w.name),
    },
    { key: 'notes', header: t('zestawy.colNotes'), filterable: false,
      render: (v) => v ? (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }} title={String(v)}>
          {String(v).length > 60 ? String(v).slice(0, 60) + '…' : String(v)}
        </span>
      ) : '—',
    },
    { key: 'instrukcja', header: t('zestawy.colInstrukcja'), width: '160px', filterable: false,
      render: (v) => v ? <span style={{ fontSize: '12px' }}>{String(v)}</span> : '—',
    },
    {
      key: 'price', header: t('zestawy.colPrice'), width: '110px', sortable: true, filterable: false,
      render: (v, row) => {
        if (v == null) return '—'
        const currency = (row as unknown as Zestaw).price_currency ?? 'USD'
        return (
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            {Number(v).toLocaleString('pl-PL', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )
      },
    },
  ], [t, emulators, wiazki])

  const schema = z.object({
    nr: z.string().min(1, t('required')),
    name: z.string().min(1, t('required')),
    emulator_program: z.string().optional(),
    wiazka: z.string().optional(),
    notes: z.string().optional(),
    instrukcja: z.string().optional(),
    price: z.string().optional(),
    price_currency: z.string().optional(),
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Zestawy').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total, error } = await query
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    setData(rows ?? [])
    setCount(total ?? 0)
    setLoading(false)
  }, [page, columnFilters, sortKey, sortDir])

  useFetchOnParamChange(fetchData)

  const openAdd = () => {
    reset({ nr: '', name: '', emulator_program: '', wiazka: '', notes: '', instrukcja: '', price: '', price_currency: 'USD' })
    setEditRow(null)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (row: Zestaw) => {
    reset({
      nr: String(row.nr),
      name: row.name,
      emulator_program: row.emulator_program ?? '',
      wiazka: row.wiazka ?? '',
      notes: row.notes ?? '',
      instrukcja: row.instrukcja ?? '',
      price: row.price != null ? String(row.price) : '',
      price_currency: row.price_currency ?? 'USD',
    })
    setEditRow(row)
    setFormError(null)
    setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const payload = {
      nr: Number(values.nr),
      name: values.name,
      emulator_program: values.emulator_program || null,
      wiazka: values.wiazka || null,
      notes: values.notes || null,
      instrukcja: values.instrukcja || null,
      price: values.price ? Number(values.price) : null,
      price_currency: values.price_currency || 'USD',
    }
    const { error } = editRow
      ? await supabase.from('Zestawy').update(payload).eq('id', editRow.id)
      : await supabase.from('Zestawy').insert(payload)
    if (error) { setFormError(t('saveError')); return }
    const changes = editRow ? computeChanges(editRow as unknown as Record<string, unknown>, values) : undefined
    void logActivity(supabase, editRow ? 'update' : 'create', 'warehouse-zestawy', editRow?.id ?? null, `Zestaw nr ${values.nr}: ${values.name}`, changes)
    setModalOpen(false)
    fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Zestawy').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); alert(t('deleteError')); return }
    void logActivity(supabase, 'delete', 'warehouse-zestawy', deleteRow.id, `Zestaw nr ${deleteRow.nr}: ${deleteRow.name}`)
    setDeleteRow(null)
    setDeleteLoading(false)
    fetchData()
  }

  return (
    <>
      <PageHeader
        title={t('zestawy.title')}
        subtitle={t('zestawy.subtitle')}
      />
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        totalCount={count}
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        onAdd={canWrite ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as Zestaw) : undefined}
        onDelete={canEdit ? (row) => setDeleteRow(row as unknown as Zestaw) : undefined}
        loading={loading}
        loadError={loadError}
        onRetry={fetchData}
        canEdit={canEdit}
        canDelete={canEdit}
        addLabel={t('zestawy.addLabel')}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRow ? t('zestawy.modalEditNr', { nr: editRow.nr }) : t('zestawy.modalAdd')}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <FormField label={`${t('zestawy.fieldNr')} *`} error={errors.nr?.message}>
            <input {...register('nr')} type="number" min="1" style={inputStyle} placeholder="np. 1" />
          </FormField>
          <FormField label={`${t('zestawy.fieldName')} *`} error={errors.name?.message}>
            <input {...register('name')} style={inputStyle} placeholder="np. Kubota V3800 DPF + DEF" />
          </FormField>
          <div className="col-span-2">
            <FormField label={t('zestawy.fieldEmulatorProgram')}>
              <select {...register('emulator_program')} style={inputStyle}>
                <option value="">{t('selectPlaceholder')}</option>
                {emulators.map(e => (
                  <option key={e.id} value={e.name}>
                    {e.name}{e.plytka ? ` (${e.plytka}${e.program ? ` — ${e.program}` : ''})` : ''}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label={t('zestawy.fieldWiazka')}>
            <select {...register('wiazka')} style={inputStyle}>
              <option value="">{t('selectPlaceholder')}</option>
              {wiazki.map(w => (
                <option key={w.id} value={w.name}>{w.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label={t('zestawy.fieldInstrukcja')}>
            <input {...register('instrukcja')} style={inputStyle} placeholder="np. Kubota dpf + scr v 1.6" />
          </FormField>
          <FormField label={t('zestawy.fieldPrice')}>
            <input {...register('price')} type="number" step="0.01" min="0" style={inputStyle} placeholder="np. 1200.00" />
          </FormField>
          <FormField label={t('zestawy.fieldPriceCurrency')}>
            <select {...register('price_currency')} style={inputStyle}>
              {CURRENCY_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </FormField>
          <div className="col-span-2">
            <FormField label={t('zestawy.fieldNotes')}>
              <textarea
                {...register('notes')}
                style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                placeholder="np. Zweryfikować usunięcie kodowania"
              />
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
        title={t('zestawy.deleteTitle')}
        description={t('zestawy.deleteDesc', { nr: deleteRow?.nr ?? '', name: deleteRow?.name ?? '' })}
      />
    </>
  )
}
