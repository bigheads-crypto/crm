'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField, FormActions, inputStyle } from '@/components/shared/forms'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/Badge'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import { logActivity, computeChanges } from '@/lib/activity-log'
import type { Sale, Product, Role } from '@/lib/supabase/types'

const PAYMENT_OPTIONS = ['PayPal', 'przelew']
const STATUS_OPTIONS = ['new', 'processing', 'shipped', 'delivered', 'cancelled']
const STATUS_COLORS: Record<string, string> = {
  new: '#e07818', processing: '#f59e0b', shipped: '#a855f7', delivered: '#22c55e', cancelled: '#ef4444',
}
const PAGE_SIZE = 25

const schema = z.object({
  phone: z.string().min(1, 'Wymagane'),
  client_name: z.string().optional(),
  company: z.string().optional(),
  email_address: z.string().optional(),
  location: z.string().optional(),
  vat_no: z.string().optional(),
  salesman: z.string().optional(),
  first_contact: z.string().optional(),
  sale_status: z.string().optional(),
  product_id: z.string().optional(),
  quantity: z.string().optional(),
  price: z.string().optional(),
  shipping_cost: z.string().optional(),
  total: z.string().optional(),
  payment_method: z.string().optional(),
  paypal_invoice_number: z.string().optional(),
  tracking_number: z.string().optional(),
  shipping_details: z.string().optional(),
  invoice_details: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

function SalesmanAutocomplete({ salesmen, value, onChange, inputStyle: style }: {
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
        style={style}
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

interface Props { initialData: Sale[]; initialCount: number; role: Role; canWrite: boolean; canEdit: boolean }

export function SalesClient({ initialData, initialCount, role, canWrite, canEdit }: Props) {
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
  const [products, setProducts] = useState<Product[]>([])

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('Sales').select('salesman').not('salesman', 'is', null)
        .then(({ data: s }) => setSalesmen([...new Set((s ?? []).map(r => r.salesman).filter(Boolean) as string[])].sort())),
      supabase.from('Products').select('*').order('category').order('name')
        .then(({ data: p }) => setProducts(p ?? [])),
    ])
  }, [])

  const productMap = useMemo(() =>
    Object.fromEntries(products.map(p => [p.id, p])),
    [products]
  )

  const emulators = useMemo(() => products.filter(p => p.category === 'emulator'), [products])
  const pipes = useMemo(() => products.filter(p => p.category === 'rura'), [products])
  const others = useMemo(() => products.filter(p => !['emulator', 'rura'].includes(p.category ?? '')), [products])

  const columns = useMemo<Column<Sale>[]>(() => [
    { key: 'phone', header: 'Telefon', width: '130px' },
    { key: 'client_name', header: 'Klient' },
    { key: 'company', header: 'Firma' },
    { key: 'salesman', header: 'Handlowiec', filterOptions: salesmen },
    {
      key: 'sale_status', header: 'Status', width: '120px',
      render: (v) => v ? <StatusBadge status={String(v)} colors={STATUS_COLORS} /> : '—',
      filterOptions: STATUS_OPTIONS,
    },
    {
      key: 'product_id', header: 'Produkt', filterable: false,
      render: (v) => v ? (productMap[Number(v)]?.name ?? `#${v}`) : '—',
    },
    {
      key: 'total', header: 'Total', filterable: false, width: '90px',
      render: (v) => v != null ? `${Number(v).toLocaleString('pl-PL')} €` : '—',
    },
    { key: 'tracking_number', header: 'Nr śledzenia' },
    {
      key: 'created_at', header: 'Data', filterable: false, width: '100px',
      render: (v) => v ? new Date(String(v)).toLocaleDateString('pl-PL') : '—',
    },
  ], [salesmen, productMap])

  const canDelete = canEdit

  const { register, handleSubmit, reset, setValue, control, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })
  const phoneWatch = useWatch({ control, name: 'phone' })
  const [autofilled, setAutofilled] = useState(false)

  useEffect(() => {
    if (editRow || !phoneWatch || phoneWatch.length < 6) { setAutofilled(false); return }
    const timer = setTimeout(async () => {
      const { data: match } = await createClient()
        .from('Sales')
        .select('salesman, email_address, shipping_details, invoice_details, company, client_name, location, vat_no, first_contact')
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
        if (match.client_name) setValue('client_name', match.client_name)
        if (match.location) setValue('location', match.location)
        if (match.vat_no) setValue('vat_no', match.vat_no)
        if (match.first_contact) setValue('first_contact', match.first_contact)
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
    reset({
      phone: row.phone ?? '',
      client_name: row.client_name ?? '',
      company: row.company ?? '',
      email_address: row.email_address ?? '',
      location: row.location ?? '',
      vat_no: row.vat_no ?? '',
      salesman: row.salesman ?? '',
      first_contact: row.first_contact ?? '',
      sale_status: row.sale_status ?? '',
      product_id: row.product_id != null ? String(row.product_id) : '',
      quantity: row.quantity != null ? String(row.quantity) : '',
      price: row.price != null ? String(row.price) : '',
      shipping_cost: row.shipping_cost != null ? String(row.shipping_cost) : '',
      total: row.total != null ? String(row.total) : '',
      payment_method: row.payment_method ?? '',
      paypal_invoice_number: row.paypal_invoice_number ?? '',
      tracking_number: row.tracking_number ?? '',
      shipping_details: row.shipping_details ?? '',
      invoice_details: row.invoice_details ?? '',
      notes: row.notes ?? '',
    })
    setEditRow(row); setFormError(null); setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const payload = {
      phone: values.phone,
      client_name: values.client_name || null,
      company: values.company || null,
      email_address: values.email_address || null,
      location: values.location || null,
      vat_no: values.vat_no || null,
      salesman: values.salesman || null,
      first_contact: values.first_contact || null,
      sale_status: values.sale_status || null,
      product_id: values.product_id ? Number(values.product_id) : null,
      quantity: values.quantity ? Number(values.quantity) : null,
      price: values.price ? Number(values.price) : null,
      shipping_cost: values.shipping_cost ? Number(values.shipping_cost) : null,
      total: values.total ? Number(values.total) : null,
      payment_method: values.payment_method || null,
      paypal_invoice_number: values.paypal_invoice_number || null,
      tracking_number: values.tracking_number || null,
      shipping_details: values.shipping_details || null,
      invoice_details: values.invoice_details || null,
      notes: values.notes || null,
    }
    const { error } = editRow
      ? await supabase.from('Sales').update(payload).eq('id', editRow.id)
      : await supabase.from('Sales').insert(payload)
    if (error) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }
    const changes = editRow ? computeChanges(editRow as unknown as Record<string, unknown>, values) : undefined
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
      <PageHeader
        title="Zamówienia"
        subtitle={role === 'logistyka' ? 'Podgląd zamówień (tylko odczyt)' : 'Zarządzanie zamówieniami'}
      />
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        filterTabs={filterTabs} activeFilter={filter} onFilterChange={(v) => { setFilter(v); setPage(1) }}
        onAdd={canWrite ? openAdd : undefined}
        onEdit={canEdit ? (row) => openEdit(row as unknown as Sale) : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as Sale) : undefined}
        loading={loading} canEdit={canEdit} canDelete={canDelete} addLabel="Dodaj zamówienie"
        sortKey={sortKey} sortDir={sortDir} onSortChange={handleSort}
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

          <FormSection title="Klient" />
          <FormField label="Telefon *" error={errors.phone?.message}><input {...register('phone')} style={inputStyle} /></FormField>
          <FormField label="Imię i nazwisko"><input {...register('client_name')} style={inputStyle} /></FormField>
          <FormField label="Firma"><input {...register('company')} style={inputStyle} /></FormField>
          <FormField label="Email"><input {...register('email_address')} style={inputStyle} /></FormField>
          <FormField label="Lokalizacja"><input {...register('location')} style={inputStyle} placeholder="np. Niemcy" /></FormField>
          <FormField label="VAT No (EU)"><input {...register('vat_no')} style={inputStyle} /></FormField>

          <FormSection title="Zamówienie" />
          <FormField label="Handlowiec">
            <Controller name="salesman" control={control}
              render={({ field }) => (
                <SalesmanAutocomplete salesmen={salesmen} value={field.value ?? ''} onChange={field.onChange} inputStyle={inputStyle} />
              )}
            />
          </FormField>
          <FormField label="Pierwszy kontakt">
            <Controller name="first_contact" control={control}
              render={({ field }) => (
                <SalesmanAutocomplete salesmen={salesmen} value={field.value ?? ''} onChange={field.onChange} inputStyle={inputStyle} />
              )}
            />
          </FormField>
          <FormField label="Status">
            <select {...register('sale_status')} style={inputStyle}>
              <option value="">— wybierz —</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <FormField label="Ilość"><input {...register('quantity')} type="number" min="1" style={inputStyle} /></FormField>
          <div className="col-span-2">
            <FormField label="Produkt">
              <select {...register('product_id')} style={inputStyle}>
                <option value="">— wybierz produkt —</option>
                {emulators.length > 0 && (
                  <optgroup label="Emulatory">
                    {emulators.map(p => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name} (Stan: {p.stock_qty})
                      </option>
                    ))}
                  </optgroup>
                )}
                {pipes.length > 0 && (
                  <optgroup label="Rury">
                    {pipes.map(p => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name} (Stan: {p.stock_qty})
                      </option>
                    ))}
                  </optgroup>
                )}
                {others.length > 0 && (
                  <optgroup label="Inne">
                    {others.map(p => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name} (Stan: {p.stock_qty})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </FormField>
          </div>

          <FormSection title="Płatność" />
          <FormField label="Cena (€)"><input {...register('price')} type="number" step="0.01" style={inputStyle} /></FormField>
          <FormField label="Shipping (€)"><input {...register('shipping_cost')} type="number" step="0.01" style={inputStyle} /></FormField>
          <FormField label="Total (€)"><input {...register('total')} type="number" step="0.01" style={inputStyle} /></FormField>
          <FormField label="Sposób płatności">
            <select {...register('payment_method')} style={inputStyle}>
              <option value="">— wybierz —</option>
              {PAYMENT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </FormField>
          <FormField label="PayPal Invoice"><input {...register('paypal_invoice_number')} style={inputStyle} /></FormField>
          <FormField label="Nr śledzenia"><input {...register('tracking_number')} style={inputStyle} /></FormField>

          <FormSection title="Adresy i notatki" />
          <div className="col-span-2">
            <FormField label="Adres wysyłki"><textarea {...register('shipping_details')} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} /></FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Dane faktury"><textarea {...register('invoice_details')} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} /></FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Notatki"><textarea {...register('notes')} style={{ ...inputStyle, minHeight: '50px', resize: 'vertical' }} /></FormField>
          </div>

          {formError && <p className="col-span-2 text-sm" style={{ color: 'var(--danger)' }}>{formError}</p>}
          <FormActions onCancel={() => setModalOpen(false)} isSubmitting={isSubmitting} className="col-span-2" />
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteRow} onClose={() => setDeleteRow(null)} onConfirm={onDelete} loading={deleteLoading}
        title="Usuń zamówienie"
        description={`Czy na pewno chcesz usunąć zamówienie dla "${deleteRow?.company ?? deleteRow?.phone}"?`}
      />
    </>
  )
}
