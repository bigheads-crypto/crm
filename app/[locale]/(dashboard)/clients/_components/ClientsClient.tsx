'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFetchOnParamChange } from '@/lib/hooks/table-data'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { History } from 'lucide-react'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField, FormActions, inputStyle, textareaStyle } from '@/components/shared/forms'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/Badge'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import { logActivity, computeChanges, type ActivityChange } from '@/lib/activity-log'
import type { Client, Sale, Role } from '@/lib/supabase/types'
import { PAGE_SIZE } from '@/lib/constants'
import { normalizePhone } from '@/lib/phone'

const STATUS_COLORS: Record<string, string> = {
  new: '#e07818', processing: '#f59e0b', shipped: '#a855f7', delivered: '#22c55e', cancelled: '#ef4444',
}

const SOURCE_OPTIONS = ['call', 'order', 'manual']

const schema = z.object({
  client_name: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  phone_alt: z.string().optional(),
  email: z.string().optional(),
  location: z.string().optional(),
  vat_no: z.string().optional(),
  assigned_salesman: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

function FormSection({ title }: { title: string }) {
  return (
    <div className="col-span-2" style={{
      borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '4px',
      fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.06em', color: 'var(--text-muted)',
    }}>
      {title}
    </div>
  )
}

interface Props {
  initialData: Client[]
  initialCount: number
  role: Role
  canWrite: boolean
  canEdit: boolean
}

export function ClientsClient({ initialData, initialCount, canWrite, canEdit }: Props) {
  const t = useTranslations('clients')
  const tTable = useTranslations('table')

  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<Client | null>(null)
  const [deleteRow, setDeleteRow] = useState<Client | null>(null)
  const [sortKey, setSortKey] = useState<string>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [historyClient, setHistoryClient] = useState<Client | null>(null)
  const [historyOrders, setHistoryOrders] = useState<Sale[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase.from('Clients').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range(from, to)

    const { data: rows, count: total, error } = await query
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    setData((rows as Client[]) ?? [])
    setCount(total ?? 0)
    setLoading(false)
  }, [page, columnFilters, sortKey, sortDir])

  useFetchOnParamChange(fetchData)

  function openAdd() {
    setEditRow(null)
    reset({})
    setModalOpen(true)
  }

  function openEdit(row: Client) {
    setEditRow(row)
    reset({
      client_name: row.client_name ?? '',
      company: row.company ?? '',
      phone: row.phone ?? '',
      phone_alt: row.phone_alt ?? '',
      email: row.email ?? '',
      location: row.location ?? '',
      vat_no: row.vat_no ?? '',
      assigned_salesman: row.assigned_salesman ?? '',
      source: row.source ?? '',
      notes: row.notes ?? '',
    })
    setModalOpen(true)
  }

  async function onSubmit(values: FormData) {
    const supabase = createClient()
    const normalized = {
      ...values,
      phone: values.phone ? normalizePhone(values.phone) : undefined,
      phone_alt: values.phone_alt ? normalizePhone(values.phone_alt) : undefined,
    }
    if (editRow) {
      const { error } = await supabase.from('Clients').update(normalized).eq('id', editRow.id)
      if (!error) {
        const changes: ActivityChange[] = computeChanges(editRow, { ...editRow, ...values })
        void logActivity(supabase, 'update', 'clients', editRow.id, `Edytowano klienta #${editRow.id}`, changes)
        setModalOpen(false)
        fetchData()
      }
    } else {
      const { error } = await supabase.from('Clients').insert(normalized)
      if (!error) {
        void logActivity(supabase, 'create', 'clients', null, `Dodano klienta: ${values.client_name ?? values.phone ?? ''}`)
        setModalOpen(false)
        fetchData()
      }
    }
  }

  async function onDelete() {
    if (!deleteRow) return
    const supabase = createClient()
    const { error } = await supabase.from('Clients').delete().eq('id', deleteRow.id)
    if (!error) {
      void logActivity(supabase, 'delete', 'clients', deleteRow.id, `Usunięto klienta: ${deleteRow.client_name ?? deleteRow.phone ?? ''}`)
      setDeleteRow(null)
      fetchData()
    }
  }

  async function openHistory(client: Client) {
    setHistoryClient(client)
    setHistoryOrders([])
    setHistoryLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('Sales')
      .select('id, created_at, sale_status, salesman, total, tracking_number, company, client_name')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
    setHistoryOrders((data as Sale[]) ?? [])
    setHistoryLoading(false)
  }

  const sourceLabels: Record<string, string> = {
    call: t('sourceCall'),
    order: t('sourceOrder'),
    manual: t('sourceManual'),
  }

  const columns: Column<Client>[] = [
    {
      key: 'client_name',
      header: t('colName'),
      sortable: true,
      filterable: true,
      render: (_val, row) => (
        <span style={{ fontWeight: 500, color: 'var(--text)' }}>
          {row.client_name || '—'}
        </span>
      ),
    },
    {
      key: 'company',
      header: t('colCompany'),
      sortable: true,
      filterable: true,
      render: (_val, row) => row.company || '—',
    },
    {
      key: 'phone',
      header: t('colPhone'),
      sortable: false,
      filterable: true,
      render: (_val, row) => (
        <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {row.phone || '—'}
        </span>
      ),
    },
    {
      key: 'email',
      header: t('colEmail'),
      sortable: false,
      filterable: true,
      render: (_val, row) => row.email || '—',
    },
    {
      key: 'location',
      header: t('colLocation'),
      sortable: true,
      filterable: true,
      render: (_val, row) => row.location || '—',
    },
    {
      key: 'assigned_salesman',
      header: t('colSalesman'),
      sortable: true,
      filterable: true,
      render: (_val, row) => row.assigned_salesman || '—',
    },
    {
      key: 'source',
      header: t('colSource'),
      sortable: true,
      filterable: true,
      filterOptions: SOURCE_OPTIONS,
      render: (_val, row) => row.source ? (sourceLabels[row.source] ?? row.source) : '—',
    },
    {
      key: 'created_at',
      header: t('colCreatedAt'),
      sortable: true,
      render: (_val, row) => new Date(row.created_at).toLocaleDateString('pl-PL'),
    },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: '1400px' }}>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={canWrite ? (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {t('addClient')}
          </button>
        ) : undefined}
      />

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={data as unknown as Record<string, unknown>[]}
        totalCount={count}
        page={page}
        pageSize={PAGE_SIZE}
        loading={loading}
        loadError={loadError}
        onRetry={fetchData}
        sortKey={sortKey}
        sortDir={sortDir}
        columnFilters={columnFilters}
        onPageChange={setPage}
        onSortChange={(key, dir) => { setSortKey(key); setSortDir(dir); setPage(1) }}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
        onEdit={canEdit ? (row) => openEdit(row as unknown as Client) : undefined}
        onDelete={canEdit ? (row) => setDeleteRow(row as unknown as Client) : undefined}
        onRowDoubleClick={(row) => openHistory(row as unknown as Client)}
        rowActions={(row) => (
          <button
            onClick={() => openHistory(row as unknown as Client)}
            className="flex h-7 w-7 items-center justify-center rounded-md"
            style={{ color: 'var(--text-muted)' }}
            title="Historia zamówień"
          >
            <History size={13} />
          </button>
        )}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRow ? t('editClient') : t('addClient')}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormSection title={t('sectionBasic')} />
            <FormField label={t('fieldName')} error={errors.client_name?.message}>
              <input {...register('client_name')} style={inputStyle} />
            </FormField>
            <FormField label={t('fieldCompany')} error={errors.company?.message}>
              <input {...register('company')} style={inputStyle} />
            </FormField>

            <FormSection title={t('sectionContact')} />
            <FormField label={t('fieldPhone')} error={errors.phone?.message}>
              <input {...register('phone')} style={inputStyle} type="tel" />
            </FormField>
            <FormField label={t('fieldPhoneAlt')} error={errors.phone_alt?.message}>
              <input {...register('phone_alt')} style={inputStyle} type="tel" />
            </FormField>
            <FormField label={t('fieldEmail')} error={errors.email?.message}>
              <input {...register('email')} style={inputStyle} type="email" />
            </FormField>
            <FormField label={t('fieldLocation')} error={errors.location?.message}>
              <input {...register('location')} style={inputStyle} />
            </FormField>

            <FormSection title={t('sectionMeta')} />
            <FormField label={t('fieldVatNo')} error={errors.vat_no?.message}>
              <input {...register('vat_no')} style={inputStyle} />
            </FormField>
            <FormField label={t('fieldSalesman')} error={errors.assigned_salesman?.message}>
              <input {...register('assigned_salesman')} style={inputStyle} />
            </FormField>
            <FormField label={t('fieldSource')} error={errors.source?.message}>
              <select {...register('source')} style={inputStyle}>
                <option value="">{tTable('all')}</option>
                {SOURCE_OPTIONS.map(s => (
                  <option key={s} value={s}>{sourceLabels[s]}</option>
                ))}
              </select>
            </FormField>
            <div className="col-span-2">
              <FormField label={t('fieldNotes')} error={errors.notes?.message}>
                <textarea {...register('notes')} style={textareaStyle} />
              </FormField>
            </div>
          </div>

          <FormActions
            onCancel={() => setModalOpen(false)}
            isSubmitting={isSubmitting}
            submitLabel={tTable('save')}
            cancelLabel={tTable('cancel')}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        onConfirm={onDelete}
        title={t('deleteTitle')}
        description={t('deleteDescription')}
      />

      <Modal
        open={!!historyClient}
        onClose={() => setHistoryClient(null)}
        title={historyClient ? (historyClient.client_name ?? historyClient.company ?? historyClient.phone ?? 'Klient') : ''}
        size="lg"
      >
        {historyClient && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Dane klienta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', padding: '12px 16px', borderRadius: '10px', backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              {[
                ['Telefon', historyClient.phone],
                ['Tel. alt.', historyClient.phone_alt],
                ['Email', historyClient.email],
                ['Firma', historyClient.company],
                ['Lokalizacja', historyClient.location],
                ['NIP', historyClient.vat_no],
                ['Handlowiec', historyClient.assigned_salesman],
                ['Źródło', historyClient.source ? (sourceLabels[historyClient.source] ?? historyClient.source) : null],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={String(label)} style={{ display: 'flex', gap: '6px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)', minWidth: '80px', flexShrink: 0 }}>{label}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
              {historyClient.notes && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '6px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)', minWidth: '80px', flexShrink: 0 }}>Notatki</span>
                  <span style={{ color: 'var(--text)' }}>{historyClient.notes}</span>
                </div>
              )}
            </div>

            {/* Historia zamówień */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Historia zamówień
              </p>
              {historyLoading ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Ładowanie...</p>
              ) : historyOrders.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Brak zamówień</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {historyOrders.map(order => (
                    <div
                      key={order.id}
                      style={{
                        display: 'grid', gridTemplateColumns: '90px 1fr 1fr 90px 110px',
                        gap: '8px', alignItems: 'center', padding: '8px 12px',
                        borderRadius: '8px', backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)', fontSize: '13px',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        {new Date(order.created_at).toLocaleDateString('pl-PL')}
                      </span>
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                        #{order.id} {order.company ?? order.client_name ?? ''}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>{order.salesman ?? '—'}</span>
                      <span style={{ color: 'var(--text)', textAlign: 'right' }}>
                        {order.total != null ? `${Number(order.total).toLocaleString('pl-PL')} €` : '—'}
                      </span>
                      {order.sale_status ? (
                        <StatusBadge status={order.sale_status} colors={STATUS_COLORS} />
                      ) : <span />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
