'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import { logActivity } from '@/lib/activity-log'
import type { SupportBacklog, SupportBacklogLog, Role } from '@/lib/supabase/types'
import { PlusCircle, ChevronDown, ChevronUp, Link2, Search, Plus, RefreshCw } from 'lucide-react'

const caseSchema = z.object({
  phone: z.string().optional(),
  invoice_number: z.string().optional(),
  client_name: z.string().optional(),
  status: z.string().default('open'),
  agent: z.string().optional(),
})

const logSchema = z.object({
  problem: z.string().min(1, 'Wymagane'),
  proposed_solution: z.string().optional(),
  outcome: z.string().optional(),
  notes: z.string().optional(),
})

type CaseFormData = z.infer<typeof caseSchema>
type LogFormData = z.infer<typeof logSchema>

const STATUS_OPTIONS = ['open', 'pending', 'in_progress', 'resolved', 'closed']
const PAGE_SIZE = 25

const STATUS_COLORS: Record<string, string> = {
  open: '#ef4444',
  pending: '#f59e0b',
  in_progress: '#e07818',
  resolved: '#22c55e',
  closed: '#6b7280',
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#6b7280'
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
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

const inputStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '14px',
  width: '100%',
  outline: 'none',
}

const taStyle = { ...inputStyle, minHeight: '72px', resize: 'vertical' as const }

interface Props {
  initialData: SupportBacklog[]
  initialCount: number
  role: Role
}

interface LinkedClient {
  client_name: string | null
  salesman: string | null
}

export function SupportBacklogClient({ initialData, initialCount, role }: Props) {
  // Lista
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [sortKey, setSortKey] = useState('updated_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterOptionsMap, setFilterOptionsMap] = useState<Record<string, string[]>>({})

  // Zalogowany użytkownik
  const [currentUserName, setCurrentUserName] = useState<string>('')

  // Modal: nowa sprawa
  const [addCaseOpen, setAddCaseOpen] = useState(false)
  const [caseFormError, setCaseFormError] = useState<string | null>(null)

  // Modal: szczegóły sprawy
  const [selectedCase, setSelectedCase] = useState<SupportBacklog | null>(null)
  const [logs, setLogs] = useState<SupportBacklogLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [linkedClient, setLinkedClient] = useState<LinkedClient | null>(null)

  // Edycja sprawy w detalu
  const [editingCase, setEditingCase] = useState(false)
  const [caseUpdateError, setCaseUpdateError] = useState<string | null>(null)

  // Formularz nowego wpisu w detalu
  const [addLogOpen, setAddLogOpen] = useState(false)
  const [logFormError, setLogFormError] = useState<string | null>(null)

  // Szybka aktualizacja
  const [quickUpdateOpen, setQuickUpdateOpen] = useState(false)
  const [quickSearch, setQuickSearch] = useState('')
  const [quickResults, setQuickResults] = useState<SupportBacklog[]>([])
  const [quickLoading, setQuickLoading] = useState(false)
  const [quickSearched, setQuickSearched] = useState(false)

  // Usuwanie
  const [deleteRow, setDeleteRow] = useState<SupportBacklog | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const caseForm = useForm<CaseFormData>({ resolver: zodResolver(caseSchema) })
  const caseEditForm = useForm<CaseFormData>({ resolver: zodResolver(caseSchema) })
  const logForm = useForm<LogFormData>({ resolver: zodResolver(logSchema) })

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortKey(key); setSortDir(dir); setPage(1)
  }

  // Pobierz zalogowanego użytkownika
  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      setCurrentUserName(profile?.full_name ?? user.email ?? '')
    }
    loadUser()
  }, [])

  // Ładowanie dynamicznych filterOptions
  useEffect(() => {
    async function loadOptions() {
      const supabase = createClient()
      const { data: agents } = await supabase
        .from('Support Backlog')
        .select('agent')
        .not('agent', 'is', null)
      setFilterOptionsMap({
        agent: [...new Set((agents ?? []).map(r => r.agent).filter(Boolean) as string[])].sort(),
      })
    }
    loadOptions()
  }, [])

  const columns = useMemo<Column<SupportBacklog>[]>(() => [
    { key: 'client_name', header: 'Klient', sortable: true, filterable: true },
    { key: 'phone', header: 'Telefon', sortable: true, filterable: true },
    { key: 'invoice_number', header: 'Nr faktury', sortable: true, filterable: true },
    {
      key: 'status', header: 'Status', sortable: true,
      render: (v) => v ? <StatusBadge status={String(v)} /> : <StatusBadge status="open" />,
      filterOptions: STATUS_OPTIONS,
    },
    { key: 'agent', header: 'Technik', sortable: true, filterOptions: filterOptionsMap.agent },
    {
      key: 'updated_at', header: 'Ostatnia aktywność', sortable: true,
      render: (v) => v ? new Date(String(v)).toLocaleDateString('pl-PL') : '—',
    },
    {
      key: 'created_at', header: 'Utworzono', sortable: true,
      render: (v) => v ? new Date(String(v)).toLocaleDateString('pl-PL') : '—',
    },
  ], [filterOptionsMap])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Support Backlog').select('*', { count: 'exact' })
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? []); setCount(total ?? 0); setLoading(false)
  }, [page, columnFilters, statusFilter, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  // Ładowanie logów i powiązanego klienta po wyborze sprawy
  useEffect(() => {
    if (!selectedCase) { setLogs([]); setLinkedClient(null); return }
    setLogsLoading(true)
    setLinkedClient(null)
    const supabase = createClient()

    async function load() {
      const [{ data: logRows }, { data: linkedRows }] = await Promise.all([
        supabase
          .from('Support Backlog Log')
          .select('*')
          .eq('backlog_id', selectedCase!.id)
          .order('created_at', { ascending: false }),
        selectedCase!.phone
          ? supabase
              .from('Sales Deals')
              .select('client_name, salesman')
              .eq('phone', selectedCase!.phone)
              .limit(1)
          : Promise.resolve({ data: null }),
      ])
      setLogs(logRows ?? [])
      const linked = Array.isArray(linkedRows) ? linkedRows[0] : null
      setLinkedClient(linked ?? null)
      setLogsLoading(false)
    }
    load()
  }, [selectedCase])

  const openDetail = (row: SupportBacklog, openLog = false) => {
    setSelectedCase(row)
    setEditingCase(false)
    setAddLogOpen(openLog)
    setCaseUpdateError(null)
    setLogFormError(null)
    logForm.reset({})
    caseEditForm.reset({
      phone: row.phone ?? '',
      invoice_number: row.invoice_number ?? '',
      client_name: row.client_name ?? '',
      status: row.status ?? 'open',
      agent: row.agent ?? '',
    })
  }

  // Wyszukiwanie w trybie szybkiej aktualizacji
  const handleQuickSearch = async () => {
    const q = quickSearch.trim()
    if (!q) return
    setQuickLoading(true)
    setQuickSearched(true)
    const supabase = createClient()
    const { data: results } = await supabase
      .from('Support Backlog')
      .select('*')
      .or(`phone.ilike.%${q}%,invoice_number.ilike.%${q}%`)
      .order('updated_at', { ascending: false })
      .limit(20)
    setQuickResults(results ?? [])
    setQuickLoading(false)
  }

  const openFromQuickUpdate = (row: SupportBacklog) => {
    setQuickUpdateOpen(false)
    setQuickSearch('')
    setQuickResults([])
    setQuickSearched(false)
    openDetail(row, true)
  }

  // Tworzenie nowej sprawy — technik ustawiany automatycznie
  const onCreateCase = async (values: CaseFormData) => {
    const supabase = createClient()
    const { data: created, error } = await supabase
      .from('Support Backlog')
      .insert({ ...values, agent: currentUserName, status: values.status || 'open' })
      .select()
      .single()
    if (error || !created) { setCaseFormError('Błąd zapisu. Spróbuj ponownie.'); return }
    void logActivity(supabase, 'create', 'support-backlog', created.id, `Backlog: ${values.client_name ?? values.phone ?? '—'}`)
    setAddCaseOpen(false)
    caseForm.reset({})
    fetchData()
  }

  // Aktualizacja sprawy z poziomu detalu
  const onUpdateCase = async (values: CaseFormData) => {
    if (!selectedCase) return
    const supabase = createClient()
    const { error } = await supabase
      .from('Support Backlog')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', selectedCase.id)
    if (error) { setCaseUpdateError('Błąd zapisu.'); return }
    void logActivity(supabase, 'update', 'support-backlog', selectedCase.id, `Backlog: ${values.client_name ?? values.phone ?? '—'}`)
    setSelectedCase(prev => prev ? { ...prev, ...values } : prev)
    setEditingCase(false)
    fetchData()
  }

  // Dodanie wpisu do historii — technik ustawiany automatycznie
  const onAddLog = async (values: LogFormData) => {
    if (!selectedCase) return
    const supabase = createClient()
    const { error } = await supabase
      .from('Support Backlog Log')
      .insert({ ...values, agent: currentUserName, backlog_id: selectedCase.id })
    if (error) { setLogFormError('Błąd zapisu. Spróbuj ponownie.'); return }
    await supabase
      .from('Support Backlog')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', selectedCase.id)
    void logActivity(supabase, 'create', 'support-backlog', selectedCase.id, `Wpis: ${values.problem.slice(0, 60)}`)
    logForm.reset({})
    setAddLogOpen(false)
    const { data: logRows } = await supabase
      .from('Support Backlog Log')
      .select('*')
      .eq('backlog_id', selectedCase.id)
      .order('created_at', { ascending: false })
    setLogs(logRows ?? [])
    fetchData()
  }

  // Usunięcie sprawy
  const onDelete = async () => {
    if (!deleteRow) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('Support Backlog').delete().eq('id', deleteRow.id)
    if (error) { setDeleteLoading(false); alert('Błąd usuwania.'); return }
    void logActivity(supabase, 'delete', 'support-backlog', deleteRow.id, `Backlog: ${deleteRow.client_name ?? deleteRow.phone ?? '—'}`)
    setDeleteRow(null); setDeleteLoading(false); fetchData()
  }

  const filterTabs = [
    { label: 'Wszystkie', value: 'all' },
    ...STATUS_OPTIONS.map(s => ({ label: s, value: s })),
  ]

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Support Backlog</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Historia interakcji i śledzenie rozwiązań
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => { setQuickUpdateOpen(true); setQuickSearch(''); setQuickResults([]); setQuickSearched(false) }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <RefreshCw size={14} /> Aktualizacja
          </button>
          <button
            onClick={() => { caseForm.reset({}); setCaseFormError(null); setAddCaseOpen(true) }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={14} /> Nowa sprawa
          </button>
        </div>
      </div>

      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        totalCount={count}
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        filterTabs={filterTabs}
        activeFilter={statusFilter}
        onFilterChange={(v) => { setStatusFilter(v); setPage(1) }}
        onEdit={(row) => openDetail(row as unknown as SupportBacklog)}
        onDelete={(row) => setDeleteRow(row as unknown as SupportBacklog)}
        loading={loading}
        canEdit
        canDelete={role === 'admin'}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
      />

      {/* Modal: Szybka aktualizacja */}
      <Modal
        open={quickUpdateOpen}
        onClose={() => setQuickUpdateOpen(false)}
        title="Aktualizacja sprawy"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Wpisz numer telefonu lub numer faktury aby znaleźć sprawę.
          </p>
          <div className="flex gap-2">
            <input
              value={quickSearch}
              onChange={e => setQuickSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickSearch()}
              placeholder="np. +48 600... lub FV/2024/..."
              style={{ ...inputStyle, flex: 1 }}
              autoFocus
            />
            <button
              onClick={handleQuickSearch}
              disabled={quickLoading || !quickSearch.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: '#fff', flexShrink: 0 }}
            >
              <Search size={14} />
              {quickLoading ? 'Szukam...' : 'Szukaj'}
            </button>
          </div>

          {quickSearched && !quickLoading && (
            quickResults.length === 0 ? (
              <div
                className="text-sm py-4 text-center rounded-lg"
                style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                Nie znaleziono żadnej sprawy dla podanego numeru.
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Znalezione sprawy ({quickResults.length}) — kliknij aby dodać aktualizację:
                </p>
                <div className="space-y-1.5" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {quickResults.map(row => (
                    <button
                      key={row.id}
                      onClick={() => openFromQuickUpdate(row)}
                      className="w-full text-left rounded-lg px-3 py-3 transition-colors"
                      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--accent)'
                        e.currentTarget.style.backgroundColor = 'rgba(224,120,24,0.06)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border)'
                        e.currentTarget.style.backgroundColor = 'var(--surface)'
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                            {row.client_name ?? '—'}
                          </span>
                          <StatusBadge status={row.status} />
                        </div>
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-dim)' }}>
                          #{row.id}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-1">
                        {row.phone && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            📞 {row.phone}
                          </span>
                        )}
                        {row.invoice_number && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            🧾 {row.invoice_number}
                          </span>
                        )}
                        {row.agent && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            👤 {row.agent}
                          </span>
                        )}
                        <span className="text-xs ml-auto" style={{ color: 'var(--text-dim)' }}>
                          {new Date(row.updated_at).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </Modal>

      {/* Modal: Nowa sprawa */}
      <Modal open={addCaseOpen} onClose={() => setAddCaseOpen(false)} title="Nowa sprawa" size="lg">
        <form onSubmit={caseForm.handleSubmit(onCreateCase)} className="grid grid-cols-2 gap-3">
          <FormField label="Telefon" error={caseForm.formState.errors.phone?.message}>
            <input {...caseForm.register('phone')} style={inputStyle} placeholder="+48..." />
          </FormField>
          <FormField label="Nr faktury" error={caseForm.formState.errors.invoice_number?.message}>
            <input {...caseForm.register('invoice_number')} style={inputStyle} />
          </FormField>
          <FormField label="Klient">
            <input {...caseForm.register('client_name')} style={inputStyle} />
          </FormField>
          <FormField label="Status">
            <select {...caseForm.register('status')} style={inputStyle}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          {/* Technik — tylko info, ustawiany automatycznie */}
          <div className="col-span-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Technik:</span>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{currentUserName || '—'}</span>
          </div>
          {caseFormError && (
            <p className="col-span-2 text-sm" style={{ color: 'var(--danger)' }}>{caseFormError}</p>
          )}
          <div className="col-span-2 flex justify-end gap-2 mt-1">
            <button type="button" onClick={() => setAddCaseOpen(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>
              Anuluj
            </button>
            <button type="submit" disabled={caseForm.formState.isSubmitting} className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
              {caseForm.formState.isSubmitting ? 'Zapisywanie...' : 'Utwórz sprawę'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Szczegóły sprawy */}
      <Modal
        open={!!selectedCase}
        onClose={() => { setSelectedCase(null); setAddLogOpen(false) }}
        title={`Sprawa #${selectedCase?.id ?? ''} — ${selectedCase?.client_name ?? selectedCase?.phone ?? 'brak danych'}`}
        size="xl"
      >
        {selectedCase && (
          <div className="space-y-5" style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px' }}>

            {/* Powiązany klient z Sales */}
            {linkedClient && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                style={{ backgroundColor: 'rgba(224,120,24,0.08)', border: '1px solid rgba(224,120,24,0.25)', color: 'var(--accent)' }}
              >
                <Link2 size={14} />
                <span>
                  Powiązany klient w Transakcjach: <strong>{linkedClient.client_name ?? '—'}</strong>
                  {linkedClient.salesman && <> · Handlowiec: <strong>{linkedClient.salesman}</strong></>}
                </span>
              </div>
            )}

            {/* Info / edycja sprawy */}
            <div style={{ backgroundColor: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)', padding: '16px' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Dane sprawy
                </span>
                <button
                  onClick={() => setEditingCase(v => !v)}
                  className="text-xs px-2 py-1 rounded-md"
                  style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                >
                  {editingCase ? 'Anuluj edycję' : 'Edytuj'}
                </button>
              </div>

              {editingCase ? (
                <form onSubmit={caseEditForm.handleSubmit(onUpdateCase)} className="grid grid-cols-2 gap-3">
                  <FormField label="Telefon"><input {...caseEditForm.register('phone')} style={inputStyle} /></FormField>
                  <FormField label="Nr faktury"><input {...caseEditForm.register('invoice_number')} style={inputStyle} /></FormField>
                  <FormField label="Klient"><input {...caseEditForm.register('client_name')} style={inputStyle} /></FormField>
                  <FormField label="Technik"><input {...caseEditForm.register('agent')} style={inputStyle} /></FormField>
                  <FormField label="Status">
                    <select {...caseEditForm.register('status')} style={inputStyle}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </FormField>
                  {caseUpdateError && <p className="col-span-2 text-xs" style={{ color: 'var(--danger)' }}>{caseUpdateError}</p>}
                  <div className="col-span-2 flex justify-end">
                    <button type="submit" disabled={caseEditForm.formState.isSubmitting} className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                      {caseEditForm.formState.isSubmitting ? 'Zapisywanie...' : 'Zapisz zmiany'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <InfoPill label="Telefon" value={selectedCase.phone} />
                  <InfoPill label="Nr faktury" value={selectedCase.invoice_number} />
                  <InfoPill label="Klient" value={selectedCase.client_name} />
                  <InfoPill label="Technik" value={selectedCase.agent} />
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', minWidth: '80px' }}>Status</span>
                    <StatusBadge status={selectedCase.status} />
                  </div>
                  <InfoPill
                    label="Ostatnia aktywność"
                    value={new Date(selectedCase.updated_at).toLocaleDateString('pl-PL')}
                  />
                </div>
              )}
            </div>

            {/* Formularz nowego wpisu */}
            <div>
              <button
                onClick={() => { setAddLogOpen(v => !v); setLogFormError(null); logForm.reset({}) }}
                className="flex items-center gap-2 text-sm font-medium w-full justify-center rounded-lg py-2 transition-colors"
                style={{
                  backgroundColor: addLogOpen ? 'rgba(224,120,24,0.1)' : 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: addLogOpen ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <PlusCircle size={15} />
                Dodaj wpis / follow-up
                {addLogOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {addLogOpen && (
                <form onSubmit={logForm.handleSubmit(onAddLog)} className="grid grid-cols-1 gap-3 mt-4">
                  {/* Technik — tylko info */}
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                    style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Technik:</span>
                    <span style={{ color: 'var(--text)', fontWeight: 500 }}>{currentUserName || '—'}</span>
                  </div>
                  <FormField label="Czy poprzednia propozycja pomogła? (opis)">
                    <textarea {...logForm.register('outcome')} style={taStyle} placeholder="np. Klient potwierdził, że rozwiązanie zadziałało. / Nie pomogło, błąd nadal występuje." />
                  </FormField>
                  <FormField label="Aktualny problem *" error={logForm.formState.errors.problem?.message}>
                    <textarea {...logForm.register('problem')} style={taStyle} placeholder="Opisz problem zgłoszony przez klienta..." />
                  </FormField>
                  <FormField label="Zaproponowane rozwiązanie">
                    <textarea {...logForm.register('proposed_solution')} style={taStyle} placeholder="Co zaproponowałeś klientowi?" />
                  </FormField>
                  <FormField label="Notatki">
                    <textarea {...logForm.register('notes')} style={{ ...taStyle, minHeight: '52px' }} placeholder="Dodatkowe uwagi..." />
                  </FormField>
                  {logFormError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{logFormError}</p>}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setAddLogOpen(false)} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>
                      Anuluj
                    </button>
                    <button type="submit" disabled={logForm.formState.isSubmitting} className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                      {logForm.formState.isSubmitting ? 'Zapisywanie...' : 'Zapisz wpis'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Historia interakcji */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Historia interakcji
                </span>
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  {logs.length} {logs.length === 1 ? 'wpis' : logs.length < 5 ? 'wpisy' : 'wpisów'}
                </span>
              </div>

              {logsLoading ? (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>Ładowanie...</p>
              ) : logs.length === 0 ? (
                <div
                  className="text-sm py-6 text-center rounded-lg"
                  style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  Brak wpisów. Dodaj pierwszy wpis powyżej.
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log, idx) => (
                    <LogEntry key={log.id} log={log} index={idx + 1} total={logs.length} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        onConfirm={onDelete}
        loading={deleteLoading}
        title="Usuń sprawę"
        description={`Usuń sprawę klienta "${deleteRow?.client_name ?? deleteRow?.phone}"? Usunięcie sprawy usuwa również całą historię wpisów.`}
      />
    </>
  )
}

function InfoPill({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: 'var(--text-muted)', fontSize: '12px', minWidth: '80px' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontSize: '13px' }}>{value ?? '—'}</span>
    </div>
  )
}

function LogEntry({ log, index }: { log: SupportBacklogLog; index: number; total: number }) {
  const isLast = index === 1
  const date = new Date(log.created_at).toLocaleDateString('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        backgroundColor: isLast ? 'rgba(224,120,24,0.05)' : 'var(--surface)',
        border: isLast ? '1px solid rgba(224,120,24,0.2)' : '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: isLast ? 'var(--accent)' : 'var(--surface-2)', color: isLast ? '#fff' : 'var(--text-muted)' }}
          >
            {index}
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {log.agent ?? 'Brak technika'}
          </span>
          {isLast && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(224,120,24,0.15)', color: 'var(--accent)' }}>
              najnowszy
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{date}</span>
      </div>

      {log.outcome && (
        <LogSection icon="✓" label="Wynik poprzedniej propozycji" value={log.outcome} color="var(--success)" />
      )}
      {log.problem && (
        <LogSection icon="!" label="Problem" value={log.problem} color="var(--danger)" />
      )}
      {log.proposed_solution && (
        <LogSection icon="→" label="Zaproponowane rozwiązanie" value={log.proposed_solution} color="var(--accent)" />
      )}
      {log.notes && (
        <LogSection icon="↳" label="Notatki" value={log.notes} color="var(--text-muted)" />
      )}
    </div>
  )
}

function LogSection({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs font-bold mt-0.5 flex-shrink-0 w-4 text-center" style={{ color }}>{icon}</span>
      <div className="flex-1">
        <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{value}</p>
      </div>
    </div>
  )
}
