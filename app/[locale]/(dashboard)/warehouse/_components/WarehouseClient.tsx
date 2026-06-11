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
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import { logActivity, computeChanges } from '@/lib/activity-log'
import type { Product, Hardware } from '@/lib/supabase/types'
import { PAGE_SIZE_LARGE as PAGE_SIZE } from '@/lib/constants'

type FormData = {
  name: string
  plytka?: string
  program?: string
  obudowa?: string
  stock_qty?: string
  price_default?: string
  notes?: string
}

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

interface Props { initialData: Product[]; initialCount: number; canWrite: boolean; canEdit: boolean }

export function WarehouseClient({ initialData, initialCount, canWrite, canEdit }: Props) {
  const t = useTranslations('warehouse')

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
  const [programmedBoards, setProgrammedBoards] = useState<Hardware[]>([])
  const [obudowaOptions, setObudowaOptions] = useState<string[]>([])
  const [selectedHwBoard, setSelectedHwBoard] = useState<Hardware | null>(null)

  useEffect(() => {
    async function loadHardwareOptions() {
      const supabase = createClient()
      const [{ data: boards }, { data: obudowy }] = await Promise.all([
        supabase.from('Hardware').select('*').eq('component_type', 'płytka zaprogramowana').order('name'),
        supabase.from('Hardware').select('name').eq('component_type', 'obudowa').order('name'),
      ])
      setProgrammedBoards(boards ?? [])
      setObudowaOptions((obudowy ?? []).map(r => r.name).filter(Boolean) as string[])
    }
    loadHardwareOptions()
  }, [])

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const plytkaFilterOptions = useMemo(
    () => [...new Set(programmedBoards.map(b => b.name))].sort(),
    [programmedBoards]
  )

  const columns = useMemo<Column<Product>[]>(() => [
    { key: 'name', header: t('emulatory.colName'), sortable: true, filterable: true },
    {
      key: 'plytka', header: t('emulatory.colPlytka'), width: '160px', sortable: true,
      filterOptions: plytkaFilterOptions,
      render: (v) => v ? (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{String(v)}</span>
      ) : '—',
    },
    {
      key: 'program', header: t('emulatory.colProgram'), filterable: true,
      render: (v) => v ? (
        <span style={{ fontSize: '12px' }} title={String(v)}>
          {String(v).length > 40 ? String(v).slice(0, 40) + '…' : String(v)}
        </span>
      ) : '—',
    },
    {
      key: 'obudowa', header: t('emulatory.colObudowa'), width: '160px', sortable: true,
      filterOptions: obudowaOptions,
      render: (v) => v ? (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{String(v)}</span>
      ) : '—',
    },
    {
      key: 'stock_qty', header: t('emulatory.colStock'), width: '80px', sortable: true, filterable: false,
      render: (v) => <StockBadge qty={Number(v ?? 0)} />,
    },
    { key: 'notes', header: t('emulatory.colNotes'), filterable: false,
      render: (v) => v ? (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }} title={String(v)}>
          {String(v).length > 50 ? String(v).slice(0, 50) + '…' : String(v)}
        </span>
      ) : '—',
    },
  ], [plytkaFilterOptions, obudowaOptions, t])

  const schema = z.object({
    name: z.string().min(1, t('required')),
    plytka: z.string().optional(),
    program: z.string().optional(),
    obudowa: z.string().optional(),
    stock_qty: z.string().optional(),
    price_default: z.string().optional(),
    notes: z.string().optional(),
  })

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
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
    reset({ name: '', plytka: '', program: '', obudowa: '', stock_qty: '1', price_default: '', notes: '' })
    setSelectedHwBoard(null)
    setEditRow(null)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (row: Product) => {
    reset({
      name: row.name,
      plytka: row.plytka ?? '',
      program: row.program ?? '',
      obudowa: row.obudowa ?? '',
      stock_qty: String(row.stock_qty),
      price_default: row.price_default != null ? String(row.price_default) : '',
      notes: row.notes ?? '',
    })
    const matchingBoard = programmedBoards.find(b => b.name === row.plytka && b.program === row.program) ?? null
    setSelectedHwBoard(matchingBoard)
    setEditRow(row)
    setFormError(null)
    setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const newQty = values.stock_qty ? Number(values.stock_qty) : 0
    const newPlytka = values.plytka || null
    const newProgram = values.program || null
    const newObudowa = values.obudowa || null

    const payload = {
      name: values.name,
      plytka: newPlytka,
      program: newProgram,
      obudowa: newObudowa,
      category: 'emulator',
      stock_qty: newQty,
      price_default: values.price_default ? Number(values.price_default) : null,
      notes: values.notes || null,
    }

    // Helper — szuka wpisu Hardware dla płytki lub obudowy
    const fetchBoard = async (plytka: string, program: string | null) => {
      const q = supabase.from('Hardware').select('id, stock_qty')
        .eq('component_type', 'płytka zaprogramowana').eq('name', plytka)
      const { data } = program
        ? await q.eq('program', program).maybeSingle()
        : await q.is('program', null).maybeSingle()
      return data
    }
    const fetchOb = async (name: string) => {
      const { data } = await supabase.from('Hardware').select('id, stock_qty')
        .eq('component_type', 'obudowa').eq('name', name).maybeSingle()
      return data
    }

    // Ile sztuk faktycznie montujemy teraz
    const diff = editRow ? newQty - editRow.stock_qty : newQty

    if (diff > 0) {
      // Walidacja — sprawdź czy wystarczy komponentów na RÓŻNICĘ (lub pełną ilość przy tworzeniu)
      const [boardHw, obHw] = await Promise.all([
        newPlytka  ? fetchBoard(newPlytka, newProgram) : null,
        newObudowa ? fetchOb(newObudowa)               : null,
      ])

      if (boardHw && diff > boardHw.stock_qty) {
        setFormError(t('emulatory.stockErrorBoard', { max: boardHw.stock_qty }))
        return
      }
      if (obHw && diff > obHw.stock_qty) {
        setFormError(t('emulatory.stockErrorObudowa', { max: obHw.stock_qty }))
        return
      }

      // Zapisz produkt
      const { error } = editRow
        ? await supabase.from('Products').update(payload).eq('id', editRow.id)
        : await supabase.from('Products').insert(payload)
      if (error) { setFormError(t('saveError')); return }

      // Odejmij RÓŻNICĘ z komponentów
      if (boardHw) {
        await supabase.from('Hardware').update({ stock_qty: boardHw.stock_qty - diff }).eq('id', boardHw.id)
      }
      if (obHw) {
        await supabase.from('Hardware').update({ stock_qty: obHw.stock_qty - diff }).eq('id', obHw.id)
      }
    } else {
      // diff ≤ 0: sprzedaż / korekta w dół — tylko zapisz dane, nie ruszaj Hardware
      const { error } = editRow
        ? await supabase.from('Products').update(payload).eq('id', editRow.id)
        : await supabase.from('Products').insert(payload)
      if (error) { setFormError(t('saveError')); return }
    }

    const changes = editRow ? computeChanges(editRow as unknown as Record<string, unknown>, values) : undefined
    void logActivity(supabase, editRow ? 'update' : 'create', 'warehouse', editRow?.id ?? null, `Emulator: ${values.name}`, changes)
    setModalOpen(false)
    fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Products').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); alert(t('deleteError')); return }
    void logActivity(supabase, 'delete', 'warehouse', deleteRow.id, `Produkt: ${deleteRow.name}`)
    setDeleteRow(null)
    setDeleteLoading(false)
    fetchData()
  }

  return (
    <>
      <PageHeader
        title={t('emulatory.title')}
        subtitle={t('emulatory.subtitle')}
      />
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        onAdd={canWrite ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as Product) : undefined}
        onDelete={canEdit ? (row) => setDeleteRow(row as unknown as Product) : undefined}
        loading={loading} canEdit={canEdit} canDelete={canEdit} addLabel={t('emulatory.addLabel')}
        sortKey={sortKey} sortDir={sortDir} onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? t('emulatory.modalEdit') : t('emulatory.modalAdd')}>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FormField label={`${t('emulatory.fieldName')} *`} error={errors.name?.message}>
              <input {...register('name')} style={inputStyle} placeholder="np. Mercedes MP3" />
            </FormField>
          </div>

          <div className="col-span-2">
            <FormField label={t('emulatory.fieldPlytka')}>
              <select
                value={selectedHwBoard?.id ?? ''}
                onChange={e => {
                  const hw = programmedBoards.find(b => b.id === Number(e.target.value)) ?? null
                  setSelectedHwBoard(hw)
                  setValue('plytka', hw?.name ?? '')
                  setValue('program', hw?.program ?? '')
                }}
                style={inputStyle}
              >
                <option value="">{t('selectPlaceholder')}</option>
                {programmedBoards.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.program ? ` — ${b.program}` : ''} (stan: {b.stock_qty})
                  </option>
                ))}
              </select>
            </FormField>
            {/* hidden inputs keep form values in sync */}
            <input type="hidden" {...register('plytka')} />
            <input type="hidden" {...register('program')} />
          </div>

          <div className="col-span-2">
            <FormField label={t('emulatory.fieldObudowa')}>
              <select {...register('obudowa')} style={inputStyle}>
                <option value="">{t('selectPlaceholder')}</option>
                {obudowaOptions.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label={t('emulatory.fieldStock')}>
            <input {...register('stock_qty')} type="number" min="0" style={inputStyle} />
          </FormField>
          <FormField label={t('emulatory.fieldPrice')}>
            <input {...register('price_default')} type="number" step="0.01" style={inputStyle} />
          </FormField>
          <div className="col-span-2">
            <FormField label={t('emulatory.fieldNotes')}>
              <textarea {...register('notes')} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} />
            </FormField>
          </div>
          {formError && <p className="col-span-2 text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>}
          <FormActions onCancel={() => setModalOpen(false)} isSubmitting={isSubmitting} className="col-span-2" />
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteRow} onClose={() => setDeleteRow(null)} onConfirm={onDelete} loading={deleteLoading}
        title={t('emulatory.deleteTitle')}
        description={t('emulatory.deleteDesc', { name: deleteRow?.name ?? '' })}
      />
    </>
  )
}
