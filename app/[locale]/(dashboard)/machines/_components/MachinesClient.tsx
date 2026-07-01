'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFetchOnParamChange } from '@/lib/hooks/table-data'
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
import type { Machine, Role } from '@/lib/supabase/types'
import { PAGE_SIZE } from '@/lib/constants'

const schema = z.object({
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.string().optional(),
  engine: z.string().optional(),
  displacement: z.string().optional(),
  serial_number: z.string().optional(),
  dpf: z.boolean().optional(),
  def: z.boolean().optional(),
  can_speed: z.string().optional(),
  emulator: z.string().optional(),
  harness: z.string().optional(),
  straight_pipe: z.string().optional(),
  return_status: z.string().optional(),
})
type FormData = z.infer<typeof schema>

function BoolBadge({ value }: { value: boolean | null }) {
  if (value == null) return <span style={{ color: 'var(--text-dim)' }}>—</span>
  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
    style={{ backgroundColor: value ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)', color: value ? '#22c55e' : '#6b7280' }}>
    {value ? 'TAK' : 'NIE'}
  </span>
}

const COLUMNS: Column<Machine>[] = [
  { key: 'brand', header: 'Marka' },
  { key: 'model', header: 'Model' },
  { key: 'year', header: 'Rok' },
  { key: 'engine', header: 'Silnik' },
  { key: 'serial_number', header: 'Nr seryjny' },
  { key: 'dpf', header: 'DPF', render: (v) => <BoolBadge value={v as boolean | null} /> },
  { key: 'def', header: 'DEF', render: (v) => <BoolBadge value={v as boolean | null} /> },
  { key: 'emulator', header: 'Emulator' },
  { key: 'return_status', header: 'Status zwrotu' },
]

interface Props { initialData: Machine[]; initialCount: number; role: Role; canWrite: boolean; canEdit: boolean }

export function MachinesClient({ initialData, initialCount, role, canWrite, canEdit: canEditProp }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<Machine | null>(null)
  const [deleteRow, setDeleteRow] = useState<Machine | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const canEdit = canEditProp
  const canDelete = canEditProp

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Machines').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total, error } = await query
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    setData(rows ?? []); setCount(total ?? 0); setLoading(false)
  }, [page, columnFilters, sortKey, sortDir])

  useFetchOnParamChange(fetchData)

  const openAdd = () => { reset({}); setEditRow(null); setFormError(null); setModalOpen(true) }
  const openEdit = (row: Machine) => {
    reset({ brand: row.brand ?? '', model: row.model ?? '', year: row.year?.toString() ?? '', engine: row.engine ?? '', displacement: row.displacement ?? '', serial_number: row.serial_number ?? '', dpf: row.dpf ?? false, def: row.def ?? false, can_speed: row.can_speed?.toString() ?? '', emulator: row.emulator ?? '', harness: row.harness ?? '', straight_pipe: row.straight_pipe ?? '', return_status: row.return_status ?? '' })
    setEditRow(row); setFormError(null); setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const payload = { ...values, year: values.year ? Number(values.year) : null, can_speed: values.can_speed ? Number(values.can_speed) : null }
    const { error } = editRow
      ? await supabase.from('Machines').update(payload).eq('id', editRow.id)
      : await supabase.from('Machines').insert(payload)
    if (error) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }
    const changes = editRow ? computeChanges(editRow, values) : undefined
    void logActivity(supabase, editRow ? 'update' : 'create', 'machines', editRow?.id ?? null, `Maszyna: ${values.brand ?? ''} ${values.model ?? ''}`.trim(), changes)
    setModalOpen(false); fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Machines').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); alert('Błąd usuwania. Spróbuj ponownie.'); return }
    void logActivity(supabase, 'delete', 'machines', deleteRow.id, `Maszyna: ${deleteRow.brand ?? ''} ${deleteRow.model ?? ''}`.trim())
    setDeleteRow(null); setDeleteLoading(false); fetchData()
  }

  return (
    <>
      <PageHeader title="Maszyny" subtitle={role === 'logistyka' ? 'Podgląd maszyn (tylko odczyt)' : 'Baza maszyn budowlanych'} />
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={COLUMNS as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        onAdd={canWrite ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as Machine) : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as Machine) : undefined}
        loading={loading} canEdit={canEdit} canDelete={canDelete} addLabel="Dodaj maszynę"
        loadError={loadError} onRetry={fetchData}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? 'Edytuj maszynę' : 'Nowa maszyna'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <FormField label="Marka"><input {...register('brand')} style={inputStyle} /></FormField>
          <FormField label="Model"><input {...register('model')} style={inputStyle} /></FormField>
          <FormField label="Rok produkcji"><input {...register('year')} type="number" style={inputStyle} /></FormField>
          <FormField label="Silnik"><input {...register('engine')} style={inputStyle} /></FormField>
          <FormField label="Pojemność"><input {...register('displacement')} style={inputStyle} /></FormField>
          <FormField label="Nr seryjny"><input {...register('serial_number')} style={inputStyle} /></FormField>
          <FormField label="CAN Speed"><input {...register('can_speed')} type="number" style={inputStyle} /></FormField>
          <FormField label="Emulator"><input {...register('emulator')} style={inputStyle} /></FormField>
          <FormField label="Wiązka (harness)"><input {...register('harness')} style={inputStyle} /></FormField>
          <FormField label="Rura prosta"><input {...register('straight_pipe')} style={inputStyle} /></FormField>
          <FormField label="Status zwrotu"><input {...register('return_status')} style={inputStyle} /></FormField>
          <div className="flex items-center gap-6 pt-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text)' }}>
              <input type="checkbox" {...register('dpf')} className="w-4 h-4 rounded" /> DPF
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text)' }}>
              <input type="checkbox" {...register('def')} className="w-4 h-4 rounded" /> DEF
            </label>
          </div>
          {formError && <p className="col-span-2 text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>}
          <FormActions onCancel={() => setModalOpen(false)} isSubmitting={isSubmitting} className="col-span-2" />
        </form>
      </Modal>
      <ConfirmDialog open={!!deleteRow} onClose={() => setDeleteRow(null)} onConfirm={onDelete} loading={deleteLoading} title="Usuń maszynę" description={`Usuń maszynę "${deleteRow?.brand} ${deleteRow?.model}"?`} />
    </>
  )
}
