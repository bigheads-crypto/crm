'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useFetchOnParamChange } from '@/lib/hooks/table-data'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { Cpu } from 'lucide-react'
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
import { PAGE_SIZE_LARGE as PAGE_SIZE } from '@/lib/constants'

const COMPONENT_TYPE_OPTIONS = ['płytka surowa', 'płytka zaprogramowana', 'obudowa', 'rura']
const COMPONENT_TYPE_COLORS: Record<string, string> = {
  'płytka surowa': '#6b7280',
  'płytka zaprogramowana': '#e07818',
  'obudowa': '#3b82f6',
  'rura': '#10a872',
}

type FormData = {
  component_type: string
  name: string
  program?: string
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

  const [formProgramOptions, setFormProgramOptions] = useState<string[]>([])

  useEffect(() => {
    createClient().from('Software').select('name').order('name').then(({ data: rows }) => {
      setFormProgramOptions([...new Set((rows ?? []).map(r => r.name))])
    })
  }, [])

  // Program modal state
  const [programModalOpen, setProgramModalOpen] = useState(false)
  const [rawBoards, setRawBoards] = useState<Hardware[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState<number | ''>('')
  const [programOptions, setProgramOptions] = useState<string[]>([])
  const [selectedProgram, setSelectedProgram] = useState('')
  const [programQty, setProgramQty] = useState(1)
  const [programError, setProgramError] = useState<string | null>(null)
  const [programLoading, setProgramLoading] = useState(false)

  const selectedBoard = rawBoards.find(b => b.id === selectedBoardId) ?? null

  async function openProgramModal() {
    const supabase = createClient()
    const { data: rows } = await supabase
      .from('Hardware')
      .select('*')
      .eq('component_type', 'płytka surowa')
      .gt('stock_qty', 0)
      .order('name', { ascending: true })
    setRawBoards(rows ?? [])
    setSelectedBoardId('')
    setProgramOptions([])
    setSelectedProgram('')
    setProgramQty(1)
    setProgramError(null)
    setProgramModalOpen(true)
  }

  async function handleBoardChange(boardId: number | '') {
    setSelectedBoardId(boardId)
    setSelectedProgram('')
    setProgramOptions([])
    if (!boardId) return
    const board = rawBoards.find(b => b.id === boardId)
    if (!board) return
    const supabase = createClient()
    const { data: rows } = await supabase
      .from('Software')
      .select('name')
      .eq('plytka', board.name)
      .order('name', { ascending: true })
    setProgramOptions((rows ?? []).map(r => r.name))
  }

  async function submitProgram() {
    if (!selectedBoard || !selectedProgram || programQty < 1) return
    if (programQty > selectedBoard.stock_qty) {
      setProgramError(t('hardware.programErrorQty', { max: selectedBoard.stock_qty }))
      return
    }
    setProgramLoading(true)
    setProgramError(null)
    const supabase = createClient()

    // Find existing programmed board entry
    const { data: existing } = await supabase
      .from('Hardware')
      .select('*')
      .eq('component_type', 'płytka zaprogramowana')
      .eq('name', selectedBoard.name)
      .eq('program', selectedProgram)
      .maybeSingle()

    let saveError: { message: string } | null = null

    if (existing) {
      const { error } = await supabase
        .from('Hardware')
        .update({ stock_qty: existing.stock_qty + programQty })
        .eq('id', existing.id)
      saveError = error
    } else {
      const { error } = await supabase
        .from('Hardware')
        .insert({ component_type: 'płytka zaprogramowana', name: selectedBoard.name, program: selectedProgram, stock_qty: programQty, notes: null })
      saveError = error
    }

    if (saveError) { setProgramError(t('hardware.programErrorSave')); setProgramLoading(false); return }

    // Decrease raw board stock
    const { error: decreaseError } = await supabase
      .from('Hardware')
      .update({ stock_qty: selectedBoard.stock_qty - programQty })
      .eq('id', selectedBoard.id)

    if (decreaseError) { setProgramError(t('hardware.programErrorSave')); setProgramLoading(false); return }

    void logActivity(supabase, 'create', 'warehouse-hardware', null,
      `Zaprogramowano ${programQty}x ${selectedBoard.name} → ${selectedProgram}`)

    setProgramLoading(false)
    setProgramModalOpen(false)
    fetchData()
  }

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const columns = useMemo<Column<Hardware>[]>(() => [
    {
      key: 'component_type', header: t('hardware.colType'), width: '200px', sortable: true,
      filterOptions: COMPONENT_TYPE_OPTIONS,
      render: (v) => v ? <StatusBadge status={String(v)} colors={COMPONENT_TYPE_COLORS} /> : '—',
    },
    { key: 'name', header: t('hardware.colName'), sortable: true, filterable: true },
    {
      key: 'program', header: t('hardware.colProgram'), width: '220px', sortable: true, filterable: true,
      render: (v) => v ? (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{String(v)}</span>
      ) : '—',
    },
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
    program: z.string().optional(),
    stock_qty: z.string().optional(),
    notes: z.string().optional(),
  })

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const watchedType = watch('component_type')

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

  useFetchOnParamChange(fetchData)

  const openAdd = () => {
    reset({ component_type: '', name: '', program: '', stock_qty: '0', notes: '' })
    setEditRow(null)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (row: Hardware) => {
    reset({
      component_type: row.component_type,
      name: row.name,
      program: row.program ?? '',
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
      program: values.component_type === 'płytka zaprogramowana' ? (values.program || null) : null,
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

  const programBtn = canWrite ? (
    <button
      onClick={openProgramModal}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
      style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
    >
      <Cpu size={14} /> {t('hardware.programBtn')}
    </button>
  ) : undefined

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
        extraActions={programBtn}
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
          {watchedType === 'płytka zaprogramowana' && (
            <div className="col-span-2">
              <FormField label={t('hardware.colProgram')}>
                <select {...register('program')} style={inputStyle}>
                  <option value="">{t('selectPlaceholder')}</option>
                  {formProgramOptions.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </FormField>
            </div>
          )}
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

      {/* Modal: Zaprogramuj */}
      <Modal
        open={programModalOpen}
        onClose={() => setProgramModalOpen(false)}
        title={t('hardware.programModal')}
      >
        <div className="flex flex-col gap-4">
          {rawBoards.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{t('hardware.programNoBoardsAvailable')}</p>
          ) : (
            <>
              <FormField label={t('hardware.programFieldBoard')}>
                <select
                  value={selectedBoardId}
                  onChange={(e) => handleBoardChange(e.target.value ? Number(e.target.value) : '')}
                  style={inputStyle}
                >
                  <option value="">{t('hardware.programSelectBoard')}</option>
                  {rawBoards.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.stock_qty} szt.)</option>
                  ))}
                </select>
              </FormField>

              <FormField label={t('hardware.programFieldProgram')}>
                {selectedBoardId && programOptions.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '6px 0' }}>
                    {t('hardware.programNoProgramsAvailable')}
                  </p>
                ) : (
                  <select
                    value={selectedProgram}
                    onChange={(e) => setSelectedProgram(e.target.value)}
                    style={inputStyle}
                    disabled={!selectedBoardId}
                  >
                    <option value="">{t('hardware.programSelectProgram')}</option>
                    {programOptions.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}
              </FormField>

              <FormField label={t('hardware.programFieldQty')}>
                <input
                  type="number"
                  min={1}
                  max={selectedBoard?.stock_qty ?? 999}
                  value={programQty}
                  onChange={(e) => setProgramQty(Math.max(1, Number(e.target.value)))}
                  style={inputStyle}
                  disabled={!selectedProgram}
                />
              </FormField>

              {programError && (
                <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{programError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProgramModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm"
                  style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={submitProgram}
                  disabled={!selectedBoard || !selectedProgram || programQty < 1 || programLoading}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
                  style={{ backgroundColor: 'var(--accent)', color: '#ffffff', opacity: (!selectedBoard || !selectedProgram || programLoading) ? 0.5 : 1 }}
                >
                  {programLoading ? '...' : t('hardware.programBtn')}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
