'use client'

import { useState, useEffect, useCallback } from 'react'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { createClient } from '@/lib/supabase/client'
import type { SupportLog, Role } from '@/lib/supabase/types'

const PAGE_SIZE = 25

const COLUMNS: Column<SupportLog>[] = [
  { key: 'clients_name', header: 'Klient' },
  { key: 'phone', header: 'Telefon' },
  { key: 'support_agent', header: 'Agent' },
  { key: 'category', header: 'Kategoria' },
  { key: 'detected_engine', header: 'Silnik' },
  { key: 'duration', header: 'Czas (s)' },
  { key: 'case_id', header: 'ID sprawy' },
  { key: 'created_at', header: 'Data', render: (v) => v ? new Date(String(v)).toLocaleDateString('pl-PL') : '—' },
]

interface Props { initialData: SupportLog[]; initialCount: number; role: Role }

export function SupportLogClient({ initialData, initialCount, role }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [detailRow, setDetailRow] = useState<SupportLog | null>(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Support Log').select('*', { count: 'exact' })
    if (search) query = query.or(`clients_name.ilike.%${search}%,phone.ilike.%${search}%,support_agent.ilike.%${search}%`)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? []); setCount(total ?? 0); setLoading(false)
  }, [page, search, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const columnsWithDetail: Column<SupportLog>[] = [
    ...COLUMNS,
    { key: 'id', header: 'Szczegóły', render: (_, row) => (
      <button onClick={() => setDetailRow(row)} className="text-xs underline" style={{ color: 'var(--accent)' }}>Pokaż</button>
    )}
  ]

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Log supportu</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Historia rozmów supportu (tylko odczyt)</p>
      </div>
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columnsWithDetail as unknown as Column<Record<string, unknown>>[]}
        totalCount={count} page={page} onPageChange={setPage} pageSize={PAGE_SIZE}
        searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(1) }}
        loading={loading} canEdit={false} canDelete={false}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
      />
      {/* Modal z detalami rozmowy */}
      <Modal open={!!detailRow} onClose={() => setDetailRow(null)} title={`Rozmowa — ${detailRow?.clients_name ?? detailRow?.phone}`} size="lg">
        {detailRow && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Agent', detailRow.support_agent], ['Kategoria', detailRow.category],
                ['Silnik', detailRow.detected_engine], ['Czas', detailRow.duration ? `${detailRow.duration}s` : '—'],
                ['ID sprawy', detailRow.case_id], ['Data', detailRow.created_at ? new Date(detailRow.created_at).toLocaleString('pl-PL') : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-dim)' }}>{label}</p>
                  <p style={{ color: 'var(--text)' }}>{value ?? '—'}</p>
                </div>
              ))}
            </div>
            {detailRow.problem_description && (
              <div><p className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Opis problemu</p>
                <p className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}>{detailRow.problem_description}</p></div>
            )}
            {detailRow.support_recommendation && (
              <div><p className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Rekomendacja</p>
                <p className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}>{detailRow.support_recommendation}</p></div>
            )}
            {detailRow.summary && (
              <div><p className="text-xs mb-1" style={{ color: 'var(--text-dim)' }}>Podsumowanie</p>
                <p className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}>{detailRow.summary}</p></div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
