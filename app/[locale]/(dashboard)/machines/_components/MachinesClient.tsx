'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import type { Machine, Role } from '@/lib/supabase/types'

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

const PAGE_SIZE = 25

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

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}

const inputStyle = { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', width: '100%', outline: 'none' }

interface Props { initialData: Machine[]; initialCount: number; role: Role }

export function MachinesClient({ initialData, initialCount, role }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<Machine | null>(null)
  const [deleteRow, setDeleteRow] = useState<Machine | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Logistyka tylko odczyt
  const canEdit = ['admin', 'handlowiec'].includes(role)
  const canDelete = role === 'admin'

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Machines').select('*', { count: 'exact' })
    if (search) query = query.or(`brand.ilike.%${search}%,model.ilike.%${search}%,serial_number.ilike.%${search}%,engine.ilike.%${search}%`)
    query = query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? []); setCount(total ?? 0); setLoading(false)
  }, [page, search])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => { reset({}); setEditRow(null); setModalOpen(true) }
  const openEdit = (row: Machine) => {
    reset({ brand: row.brand ?? '', model: row.model ?? '', year: row.year?.toString() ?? '', engine: row.engine ?? '', displacement: row.displacement ?? '', serial_number: row.serial_number ?? '', dpf: row.dpf ?? false, def: row.def ?? false, can_speed: row.can_speed?.toString() ?? '', emulator: row.emulator ?? '', harness: row.harness ?? '', straight_pipe: row.straight_pipe ?? '', return_status: row.return_status ?? '' })
    setEditRow(row); setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const payload = { ...values, year: values.year ? Number(values.year) : null, can_speed: values.can_speed ? Number(values.can_speed) : null }
    if (editRow) { await supabase.from('Machines').update(payload).eq('id', editRow.id) }
    else { await supabase.from('Machines').insert(payload) }
    setModalOpen(false); fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    await createClient().from('Machines').delete().eq('id', deleteRow.id)
    setDeleteRow(null); setDeleteLoading(false); fetchData()
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Maszyny</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {role === 'logistyka' ? 'Podgląd maszyn (tylko odczyt)' : 'Baza maszyn budowlanych'}
        </p>
      </div>
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={COLUMNS as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1) }}
        onAdd={canEdit ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as Machine) : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as Machine) : undefined}
        loading={loading} canEdit={canEdit} canDelete={canDelete} addLabel="Dodaj maszynę"
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
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>Anuluj</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>{isSubmitting ? 'Zapisywanie...' : 'Zapisz'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={!!deleteRow} onClose={() => setDeleteRow(null)} onConfirm={onDelete} loading={deleteLoading} title="Usuń maszynę" description={`Usuń maszynę "${deleteRow?.brand} ${deleteRow?.model}"?`} />
    </>
  )
}
