'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Pagination } from '@/components/shared/Pagination'
import { Modal } from '@/components/shared/Modal'
import type { ActivityChange } from '@/lib/activity-log'

interface ActivityLog {
  id: number
  user_id: string | null
  user_email: string | null
  action: string
  tab_key: string
  record_id: string | null
  details: string | null
  created_at: string
}

interface ParsedDetails {
  summary: string
  changes: ActivityChange[]
}

function parseDetails(details: string | null): ParsedDetails | null {
  if (!details) return null
  try {
    const parsed = JSON.parse(details)
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.changes)) {
      return parsed as ParsedDetails
    }
    return null
  } catch {
    return null
  }
}

const PAGE_SIZE = 50

const ACTION_LABELS: Record<string, string> = {
  create: 'Dodanie',
  update: 'Edycja',
  delete: 'Usunięcie',
}

const ACTION_COLORS: Record<string, string> = {
  create: '#10a872',
  update: '#e07818',
  delete: '#e8384f',
}

const TAB_LABELS: Record<string, string> = {
  candidates: 'Kandydaci',
  'sales-deals': 'Transakcje',
  sales: 'Zamówienia',
  'sales-quality': 'Jakość sprzedaży',
  machines: 'Maszyny',
  'support-cases': 'Sprawy supportu',
}

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? '#8a7f72'
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      {ACTION_LABELS[action] ?? action}
    </span>
  )
}

function ChangesModal({ log, onClose }: { log: ActivityLog; onClose: () => void }) {
  const parsed = parseDetails(log.details)

  return (
    <Modal open onClose={onClose} title="Szczegóły zmiany" size="md">
      <div className="flex flex-col gap-4">
        {/* Nagłówek */}
        <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <ActionBadge action={log.action} />
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {parsed?.summary ?? log.details ?? '—'}
          </span>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <div><span style={{ color: 'var(--text-dim)' }}>Użytkownik:</span> {log.user_email ?? '—'}</div>
          <div><span style={{ color: 'var(--text-dim)' }}>Moduł:</span> {TAB_LABELS[log.tab_key] ?? log.tab_key}</div>
          <div><span style={{ color: 'var(--text-dim)' }}>ID rekordu:</span> {log.record_id ?? '—'}</div>
          <div><span style={{ color: 'var(--text-dim)' }}>Kiedy:</span> {new Date(log.created_at).toLocaleString('pl-PL')}</div>
        </div>

        {/* Diff zmian */}
        {parsed?.changes?.length ? (
          <div>
            <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
              Zmienione pola ({parsed.changes.length})
            </p>
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)', width: '30%' }}>Pole</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: '#e8384f', width: '35%' }}>Poprzednia wartość</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: '#10a872', width: '35%' }}>Nowa wartość</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.changes.map((change, i) => (
                    <tr
                      key={change.field}
                      style={{
                        backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                        borderBottom: i < parsed.changes.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <td className="px-3 py-2 font-medium" style={{ color: 'var(--text)' }}>
                        {change.field}
                      </td>
                      <td className="px-3 py-2 max-w-0 truncate" style={{ color: '#e8384f' }}>
                        {String(change.from ?? '—')}
                      </td>
                      <td className="px-3 py-2 max-w-0 truncate" style={{ color: '#10a872' }}>
                        {String(change.to ?? '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Brak szczegółowych danych o zmianach dla tej operacji.
          </p>
        )}
      </div>
    </Modal>
  )
}

interface Props {
  initialData: ActivityLog[]
  initialCount: number
}

export function ActivityLogClient({ initialData, initialCount }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('activity_logs').select('*', { count: 'exact' })
    if (actionFilter !== 'all') query = query.eq('action', actionFilter)
    query = query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? [])
    setCount(total ?? 0)
    setLoading(false)
  }, [page, actionFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const filterTabs = [
    { label: 'Wszystkie', value: 'all' },
    { label: 'Dodania', value: 'create' },
    { label: 'Edycje', value: 'update' },
    { label: 'Usunięcia', value: 'delete' },
  ]

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Logi aktywności</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Historia działań użytkowników w systemie</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg w-fit" style={{ backgroundColor: 'var(--surface)' }}>
        {filterTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setActionFilter(tab.value); setPage(1) }}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              backgroundColor: actionFilter === tab.value ? 'var(--accent)' : 'transparent',
              color: actionFilter === tab.value ? '#fff' : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
              {['Użytkownik', 'Akcja', 'Moduł', 'Rekord', 'Kiedy', ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  Ładowanie...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  Brak wpisów
                </td>
              </tr>
            ) : (
              data.map((row, i) => {
                const parsed = parseDetails(row.details)
                const summary = parsed?.summary ?? row.details
                const hasChanges = (parsed?.changes?.length ?? 0) > 0

                return (
                  <tr
                    key={row.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>
                      {row.user_email ?? <span style={{ color: 'var(--text-dim)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={row.action} />
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {TAB_LABELS[row.tab_key] ?? row.tab_key}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--text)' }}>
                      {summary ?? <span style={{ color: 'var(--text-dim)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {new Date(row.created_at).toLocaleString('pl-PL')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedLog(row)}
                        className="text-xs px-2 py-1 rounded-md transition-colors"
                        style={{
                          backgroundColor: hasChanges ? 'rgba(224,120,24,0.12)' : 'var(--surface)',
                          color: hasChanges ? 'var(--accent)' : 'var(--text-dim)',
                          border: `1px solid ${hasChanges ? 'rgba(224,120,24,0.3)' : 'var(--border)'}`,
                        }}
                      >
                        {hasChanges ? `${parsed!.changes.length} zmian` : 'Szczegóły'}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={Math.ceil(count / PAGE_SIZE)}
          onPageChange={setPage}
        />
      </div>

      {selectedLog && (
        <ChangesModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </>
  )
}
