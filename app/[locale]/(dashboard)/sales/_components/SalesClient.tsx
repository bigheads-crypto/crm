'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
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
import { useFetchOnParamChange, useFilterOptions } from '@/lib/hooks/table-data'
import { logActivity, computeChanges } from '@/lib/activity-log'
import type { Sale, SaleItem, Zestaw, Client, Role } from '@/lib/supabase/types'
import { PAGE_SIZE } from '@/lib/constants'
import { normalizePhone } from '@/lib/phone'

const PAYMENT_OPTIONS = ['PayPal', 'przelew']
const STATUS_OPTIONS = ['new', 'processing', 'shipped', 'delivered', 'cancelled']
const STATUS_COLORS: Record<string, string> = {
  new: '#e07818', processing: '#f59e0b', shipped: '#a855f7', delivered: '#22c55e', cancelled: '#ef4444',
}
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

interface Props { initialData: Sale[]; initialCount: number; role: Role; canWrite: boolean; canEdit: boolean; handlowcy: string[]; currentSalesman: string }

export function SalesClient({ initialData, initialCount, role, canWrite, canEdit, handlowcy, currentSalesman }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<Sale | null>(null)
  const [deleteRow, setDeleteRow] = useState<Sale | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const filterOptionsMap = useFilterOptions('Sales', ['salesman'])
  const [zestawy, setZestawy] = useState<Zestaw[]>([])
  type ItemRow = { zestaw_id: string; quantity: string; price: string }
  const [formItems, setFormItems] = useState<ItemRow[]>([])
  const [itemsMap, setItemsMap] = useState<Record<number, SaleItem[]>>({})

  function addItem() { setFormItems(prev => [...prev, { zestaw_id: '', quantity: '1', price: '' }]) }
  function removeItem(i: number) { setFormItems(prev => prev.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, field: keyof ItemRow, value: string) {
    setFormItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
  }

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  useEffect(() => {
    createClient().from('Zestawy').select('*').order('nr', { ascending: true })
      .then(({ data: z }) => setZestawy(z ?? []))
  }, [])

  const zestawMap = useMemo(() =>
    Object.fromEntries(zestawy.map(z => [z.id, z])),
    [zestawy]
  )

  const columns = useMemo<Column<Sale>[]>(() => [
    { key: 'phone', header: 'Telefon', width: '130px' },
    { key: 'client_name', header: 'Klient' },
    { key: 'company', header: 'Firma' },
    { key: 'salesman', header: 'Handlowiec', filterOptions: filterOptionsMap.salesman },
    {
      key: 'sale_status', header: 'Status', width: '120px',
      render: (v) => v ? <StatusBadge status={String(v)} colors={STATUS_COLORS} /> : '—',
      filterOptions: STATUS_OPTIONS,
    },
    {
      key: 'zestaw_id', header: 'Zestawy', filterable: false, sortable: false,
      render: (_v, row) => {
        const items = itemsMap[(row as unknown as Sale).id] ?? []
        if (items.length === 0) return '—'
        return (
          <span style={{ fontSize: '12px' }}>
            {items.map(item => {
              const z = zestawMap[item.zestaw_id ?? 0]
              return z ? `#${z.nr} ${z.name}` : `#${item.zestaw_id}`
            }).join(', ')}
          </span>
        )
      },
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
  ], [filterOptionsMap, zestawMap, itemsMap])

  const canDelete = canEdit

  const { register, handleSubmit, reset, setValue, control, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) })
  const phoneWatch = useWatch({ control, name: 'phone' })
  const emailWatch = useWatch({ control, name: 'email_address' })
  const companyWatch = useWatch({ control, name: 'company' })
  const shippingWatch = useWatch({ control, name: 'shipping_cost' })
  const [autofilled, setAutofilled] = useState(false)
  const [foundClient, setFoundClient] = useState<Client | null>(null)
  const [suggestedClient, setSuggestedClient] = useState<Client | null>(null)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)

  const itemsTotal = useMemo(() =>
    formItems.reduce((sum, item) => {
      const p = parseFloat(item.price) || 0
      const q = parseInt(item.quantity) || 1
      return sum + p * q
    }, 0),
    [formItems]
  )

  useEffect(() => {
    setValue('price', itemsTotal > 0 ? String(itemsTotal) : '')
  }, [itemsTotal, setValue])

  useEffect(() => {
    const shipping = parseFloat(shippingWatch ?? '') || 0
    const total = itemsTotal + shipping
    setValue('total', total > 0 ? String(total) : '')
  }, [itemsTotal, shippingWatch, setValue])

  useEffect(() => {
    if (editRow || !phoneWatch || phoneWatch.length < 6) {
      setAutofilled(false)
      setFoundClient(null)
      setSuggestedClient(null)
      return
    }
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const normalized = normalizePhone(phoneWatch)

      // 1. Sprawdź Clients (główny + alternatywny numer) — po znormalizowanym numerze
      const { data: client } = await supabase
        .from('Clients')
        .select('*')
        .or(`phone.eq.${normalized},phone_alt.eq.${normalized}`)
        .maybeSingle()

      if (client) {
        setFoundClient(client as Client)
        if (client.client_name) setValue('client_name', client.client_name)
        if (client.company) setValue('company', client.company)
        if (client.email) setValue('email_address', client.email)
        if (client.location) setValue('location', client.location)
        if (client.vat_no) setValue('vat_no', client.vat_no)
        if (client.assigned_salesman) setValue('salesman', client.assigned_salesman)

        // Pobierz adres wysyłki i faktury z ostatniego zamówienia
        const { data: lastSale } = await supabase
          .from('Sales')
          .select('shipping_details, invoice_details, first_contact')
          .eq('client_id', client.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (lastSale?.shipping_details) setValue('shipping_details', lastSale.shipping_details)
        if (lastSale?.invoice_details) setValue('invoice_details', lastSale.invoice_details)
        // Pierwszy kontakt: z poprzedniego zamówienia, a dla świeżego leada — opiekun klienta
        const firstContact = lastSale?.first_contact || client.assigned_salesman
        if (firstContact) setValue('first_contact', firstContact)
        setAutofilled(true)
        return
      }

      // 2. Fallback — stary lookup po Sales (dla klientów sprzed Clients)
      const { data: match } = await supabase
        .from('Sales')
        .select('salesman, email_address, shipping_details, invoice_details, company, client_name, location, vat_no, first_contact')
        .eq('phone', normalized)
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
        setFoundClient(null)
      } else {
        setAutofilled(false)
        setFoundClient(null)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [phoneWatch, editRow, setValue])

  // Lookup po emailu — tylko gdy telefon nic nie znalazł
  useEffect(() => {
    if (editRow || foundClient || autofilled || suggestionDismissed) return
    if (!emailWatch || emailWatch.length < 4) { setSuggestedClient(null); return }
    const timer = setTimeout(async () => {
      const { data } = await createClient()
        .from('Clients')
        .select('*')
        .eq('email', emailWatch)
        .maybeSingle()
      setSuggestedClient(data ? (data as Client) : null)
    }, 400)
    return () => clearTimeout(timer)
  }, [emailWatch, editRow, foundClient, autofilled, suggestionDismissed])

  // Lookup po nazwie firmy — tylko gdy email nic nie znalazł
  useEffect(() => {
    if (editRow || foundClient || autofilled || suggestionDismissed || suggestedClient) return
    if (!companyWatch || companyWatch.length < 3) return
    const timer = setTimeout(async () => {
      const { data } = await createClient()
        .from('Clients')
        .select('*')
        .ilike('company', `%${companyWatch}%`)
        .limit(1)
        .maybeSingle()
      if (data) setSuggestedClient(data as Client)
    }, 400)
    return () => clearTimeout(timer)
  }, [companyWatch, editRow, foundClient, autofilled, suggestionDismissed, suggestedClient])

  function linkToSuggestedClient(client: Client) {
    setFoundClient(client)
    setSuggestedClient(null)
    if (client.client_name) setValue('client_name', client.client_name)
    if (client.company) setValue('company', client.company)
    if (client.email) setValue('email_address', client.email)
    if (client.location) setValue('location', client.location)
    if (client.vat_no) setValue('vat_no', client.vat_no)
    setAutofilled(true)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Sales').select('*', { count: 'exact' })
    if (filter !== 'all') query = query.eq('sale_status', filter)
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total, error } = await query
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    setData(rows ?? [])
    setCount(total ?? 0)
    if (rows && rows.length > 0) {
      const { data: items } = await supabase
        .from('Sales Items')
        .select('*')
        .in('sale_id', rows.map(r => r.id))
      const map: Record<number, SaleItem[]> = {}
      for (const item of (items ?? [])) {
        if (!map[item.sale_id]) map[item.sale_id] = []
        map[item.sale_id].push(item)
      }
      setItemsMap(map)
    } else {
      setItemsMap({})
    }
    setLoading(false)
  }, [page, columnFilters, filter, sortKey, sortDir])

  useFetchOnParamChange(fetchData)

  const openAdd = (prefillPhone?: string) => {
    reset({ sale_status: 'new', salesman: currentSalesman, ...(prefillPhone ? { phone: prefillPhone } : {}) })
    setEditRow(null)
    setFormError(null)
    setAutofilled(false)
    setFoundClient(null)
    setSuggestedClient(null)
    setSuggestionDismissed(false)
    setFormItems([{ zestaw_id: '', quantity: '1', price: '' }])
    setModalOpen(true)
  }

  // Prefill „Dodaj zamówienie" z popupu rozmowy QUO (CallPopupHost).
  // Dwie ścieżki: event okna (już na /sales) + sessionStorage (po nawigacji na /sales).
  useEffect(() => {
    if (!canWrite) return
    function openPrefilled(phone: string) {
      try { sessionStorage.removeItem('crm:newOrderPhone') } catch { /* ignore */ }
      openAdd(phone || undefined)
    }
    function onOpenNewOrder(e: Event) {
      const phone = (e as CustomEvent<{ phone?: string }>).detail?.phone ?? ''
      openPrefilled(phone)
    }
    window.addEventListener('crm:openNewOrder', onOpenNewOrder)
    try {
      const stored = sessionStorage.getItem('crm:newOrderPhone')
      if (stored !== null) openPrefilled(stored)
    } catch { /* ignore */ }
    return () => window.removeEventListener('crm:openNewOrder', onOpenNewOrder)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const openEdit = async (row: Sale) => {
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
    const supabase = createClient()
    const { data: items } = await supabase
      .from('Sales Items')
      .select('*')
      .eq('sale_id', row.id)
      .order('id', { ascending: true })
    setFormItems(
      (items ?? []).length > 0
        ? (items ?? []).map(item => ({
            zestaw_id: item.zestaw_id != null ? String(item.zestaw_id) : '',
            quantity: String(item.quantity),
            price: item.price != null ? String(item.price) : '',
          }))
        : [{ zestaw_id: '', quantity: '1', price: '' }]
    )
    setEditRow(row)
    setFormError(null)
    setModalOpen(true)
  }

  const onSubmit = async (values: FormData) => {
    const supabase = createClient()
    const payload = {
      phone: values.phone ? normalizePhone(values.phone) : null,
      client_name: values.client_name || null,
      company: values.company || null,
      email_address: values.email_address || null,
      location: values.location || null,
      vat_no: values.vat_no || null,
      salesman: values.salesman || null,
      first_contact: values.first_contact || null,
      sale_status: values.sale_status || null,
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

    // Ustal client_id — tylko przy nowym zamówieniu
    let clientId: number | null = editRow?.client_id ?? null
    if (!editRow) {
      if (foundClient) {
        clientId = foundClient.id
      } else if (values.phone) {
        // Nowy klient — auto-INSERT do Clients
        const { data: newClient } = await supabase
          .from('Clients')
          .insert({
            phone: values.phone ? normalizePhone(values.phone) : null,
            client_name: values.client_name || null,
            company: values.company || null,
            email: values.email_address || null,
            location: values.location || null,
            vat_no: values.vat_no || null,
            assigned_salesman: values.salesman || null,
            source: 'order',
          })
          .select('id')
          .single()
        if (newClient) clientId = newClient.id
      }
    }

    let saleId: number
    if (editRow) {
      const { error } = await supabase.from('Sales').update({ ...payload, client_id: clientId }).eq('id', editRow.id)
      if (error) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }
      saleId = editRow.id
    } else {
      const { data: saved, error } = await supabase.from('Sales').insert({ ...payload, client_id: clientId }).select('id').single()
      if (error || !saved) { setFormError('Błąd zapisu. Spróbuj ponownie.'); return }
      saleId = saved.id
    }

    // Zapisz pozycje: usuń stare, wstaw nowe
    await supabase.from('Sales Items').delete().eq('sale_id', saleId)
    const validItems = formItems.filter(item => item.zestaw_id)
    if (validItems.length > 0) {
      await supabase.from('Sales Items').insert(
        validItems.map(item => ({
          sale_id: saleId,
          zestaw_id: Number(item.zestaw_id),
          quantity: Number(item.quantity) || 1,
          price: item.price ? Number(item.price) : null,
        }))
      )
    }

    const changes = editRow ? computeChanges(editRow as unknown as Record<string, unknown>, values) : undefined
    void logActivity(supabase, editRow ? 'update' : 'create', 'sales', saleId, `Zamówienie: ${values.company ?? values.phone}`, changes)
    setModalOpen(false)
    fetchData()
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
        onAdd={canWrite ? () => openAdd() : undefined}
        onEdit={canEdit ? (row) => { void openEdit(row as unknown as Sale) } : undefined}
        onDelete={canDelete ? (row) => setDeleteRow(row as unknown as Sale) : undefined}
        loading={loading} canEdit={canEdit} canDelete={canDelete} addLabel="Dodaj zamówienie"
        loadError={loadError} onRetry={fetchData}
        sortKey={sortKey} sortDir={sortDir} onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRow ? 'Edytuj zamówienie' : 'Nowe zamówienie'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          {autofilled && !editRow && (
            <div className="col-span-2 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(16,168,114,0.1)', color: '#10a872', border: '1px solid rgba(16,168,114,0.25)' }}>
              {foundClient
                ? `Znany klient: ${foundClient.client_name ?? foundClient.company ?? foundClient.phone} — dane uzupełnione z bazy klientów`
                : 'Uzupełniono dane z poprzedniego zamówienia tego klienta'}
            </div>
          )}
          {suggestedClient && !editRow && (
            <div className="col-span-2 flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: 'rgba(224,120,24,0.1)', color: 'var(--accent)', border: '1px solid rgba(224,120,24,0.3)' }}>
              <span>
                Znamy tę firmę: <strong>{suggestedClient.client_name ?? suggestedClient.company}</strong>
                {suggestedClient.assigned_salesman ? ` — przypisana do: ${suggestedClient.assigned_salesman}` : ''}
                {' '}— czy to ten sam klient?
              </span>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => linkToSuggestedClient(suggestedClient)}
                  className="px-3 py-1 rounded font-medium"
                  style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                >
                  Połącz
                </button>
                <button
                  type="button"
                  onClick={() => { setSuggestedClient(null); setSuggestionDismissed(true) }}
                  className="px-3 py-1 rounded font-medium"
                  style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}
                >
                  Nowy klient
                </button>
              </div>
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
            <input
              {...register('salesman')}
              readOnly
              style={{ ...inputStyle, backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)', cursor: 'default' }}
            />
          </FormField>
          <FormField label="Pierwszy kontakt">
            <input
              {...register('first_contact')}
              readOnly
              style={{ ...inputStyle, backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)', cursor: 'default' }}
            />
          </FormField>
          <div className="col-span-2">
            <FormField label="Status">
              <select {...register('sale_status')} style={inputStyle}>
                <option value="">— wybierz —</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
          </div>
          <div className="col-span-2">
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '4px', marginBottom: '8px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Pozycje zamówienia
            </div>
            <div className="flex flex-col gap-2">
              {formItems.map((item, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div style={{ flex: '1 1 0' }}>
                    {i === 0 && <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Zestaw</label>}
                    <select
                      value={item.zestaw_id}
                      onChange={e => {
                        const id = e.target.value
                        const z = zestawy.find(z => String(z.id) === id)
                        setFormItems(prev => prev.map((it, idx) => idx !== i ? it : {
                          ...it,
                          zestaw_id: id,
                          price: z?.price != null ? String(z.price) : it.price,
                        }))
                      }}
                      style={inputStyle}
                    >
                      <option value="">— wybierz zestaw —</option>
                      {zestawy.map(z => (
                        <option key={z.id} value={String(z.id)}>#{z.nr} {z.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: '72px' }}>
                    {i === 0 && <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Ilość</label>}
                    <input
                      type="number" min="1" value={item.quantity}
                      onChange={e => updateItem(i, 'quantity', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ width: '100px' }}>
                    {i === 0 && <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Cena</label>}
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number" step="0.01" value={item.price}
                        onChange={e => updateItem(i, 'price', e.target.value)}
                        style={{ ...inputStyle, paddingRight: '42px' }}
                        placeholder="0.00"
                      />
                      <span style={{
                        position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                        fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', pointerEvents: 'none',
                      }}>
                        {zestawMap[Number(item.zestaw_id)]?.price_currency ?? 'USD'}
                      </span>
                    </div>
                  </div>
                  {formItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      style={{ padding: '6px 10px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: '13px', marginBottom: '1px' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addItem}
                style={{ alignSelf: 'flex-start', marginTop: '4px', padding: '5px 12px', borderRadius: '8px', fontSize: '13px', backgroundColor: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                + Dodaj pozycję
              </button>
            </div>
          </div>

          <FormSection title="Płatność" />
          <FormField label="Cena — suma pozycji">
            <input
              {...register('price')}
              type="number" step="0.01" readOnly
              style={{ ...inputStyle, backgroundColor: 'rgba(224,120,24,0.07)', color: 'var(--text)', cursor: 'default' }}
            />
          </FormField>
          <FormField label="Shipping">
            <input {...register('shipping_cost')} type="number" step="0.01" style={inputStyle} placeholder="0.00" />
          </FormField>
          <FormField label="Total — cena + shipping">
            <input
              {...register('total')}
              type="number" step="0.01" readOnly
              style={{ ...inputStyle, backgroundColor: 'rgba(224,120,24,0.07)', color: 'var(--text)', cursor: 'default' }}
            />
          </FormField>
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
