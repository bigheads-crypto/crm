'use client'

import { useState, useEffect, useCallback } from 'react'
import { DataTable, Column } from '@/components/shared/DataTable'
import { createClient } from '@/lib/supabase/client'
import type { SalesTextLog, Role } from '@/lib/supabase/types'

const PAGE_SIZE = 25

const COLUMNS: Column<SalesTextLog>[] = [
  { key: 'phone', header: 'Telefon' },
  { key: 'direction', header: 'Kierunek', render: (v) => v ? <DirectionBadge dir={String(v)} /> : '—' },
  { key: 'category', header: 'Kategoria' },
  { key: 'summary', header: 'Podsumowanie', width: '30%' },
  { key: 'deal_id', header: 'ID transakcji' },
  { key: 'created_at', header: 'Data', render: (v) => v ? new Date(String(v)).toLocaleDateString('pl-PL') : '—' },
]

function DirectionBadge({ dir }: { dir: string }) {
  const isIn = dir === 'inbound' || dir === 'in'
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: isIn ? 'rgba(34,197,94,0.15)' : 'rgba(79,110,247,0.15)', color: isIn ? '#22c55e' : '#4f6ef7' }}>
      {isIn ? '↓ IN' : '↑ OUT'}
    </span>
  )
}

interface Props { initialData: SalesTextLog[]; initialCount: number; role: Role }

export function SalesTextLogClient({ initialData, initialCount, role }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Sales Text Log').select('*', { count: 'exact' })
    if (filter !== 'all') query = query.eq('direction', filter)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? []); setCount(total ?? 0); setLoading(false)
  }, [page, filter, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  // Kolumna z rozwinięciem pełnej wiadomości
  const columnsWithExpand: Column<SalesTextLog>[] = [
    ...COLUMNS,
    {
      key: 'full_message', header: 'Wiadomość', render: (v, row) => (
        <button onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
          className="text-xs underline" style={{ color: 'var(--accent)' }}>
          {expandedId === row.id ? 'Zwiń' : 'Pokaż'}
        </button>
      )
    }
  ]

  const filterTabs = [
    { label: 'Wszystkie', value: 'all' },
    { label: '↓ Przychodzące', value: 'inbound' },
    { label: '↑ Wychodzące', value: 'outbound' },
  ]

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>SMS Sprzedaż</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Log wiadomości tekstowych sprzedaży</p>
      </div>
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columnsWithExpand as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        filterTabs={filterTabs} activeFilter={filter} onFilterChange={(v) => { setFilter(v); setPage(1) }}
        loading={loading} canEdit={false} canDelete={false}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
      />
      {/* Panel rozwiniętej wiadomości */}
      {expandedId && (() => {
        const msg = data.find(d => d.id === expandedId)
        return msg ? (
          <div className="mt-4 rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <p className="font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Pełna wiadomość — {msg.phone}</p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{msg.full_message ?? '(brak treści)'}</p>
          </div>
        ) : null
      })()}
    </>
  )
}
