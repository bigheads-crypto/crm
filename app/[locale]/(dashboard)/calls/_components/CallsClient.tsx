'use client'

// Zakładka „Rozmowy" — historia rozmów telefonicznych (QUO) z tabeli `calls`.
// Widok tylko do odczytu: rozmowy tworzy/aktualizuje n8n. Filtry + sort + paginacja
// jak w pozostałych modułach.

import { useState, useEffect, useCallback } from 'react'
import { useFetchOnParamChange } from '@/lib/hooks/table-data'
import { useTranslations } from 'next-intl'
import { PhoneIncoming, PhoneOutgoing } from 'lucide-react'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { applyColumnFilters, type ColumnFilters } from '@/lib/supabase/filters'
import { CALL_STATUS_COLORS, CALL_STATUS_OPTIONS, PAGE_SIZE } from '@/lib/constants'
import type { Call } from '@/lib/supabase/types'

const DIRECTION_OPTIONS = ['incoming', 'outgoing']

function formatDuration(s: number | null): string {
  if (s == null) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`
}

interface Props {
  initialData: Call[]
  initialCount: number
}

export function CallsClient({ initialData, initialCount }: Props) {
  const t = useTranslations('calls')

  const [data, setData] = useState(initialData)
  const [count, setCount] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [sortKey, setSortKey] = useState<string>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase.from('calls').select('*', { count: 'exact' })
    query = applyColumnFilters(query, columnFilters)
    query = query.order(sortKey, { ascending: sortDir === 'asc' }).range(from, to)

    const { data: rows, count: total, error } = await query
    if (error) { setLoadError(true); setLoading(false); return }
    setLoadError(false)
    setData((rows as Call[]) ?? [])
    setCount(total ?? 0)
    setLoading(false)
  }, [page, columnFilters, sortKey, sortDir])

  useFetchOnParamChange(fetchData)

  const statusLabel = (status: string) =>
    status === 'completed'
      ? t('completed')
      : status === 'missed'
        ? t('missed')
        : status === 'ringing'
          ? t('ringing')
          : status

  const directionLabel = (dir: string) =>
    dir === 'outgoing' ? t('directionOutgoing') : t('directionIncoming')

  const columns: Column<Call>[] = [
    {
      key: 'created_at',
      header: t('colDate'),
      sortable: true,
      width: '160px',
      render: (_v, row) => (
        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          {new Date(row.created_at).toLocaleString('pl-PL')}
        </span>
      ),
    },
    {
      key: 'direction',
      header: t('colDirection'),
      filterable: true,
      filterOptions: DIRECTION_OPTIONS,
      width: '130px',
      render: (_v, row) => {
        if (!row.direction) return '—'
        const Icon = row.direction === 'outgoing' ? PhoneOutgoing : PhoneIncoming
        return (
          <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text)' }}>
            <Icon size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            {directionLabel(row.direction)}
          </span>
        )
      },
    },
    {
      key: 'phone',
      header: t('colPhone'),
      filterable: true,
      render: (_v, row) => (
        <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{row.phone || '—'}</span>
      ),
    },
    {
      key: 'client_name',
      header: t('colClient'),
      filterable: true,
      render: (_v, row) =>
        row.is_known_client && row.client_name ? (
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>{row.client_name}</span>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>{t('unknownNumber')}</span>
        ),
    },
    {
      key: 'status',
      header: t('colStatus'),
      filterable: true,
      filterOptions: CALL_STATUS_OPTIONS,
      width: '130px',
      render: (_v, row) => {
        if (!row.status) return '—'
        const color = CALL_STATUS_COLORS[row.status] ?? '#6b7280'
        return (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: `${color}1a`, color }}
          >
            {statusLabel(row.status)}
          </span>
        )
      },
    },
    {
      key: 'duration_seconds',
      header: t('colDuration'),
      filterable: false,
      width: '90px',
      render: (_v, row) => (
        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          {formatDuration(row.duration_seconds)}
        </span>
      ),
    },
    {
      key: 'notes',
      header: t('notesLabel'),
      filterable: true,
      render: (_v, row) => row.notes || '—',
    },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: '1400px' }}>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

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
      />
    </div>
  )
}
