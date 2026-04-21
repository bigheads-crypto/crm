'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { DataTable, Column } from '@/components/shared/DataTable'
import { Modal } from '@/components/shared/Modal'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import type { SupportLog, Role } from '@/lib/supabase/types'

const PAGE_SIZE = 25

interface Props { initialData: SupportLog[]; initialCount: number; role: Role }

export function SupportLogClient({ initialData, initialCount, role }: Props) {
  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [loading, setLoading] = useState(false)
  const [detailRow, setDetailRow] = useState<SupportLog | null>(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterOptionsMap, setFilterOptionsMap] = useState<Record<string, string[]>>({})

  const handleSort = (key: string, dir: 'asc' | 'desc') => { setSortKey(key); setSortDir(dir); setPage(1) }

  useEffect(() => {
    async function loadOptions() {
      const supabase = createClient()
      const [{ data: a }, { data: c }, { data: e }] = await Promise.all([
        supabase.from('Support Log').select('support_agent').not('support_agent', 'is', null),
        supabase.from('Support Log').select('category').not('category', 'is', null),
        supabase.from('Support Log').select('detected_engine').not('detected_engine', 'is', null),
      ])
      setFilterOptionsMap({
        support_agent: [...new Set((a ?? []).map(r => r.support_agent).filter(Boolean) as string[])].sort(),
        category: [...new Set((c ?? []).map(r => r.category).filter(Boolean) as string[])].sort(),
        detected_engine: [...new Set((e ?? []).map(r => r.detected_engine).filter(Boolean) as string[])].sort(),
      })
    }
    loadOptions()
  }, [])

  const baseColumns = useMemo<Column<SupportLog>[]>(() => [
    { key: 'clients_name', header: 'Klient' },
    { key: 'phone', header: 'Telefon' },
    { key: 'support_agent', header: 'Agent', filterOptions: filterOptionsMap.support_agent },
    { key: 'category', header: 'Kategoria', filterOptions: filterOptionsMap.category },
    { key: 'detected_engine', header: 'Silnik', filterOptions: filterOptionsMap.detected_engine },
    { key: 'duration', header: 'Czas (s)' },
    { key: 'case_id', header: 'ID sprawy' },
    { key: 'created_at', header: 'Data', render: (v) => v ? new Date(String(v)).toLocaleDateString('pl-PL') : '—' },
  ], [filterOptionsMap])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase.from('Support Log').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    const { data: rows, count: total } = await query
    setData(rows ?? []); setCount(total ?? 0); setLoading(false)
  }, [page, columnFilters, sortKey, sortDir])

  useEffect(() => { fetchData() }, [fetchData])

  const columnsWithDetail = useMemo<Column<SupportLog>[]>(() => [
    ...baseColumns,
    { key: 'id', header: 'Szczegóły', filterable: false, render: (_, row) => (
      <button onClick={() => setDetailRow(row)} className="text-xs underline" style={{ color: 'var(--accent)' }}>Pokaż</button>
    )}
  ], [baseColumns, setDetailRow])

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
        loading={loading} canEdit={false} canDelete={false}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSort}
        columnFilters={columnFilters}
        onColumnFiltersChange={(f) => { setColumnFilters(f); setPage(1) }}
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
