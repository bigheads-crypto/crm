'use client'

import { useRef, useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react'
import { Pagination } from './Pagination'

export interface Column<T> {
  key: keyof T | string
  header: string
  render?: (value: unknown, row: T) => React.ReactNode
  width?: string
  sortable?: boolean
  filterable?: boolean
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  totalCount: number
  page: number
  onPageChange: (page: number) => void
  pageSize?: number
  filterTabs?: { label: string; value: string }[]
  activeFilter?: string
  onFilterChange?: (val: string) => void
  onAdd?: () => void
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
  loading?: boolean
  canEdit?: boolean
  canDelete?: boolean
  addLabel?: string
  keyExtractor?: (row: T) => string | number
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void
  columnFilters?: Record<string, string>
  onColumnFiltersChange?: (filters: Record<string, string>) => void
  // legacy — kept for backward compat but not rendered
  searchValue?: string
  onSearchChange?: (val: string) => void
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  totalCount,
  page,
  onPageChange,
  pageSize = 25,
  filterTabs,
  activeFilter = 'all',
  onFilterChange,
  onAdd,
  onEdit,
  onDelete,
  loading = false,
  canEdit = true,
  canDelete = false,
  addLabel = 'Dodaj',
  keyExtractor,
  sortKey,
  sortDir,
  onSortChange,
  columnFilters: externalFilters,
  onColumnFiltersChange,
}: DataTableProps<T>) {
  const totalPages = Math.ceil(totalCount / pageSize)
  const showActions = (canEdit && onEdit) || (canDelete && onDelete)

  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const [localFilters, setLocalFilters] = useState<Record<string, string>>(externalFilters ?? {})
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null)
  const thRefs = useRef<Record<string, HTMLTableCellElement | null>>({})

  // Debounce filter changes → emit to parent after 400ms
  useEffect(() => {
    if (!onColumnFiltersChange) return
    const timer = setTimeout(() => onColumnFiltersChange(localFilters), 400)
    return () => clearTimeout(timer)
  }, [localFilters]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilterChange(key: string, value: string) {
    setLocalFilters(prev => ({ ...prev, [key]: value }))
  }

  function clearFilter(key: string) {
    setLocalFilters(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  function clearAllFilters() {
    setLocalFilters({})
  }

  const activeFilterCount = Object.values(localFilters).filter(Boolean).length

  function handleSort(key: string) {
    if (!onSortChange) return
    onSortChange(key, sortKey === key && sortDir === 'asc' ? 'desc' : 'asc')
  }

  function startResize(e: React.MouseEvent, colKey: string) {
    e.preventDefault()
    const th = thRefs.current[colKey]
    if (!th) return
    const startWidth = th.offsetWidth
    resizingRef.current = { key: colKey, startX: e.clientX, startWidth }

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return
      const newWidth = Math.max(60, resizingRef.current.startWidth + ev.clientX - resizingRef.current.startX)
      setColWidths(prev => ({ ...prev, [resizingRef.current!.key]: newWidth }))
    }
    const onUp = () => {
      resizingRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function SortIcon({ colKey }: { colKey: string }) {
    if (sortKey !== colKey) return <ChevronsUpDown size={11} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
    if (sortDir === 'asc') return <ChevronUp size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
    return <ChevronDown size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <X size={11} /> Wyczyść filtry ({activeFilterCount})
            </button>
          )}
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
            style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
          >
            <Plus size={14} /> {addLabel}
          </button>
        )}
      </div>

      {/* Filter tabs */}
      {filterTabs && filterTabs.length > 0 && (
        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--surface)' }}>
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onFilterChange?.(tab.value)}
              className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: activeFilter === tab.value ? 'var(--accent)' : 'transparent',
                color: activeFilter === tab.value ? '#ffffff' : 'var(--text-muted)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
          <colgroup>
            {columns.map(col => (
              <col
                key={String(col.key)}
                style={{ width: colWidths[String(col.key)] ? `${colWidths[String(col.key)]}px` : col.width ?? undefined }}
              />
            ))}
            {showActions && <col style={{ width: '80px' }} />}
          </colgroup>

          <thead>
            {/* Sort row */}
            <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              {columns.map((col) => {
                const colKey = String(col.key)
                const isSortable = col.sortable !== false && !!onSortChange
                return (
                  <th
                    key={colKey}
                    ref={el => { thRefs.current[colKey] = el }}
                    className="px-4 py-3 text-left font-medium"
                    style={{
                      color: sortKey === colKey ? 'var(--accent)' : 'var(--text-muted)',
                      position: 'relative',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
                    }}
                  >
                    {isSortable ? (
                      <button onClick={() => handleSort(colKey)} className="flex items-center gap-1">
                        {col.header} <SortIcon colKey={colKey} />
                      </button>
                    ) : (
                      col.header
                    )}
                    {/* Resize handle */}
                    <div
                      onMouseDown={e => startResize(e, colKey)}
                      style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0, width: '5px',
                        cursor: 'col-resize', zIndex: 1,
                        borderRight: '2px solid transparent',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderRightColor = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.borderRightColor = 'transparent')}
                    />
                  </th>
                )
              })}
              {showActions && (
                <th className="px-4 py-3 text-right font-medium" style={{ color: 'var(--text-muted)' }}>Akcje</th>
              )}
            </tr>

            {/* Filter row */}
            {onColumnFiltersChange && (
              <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>
                {columns.map((col) => {
                  const colKey = String(col.key)
                  const isFilterable = col.filterable !== false
                  const hasValue = !!localFilters[colKey]
                  return (
                    <td key={colKey} style={{ padding: '4px 6px' }}>
                      {isFilterable ? (
                        <div style={{ position: 'relative' }}>
                          <input
                            value={localFilters[colKey] || ''}
                            onChange={e => handleFilterChange(colKey, e.target.value)}
                            placeholder="Filtruj..."
                            style={{
                              width: '100%',
                              fontSize: '11px',
                              padding: hasValue ? '3px 22px 3px 6px' : '3px 6px',
                              borderRadius: '4px',
                              border: hasValue ? '1px solid var(--accent)' : '1px solid var(--border)',
                              backgroundColor: hasValue ? 'rgba(79,110,247,0.08)' : 'var(--bg)',
                              color: 'var(--text)',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                          {hasValue && (
                            <button
                              onClick={() => clearFilter(colKey)}
                              style={{
                                position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)',
                                color: 'var(--text-muted)', lineHeight: 1,
                              }}
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      ) : null}
                    </td>
                  )
                })}
                {showActions && <td />}
              </tr>
            )}
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3">
                      <div className="h-4 rounded animate-pulse" style={{ backgroundColor: 'var(--border)', width: '70%' }} />
                    </td>
                  ))}
                  {showActions && (
                    <td className="px-4 py-3">
                      <div className="h-4 rounded animate-pulse ml-auto" style={{ backgroundColor: 'var(--border)', width: '40px' }} />
                    </td>
                  )}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (showActions ? 1 : 0)}
                  className="px-4 py-12 text-center text-sm"
                  style={{ color: 'var(--text-dim)' }}
                >
                  Brak wyników
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => {
                const key = keyExtractor ? keyExtractor(row) : (row.id as string | number) ?? rowIdx
                return (
                  <tr
                    key={key}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}
                  >
                    {columns.map((col) => {
                      const value = row[col.key as keyof T]
                      return (
                        <td
                          key={String(col.key)}
                          className="px-4 py-3"
                          style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {col.render
                            ? col.render(value, row)
                            : value == null
                            ? <span style={{ color: 'var(--text-dim)' }}>—</span>
                            : String(value)}
                        </td>
                      )
                    })}
                    {showActions && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && onEdit && (
                            <button
                              onClick={() => onEdit(row)}
                              className="flex h-7 w-7 items-center justify-center rounded-md"
                              style={{ color: 'var(--text-muted)' }}
                              title="Edytuj"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {canDelete && onDelete && (
                            <button
                              onClick={() => onDelete(row)}
                              className="flex h-7 w-7 items-center justify-center rounded-md"
                              style={{ color: 'var(--danger)' }}
                              title="Usuń"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
          {totalCount > 0
            ? `Wyświetlanie ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalCount)} z ${totalCount}`
            : 'Brak wyników'}
        </p>
        <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
      </div>
    </div>
  )
}
