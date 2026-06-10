'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
import type { Review, Role } from '@/lib/supabase/types'

const CHANNELS = ['Telefon', 'WhatsApp', 'WhatsApp Opera', 'Email'] as const

const schema = z.object({
  technik: z.string().min(1, 'Technik jest wymagany'),
  contact: z.string().min(1, 'Numer lub email jest wymagany'),
  channel: z.enum(['Telefon', 'WhatsApp', 'WhatsApp Opera', 'Email'], {
    error: 'Wybierz kanał wysyłki',
  }),
  napisano: z.boolean().optional(),
  napisac: z.boolean().optional(),
  wystawil: z.boolean().optional(),
  google_name: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const PAGE_SIZE = 25

const CHANNEL_COLORS: Record<string, string> = {
  'Telefon': '#10a872',
  'WhatsApp': '#25D366',
  'WhatsApp Opera': '#128C7E',
  'Email': '#e07818',
}

function ChannelBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: 'var(--text-dim)' }}>—</span>
  const color = CHANNEL_COLORS[value] ?? 'var(--text-muted)'
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {value}
    </span>
  )
}

function CheckBadge({ value }: { value: boolean | null }) {
  if (value == null || value === false)
    return <span style={{ color: 'var(--text-dim)', fontSize: '16px' }}>—</span>
  return <span style={{ color: '#10a872', fontSize: '16px' }}>✓</span>
}

interface Props {
  initialData: Review[]
  initialCount: number
  role: Role
  userName: string
  canWrite: boolean
  canEdit: boolean
}

export function ReviewsClient({ initialData, initialCount, role, userName, canWrite, canEdit }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<Review | null>(null)
  const [deleteRow, setDeleteRow] = useState<Review | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const canDelete = canEdit

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const columns = useMemo<Column<Review>[]>(() => [
    { key: 'technik', header: 'Technik', sortable: true, filterable: true },
    { key: 'contact', header: 'Numer / Email', sortable: true, filterable: true },
    {
      key: 'channel',
      header: 'Kanał',
      sortable: true,
      filterable: true,
      filterOptions: [...CHANNELS],
      render: (v) => <ChannelBadge value={v as string | null} />,
    },
    {
      key: 'created_at',
      header: 'Data dodania',
      sortable: true,
      render: (v) => v ? new Date(String(v)).toLocaleDateString('pl-PL') : '—',
    },
    { key: 'google_name', header: 'Google Name', sortable: true, filterable: true },
    {
      key: 'napisano',
      header: 'Napisano',
      sortable: false,
      render: (v) => <CheckBadge value={v as boolean | null} />,
    },
    {
      key: 'napisac',
      header: 'Napisać',
      sortable: false,
      render: (v) => <CheckBadge value={v as boolean | null} />,
    },
    {
      key: 'wystawil',
      header: 'Wystawił',
      sortable: false,
      render: (v) => <CheckBadge value={v as boolean | null} />,
    },
  ], [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Opinie').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? []); setCount(total ?? 0); setLoading(false)
  }, [page, columnFilters, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => {
    reset({ technik: userName, contact: '', channel: undefined, napisano: false, napisac: false, wystawil: false, google_name: '' })
    setEditRow(null); setFormError(null); setModalOpen(true)
  }

  const openEdit = (row: Review) => {
    reset({
      technik: row.technik ?? '',
      contact: row.contact ?? '',
      channel: (row.channel as FormData['channel']) ?? undefined,
      napisano: row.napisano ?? false,
      napisac: row.napisac ?? false,
      wystawil: row.wystawil ?? false,
      google_name: row.google_name ?? '',
    })
    setEditRow(row); setFormError(null); setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const { error } = editRow
      ? await supabase.from('Opinie').update(values).eq('id', editRow.id)
      : await supabase.from('Opinie').insert(values)
    if (error) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }
    const changes = editRow ? computeChanges(editRow, values) : undefined
    void logActivity(supabase, editRow ? 'update' : 'create', 'reviews', editRow?.id ?? null, `Opinia: ${values.contact} (${values.channel})`, changes)
    setModalOpen(false); fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Opinie').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); alert('Błąd usuwania. Spróbuj ponownie.'); return }
    void logActivity(supabase, 'delete', 'reviews', deleteRow.id, `Opinia: ${deleteRow.contact ?? ''} (${deleteRow.channel ?? ''})`)
    setDeleteRow(null); setDeleteLoading(false); fetchData()
  }

  return (
    <>
      <PageHeader title="Opinie" subtitle="Historia wysłanych próśb o wystawienie opinii" />
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        onAdd={canWrite ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as Review) : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as Review) : undefined}
        loading={loading} canEdit={canEdit} canDelete={canDelete} addLabel="Dodaj opinię"
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? 'Edytuj opinię' : 'Nowa opinia'}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <FormField label="Technik" error={errors.technik?.message}>
            <input {...register('technik')} style={inputStyle} />
          </FormField>
          <FormField label="Numer telefonu lub email" error={errors.contact?.message}>
            <input {...register('contact')} placeholder="np. 48123456789 lub klient@email.com" style={inputStyle} />
          </FormField>
          <FormField label="Kanał wysyłki" error={errors.channel?.message}>
            <select {...register('channel')} style={inputStyle}>
              <option value="">— wybierz —</option>
              {CHANNELS.map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Google Name (opcjonalnie)">
            <input {...register('google_name')} placeholder="np. Jan K." style={inputStyle} />
          </FormField>
          <div
            className="flex gap-6 px-3 py-3 rounded-lg mt-1"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {([
              { name: 'napisano', label: 'Napisano' },
              { name: 'napisac', label: 'Napisać' },
              { name: 'wystawil', label: 'Wystawił' },
            ] as const).map(({ name, label }) => (
              <label key={name} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text)' }}>
                <input type="checkbox" {...register(name)} className="w-4 h-4 rounded" />
                {label}
              </label>
            ))}
          </div>
          {formError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>}
          <FormActions onCancel={() => setModalOpen(false)} isSubmitting={isSubmitting} />
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        onConfirm={onDelete}
        loading={deleteLoading}
        title="Usuń opinię"
        description={`Usuń wpis dla "${deleteRow?.contact}"?`}
      />
    </>
  )
}
