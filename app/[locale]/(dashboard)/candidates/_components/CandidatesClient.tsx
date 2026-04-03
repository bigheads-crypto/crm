'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import type { OLXCandidate, Role } from '@/lib/supabase/types'

const schema = z.object({
  name: z.string().min(1, 'Wymagane'),
  position: z.string().optional(),
  olx_id: z.string().optional(),
  education: z.string().optional(),
  language: z.string().optional(),
  experience: z.string().optional(),
  grade: z.string().optional(),
  cv_name: z.string().optional(),
  cv_url: z.string().optional(),
  description: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const PAGE_SIZE = 25

function ScoreBadge({ value }: { value: number | null }) {
  if (value == null) return <span style={{ color: 'var(--text-dim)' }}>—</span>
  const color = value >= 7 ? '#22c55e' : value >= 4 ? '#f59e0b' : '#ef4444'
  return <span className="font-semibold" style={{ color }}>{value}/10</span>
}

const COLUMNS: Column<OLXCandidate>[] = [
  { key: 'name', header: 'Imię i nazwisko' },
  { key: 'position', header: 'Stanowisko' },
  { key: 'grade', header: 'Ocena ogólna', render: (v) => <ScoreBadge value={v as number | null} /> },
  { key: 'education', header: 'Wykształcenie', render: (v) => <ScoreBadge value={v as number | null} /> },
  { key: 'language', header: 'Języki', render: (v) => <ScoreBadge value={v as number | null} /> },
  { key: 'experience', header: 'Doświadczenie', render: (v) => <ScoreBadge value={v as number | null} /> },
  {
    key: 'cv_url', header: 'CV', render: (v) => v
      ? <a href={String(v)} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: 'var(--accent)' }}>Pobierz CV</a>
      : <span style={{ color: 'var(--text-dim)' }}>—</span>
  },
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

interface Props { initialData: OLXCandidate[]; initialCount: number; role: Role }

export function CandidatesClient({ initialData, initialCount, role }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<OLXCandidate | null>(null)
  const [deleteRow, setDeleteRow] = useState<OLXCandidate | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const canEdit = ['admin', 'hr'].includes(role)
  const canDelete = role === 'admin'

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('OLX').select('*', { count: 'exact' })
    if (search) query = query.or(`name.ilike.%${search}%,position.ilike.%${search}%`)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? []); setCount(total ?? 0); setLoading(false)
  }, [page, search, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => { reset({}); setEditRow(null); setModalOpen(true) }
  const openEdit = (row: OLXCandidate) => {
    reset({ name: row.name ?? '', position: row.position ?? '', olx_id: row.olx_id?.toString() ?? '', education: row.education?.toString() ?? '', language: row.language?.toString() ?? '', experience: row.experience?.toString() ?? '', grade: row.grade?.toString() ?? '', cv_name: row.cv_name ?? '', cv_url: row.cv_url ?? '', description: row.description ?? '' })
    setEditRow(row); setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    // Konwertuj stringi na liczby przed zapisem
    const payload = {
      ...values,
      olx_id: values.olx_id ? Number(values.olx_id) : null,
      education: values.education ? Number(values.education) : null,
      language: values.language ? Number(values.language) : null,
      experience: values.experience ? Number(values.experience) : null,
      grade: values.grade ? Number(values.grade) : null,
    }
    if (editRow) { await supabase.from('OLX').update(payload).eq('id', editRow.id) }
    else { await supabase.from('OLX').insert(payload) }
    setModalOpen(false); fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    await createClient().from('OLX').delete().eq('id', deleteRow.id)
    setDeleteRow(null); setDeleteLoading(false); fetchData()
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Kandydaci OLX</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Baza kandydatów z portalu OLX</p>
      </div>
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={COLUMNS as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1) }}
        onAdd={canEdit ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as OLXCandidate) : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as OLXCandidate) : undefined}
        loading={loading} canEdit={canEdit} canDelete={canDelete} addLabel="Dodaj kandydata"
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? 'Edytuj kandydata' : 'Nowy kandydat'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <FormField label="Imię i nazwisko *" error={errors.name?.message}><input {...register('name')} style={inputStyle} /></FormField>
          <FormField label="Stanowisko"><input {...register('position')} style={inputStyle} /></FormField>
          <FormField label="ID OLX"><input {...register('olx_id')} type="number" style={inputStyle} /></FormField>
          <FormField label="Ocena ogólna (0-10)"><input {...register('grade')} type="number" min="0" max="10" style={inputStyle} /></FormField>
          <FormField label="Wykształcenie (0-10)"><input {...register('education')} type="number" min="0" max="10" style={inputStyle} /></FormField>
          <FormField label="Języki (0-10)"><input {...register('language')} type="number" min="0" max="10" style={inputStyle} /></FormField>
          <FormField label="Doświadczenie (0-10)"><input {...register('experience')} type="number" min="0" max="10" style={inputStyle} /></FormField>
          <FormField label="Nazwa pliku CV"><input {...register('cv_name')} style={inputStyle} /></FormField>
          <div className="col-span-2"><FormField label="URL CV"><input {...register('cv_url')} style={inputStyle} placeholder="https://..." /></FormField></div>
          <div className="col-span-2"><FormField label="Opis"><textarea {...register('description')} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} /></FormField></div>
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>Anuluj</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>{isSubmitting ? 'Zapisywanie...' : 'Zapisz'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={!!deleteRow} onClose={() => setDeleteRow(null)} onConfirm={onDelete} loading={deleteLoading} title="Usuń kandydata" description={`Usuń kandydata "${deleteRow?.name}"?`} />
    </>
  )
}
