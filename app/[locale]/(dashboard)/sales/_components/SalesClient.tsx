'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import { logActivity, computeChanges } from '@/lib/activity-log'
import type { Sale, Role } from '@/lib/supabase/types'

const schema = z.object({
  phone: z.string().min(1, 'Wymagane'),
  salesman: z.string().optional(),
  email_address: z.string().optional(),
  sale_status: z.string().optional(),
  shipping_details: z.string().optional(),
  invoice_details: z.string().optional(),
  tracking_number: z.string().optional(),
  paypal_invoice_number: z.string().optional(),
  company: z.string().optional(),
  machine_id: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const STATUS_OPTIONS = ['new', 'processing', 'shipped', 'delivered', 'cancelled']
const PAGE_SIZE = 25

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { new: '#e07818', processing: '#f59e0b', shipped: '#a855f7', delivered: '#22c55e', cancelled: '#ef4444' }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${colors[status] ?? '#6b7280'}1a`, color: colors[status] ?? '#6b7280' }}>
      {status}
    </span>
  )
}

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

function SalesmanAutocomplete({ salesmen, value, onChange, inputStyle }: {
  salesmen: string[]
  value: string
  onChange: (v: string) => void
  inputStyle: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const filtered = salesmen.filter(s => s.toLowerCase().includes((value ?? '').toLowerCase()))

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        value={value}
        style={inputStyle}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: '8px', marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}>
          {filtered.map(s => (
            <div
              key={s}
              onMouseDown={(e) => { e.preventDefault(); onChange(s); setOpen(false) }}
              style={{ padding: '8px 12px', fontSize: '14px', cursor: 'pointer', color: 'var(--text)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(224,120,24,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props { initialData: Sale[]; initialCount: number; role: Role }

export function SalesClient({ initialData, initialCount, role }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<Sale | null>(null)
  const [deleteRow, setDeleteRow] = useState<Sale | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [salesmen, setSalesmen] = useState<string[]>([])

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  useEffect(() => {
    createClient().from('Sales').select('salesman').not('salesman', 'is', null)
      .then(({ data: s }) => setSalesmen([...new Set((s ?? []).map(r => r.salesman).filter(Boolean) as string[])].sort()))
  }, [])

  const columns = useMemo<Column<Sale>[]>(() => [
    { key: 'phone', header: 'Telefon' },
    { key: 'salesman', header: 'Handlowiec', filterOptions: salesmen },
    { key: 'company', header: 'Firma' },
    { key: 'sale_status', header: 'Status', render: (v) => v ? <StatusBadge status={String(v)} /> : '—', filterOptions: STATUS_OPTIONS },
    { key: 'tracking_number', header: 'Nr śledzenia' },
    { key: 'machine_id', header: 'ID maszyny', filterable: false },
    { key: 'created_at', header: 'Data', render: (v) => v ? new Date(String(v)).toLocaleDateString('pl-PL') : '—', filterable: false },
  ], [salesmen])

  // Logistyka ma tylko odczyt
  const canEdit = ['admin', 'handlowiec'].includes(role)
  const canDelete = role === 'admin'

  const { register, handleSubmit, reset, setValue, control, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })
  const phoneWatch = useWatch({ control, name: 'phone' })
  const [autofilled, setAutofilled] = useState(false)

  useEffect(() => {
    if (editRow || !phoneWatch || phoneWatch.length < 6) { setAutofilled(false); return }
    const timer = setTimeout(async () => {
      const { data: match } = await createClient()
        .from('Sales')
        .select('salesman, email_address, shipping_details, invoice_details, company')
        .eq('phone', phoneWatch)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (match) {
        if (match.salesman) setValue('salesman', match.salesman)
        if (match.email_address) setValue('email_address', match.email_address)
        if (match.shipping_details) setValue('shipping_details', match.shipping_details)
        if (match.invoice_details) setValue('invoice_details', match.invoice_details)
        if (match.company) setValue('company', match.company)
        setAutofilled(true)
      } else {
        setAutofilled(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [phoneWatch, editRow, setValue])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Sales').select('*', { count: 'exact' })
    if (filter !== 'all') query = query.eq('sale_status', filter)
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? []); setCount(total ?? 0); setLoading(false)
  }, [page, columnFilters, filter, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const openAdd = () => { reset({}); setEditRow(null); setFormError(null); setAutofilled(false); setModalOpen(true) }
  const openEdit = (row: Sale) => {
    reset({ phone: row.phone ?? '', salesman: row.salesman ?? '', email_address: row.email_address ?? '', sale_status: row.sale_status ?? '', shipping_details: row.shipping_details ?? '', invoice_details: row.invoice_details ?? '', tracking_number: row.tracking_number ?? '', paypal_invoice_number: row.paypal_invoice_number ?? '', company: row.company ?? '', machine_id: row.machine_id?.toString() ?? '' })
    setEditRow(row); setFormError(null); setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const payload = { ...values, machine_id: values.machine_id ? Number(values.machine_id) : null }
    const { error } = editRow
      ? await supabase.from('Sales').update(payload).eq('id', editRow.id)
      : await supabase.from('Sales').insert(payload)
    if (error) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }
    const changes = editRow ? computeChanges(editRow as Record<string, unknown>, values) : undefined
    void logActivity(supabase, editRow ? 'update' : 'create', 'sales', editRow?.id ?? null, `Zamówienie: ${values.company ?? values.phone}`, changes)
    setModalOpen(false); fetchData()
  }

  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Sales').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); alert('Błąd usuwania. Spróbuj ponownie.'); return }
    void logActivity(supabase, 'delete', 'sales', deleteRow.id, `Zamówienie: ${deleteRow.company ?? deleteRow.phone}`)
    setDeleteRow(null); setDeleteLoading(false); fetchData()
  }

  const filterTabs = [{ label: 'Wszystkie', value: 'all' }, ...STATUS_OPTIONS.map(s => ({ label: s, value: s }))]

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Zamówienia</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {role === 'logistyka' ? 'Podgląd zamówień (tylko odczyt)' : 'Zarządzanie zamówieniami'}
        </p>
      </div>
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        filterTabs={filterTabs} activeFilter={filter} onFilterChange={(v) => { setFilter(v); setPage(1) }}
        onAdd={canEdit ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as Sale) : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as Sale) : undefined}
        loading={loading} canEdit={canEdit} canDelete={canDelete} addLabel="Dodaj zamówienie"
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? 'Edytuj zamówienie' : 'Nowe zamówienie'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          {autofilled && !editRow && (
            <div className="col-span-2 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(16,168,114,0.1)', color: '#10a872', border: '1px solid rgba(16,168,114,0.25)' }}>
              Uzupełniono dane z poprzedniego zamówienia tego klienta
            </div>
          )}
          <FormField label="Telefon *" error={errors.phone?.message}><input {...register('phone')} style={inputStyle} /></FormField>
          <FormField label="Handlowiec">
            <Controller
              name="salesman"
              control={control}
              render={({ field }) => (
                <SalesmanAutocomplete
                  salesmen={salesmen}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  inputStyle={inputStyle}
                />
              )}
            />
          </FormField>
          <FormField label="Email"><input {...register('email_address')} style={inputStyle} /></FormField>
          <FormField label="Status">
            <select {...register('sale_status')} style={inputStyle}>
              <option value="">— wybierz —</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Firma"><input {...register('company')} style={inputStyle} /></FormField>
          <FormField label="ID maszyny"><input {...register('machine_id')} type="number" style={inputStyle} /></FormField>
          <FormField label="Nr śledzenia"><input {...register('tracking_number')} style={inputStyle} /></FormField>
          <FormField label="PayPal Invoice"><input {...register('paypal_invoice_number')} style={inputStyle} /></FormField>
          <div className="col-span-2"><FormField label="Adres wysyłki"><textarea {...register('shipping_details')} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} /></FormField></div>
          <div className="col-span-2"><FormField label="Dane faktury"><textarea {...register('invoice_details')} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} /></FormField></div>
          {formError && <p className="col-span-2 text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>}
          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>Anuluj</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>{isSubmitting ? 'Zapisywanie...' : 'Zapisz'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={!!deleteRow} onClose={() => setDeleteRow(null)} onConfirm={onDelete} loading={deleteLoading} title="Usuń zamówienie" description={`Czy na pewno chcesz usunąć zamówienie dla "${deleteRow?.company ?? deleteRow?.phone}"?`} />
    </>
  )
}
