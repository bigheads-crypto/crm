'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField, FormActions, inputStyle } from '@/components/shared/forms'
import { DueDateBadge, DaysLeftBadge, getDiffDays } from '@/components/shared/Badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import { useFetchOnParamChange, useFilterOptions } from '@/lib/hooks/table-data'
import type { Domain } from '@/lib/supabase/types'
import { PAGE_SIZE } from '@/lib/constants'

const schema = z.object({
  domain: z.string().optional(),
  provider: z.string().optional(),
  due_date: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props { initialData: Domain[]; initialCount: number; canWrite: boolean; canEdit: boolean }

export function DomainsClient({ initialData, initialCount, canWrite, canEdit }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<Domain | null>(null)
  const [deleteRow, setDeleteRow] = useState<Domain | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const filterOptionsMap = useFilterOptions('domains', ['provider'])

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const canDelete = canEdit

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const columns = useMemo<Column<Domain>[]>(() => [
    { key: 'domain', header: 'Domena', sortable: true, filterable: true },
    { key: 'provider', header: 'Dostawca', sortable: true, filterable: true, filterOptions: filterOptionsMap.provider },
    {
      key: 'due_date',
      header: 'Data wygaśnięcia',
      sortable: true,
      render: (v) => <DueDateBadge value={v as string | null} />,
    },
    {
      key: 'days_left',
      header: 'Pozostało',
      sortable: true,
      render: (v) => <DaysLeftBadge days={v as number | null} />,
    },
    {
      key: 'created_at',
      header: 'Dodano',
      sortable: true,
      render: (v) => v ? new Date(v as string).toLocaleDateString('pl-PL') : '—',
    },
  ], [filterOptionsMap])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('domains').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    const dbSortKey = sortKey === 'days_left' ? 'due_date' : sortKey
    query = query.order(dbSortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total, error } = await query
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    setData(rows ?? [])
    setCount(total ?? 0)
    setLoading(false)
  }, [page, columnFilters, sortKey, sortDir])

  useFetchOnParamChange(fetchData)

  const openAdd = () => { reset({}); setEditRow(null); setFormError(null); setModalOpen(true) }
  const openEdit = (row: Domain) => {
    reset({
      domain: row.domain ?? '',
      provider: row.provider ?? '',
      due_date: row.due_date ? row.due_date.slice(0, 10) : '',
    })
    setEditRow(row)
    setFormError(null)
    setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const payload = {
      domain: values.domain || null,
      provider: values.provider || null,
      due_date: values.due_date || null,
    }
    const { error } = editRow
      ? await supabase.from('domains').update(payload).eq('id', editRow.id)
      : await supabase.from('domains').insert(payload)
    if (error) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }
    setModalOpen(false)
    fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const { error } = await createClient().from('domains').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); alert('Błąd usuwania. Spróbuj ponownie.'); return }
    setDeleteRow(null)
    setDeleteLoading(false)
    fetchData()
  }

  const rows = useMemo(
    () => data.map(r => ({ ...r, days_left: r.due_date ? getDiffDays(r.due_date) : null })),
    [data]
  )

  return (
    <>
      <PageHeader title="Domeny" subtitle="Zarządzanie domenami internetowymi" />
      <DataTable
        data={rows as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        totalCount={count}
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        onAdd={canWrite ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as Domain) : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as Domain) : undefined}
        loading={loading}
        loadError={loadError}
        onRetry={fetchData}
        canEdit={canEdit}
        canDelete={canDelete}
        addLabel="Dodaj domenę"
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? 'Edytuj domenę' : 'Nowa domena'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <FormField label="Domena">
            <input {...register('domain')} placeholder="np. przyklad.pl" style={inputStyle} />
          </FormField>
          <FormField label="Dostawca">
            <input {...register('provider')} placeholder="np. OVH, home.pl" style={inputStyle} />
          </FormField>
          <FormField label="Data wygaśnięcia">
            <input {...register('due_date')} type="date" style={inputStyle} />
          </FormField>
          {formError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>}
          <FormActions onCancel={() => setModalOpen(false)} isSubmitting={isSubmitting} />
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        onConfirm={onDelete}
        loading={deleteLoading}
        title="Usuń domenę"
        description={`Usuń domenę "${deleteRow?.domain}"?`}
      />
    </>
  )
}
