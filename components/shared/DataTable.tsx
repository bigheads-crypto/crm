'use client'

import { Loader2, Plus, Search, Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { Pagination } from './Pagination'

export interface Column<T> {
  key: keyof T | string
  header: string
  render?: (value: unknown, row: T) => React.ReactNode
  width?: string
  sortable?: boolean
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  totalCount: number
  page: number
  onPageChange: (page: number) => void
  pageSize?: number
  searchValue?: string
  onSearchChange?: (val: string) => void
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
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  totalCount,
  page,
  onPageChange,
  pageSize = 25,
  searchValue = '',
  onSearchChange,
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
}: DataTableProps<T>) {
  const totalPages = Math.ceil(totalCount / pageSize)
  const showActions = (canEdit && onEdit) || (canDelete && onDelete)

  function handleSort(key: string) {
    if (!onSortChange) return
    if (sortKey === key) {
      onSortChange(key, sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      onSortChange(key, 'asc')
    }
  }

  function SortIcon({ colKey }: { colKey: string }) {
    if (sortKey !== colKey) return <ChevronsUpDown size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
    if (sortDir === 'asc') return <ChevronUp size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
    return <ChevronDown size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {onSearchChange && (
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Szukaj..."
              className="w-full rounded-lg py-2 pl-9 pr-3 text-sm outline-none"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          {onAdd && (
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
            >
              <Plus size={14} />
              {addLabel}
            </button>
          )}
        </div>
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
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              {columns.map((col) => {
                const isSortable = col.sortable !== false && !!onSortChange
                const colKey = String(col.key)
                return (
                  <th
                    key={colKey}
                    className="px-4 py-3 text-left font-medium"
                    style={{ color: sortKey === colKey ? 'var(--accent)' : 'var(--text-muted)', width: col.width, whiteSpace: 'nowrap' }}
                  >
                    {isSortable ? (
                      <button
                        onClick={() => handleSort(colKey)}
                        className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                      >
                        {col.header}
                        <SortIcon colKey={colKey} />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
              {showActions && (
                <th className="px-4 py-3 text-right font-medium" style={{ color: 'var(--text-muted)', width: '80px' }}>
                  Akcje
                </th>
              )}
            </tr>
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
                        <td key={String(col.key)} className="px-4 py-3" style={{ color: 'var(--text)' }}>
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
                              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              title="Edytuj"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {canDelete && onDelete && (
                            <button
                              onClick={() => onDelete(row)}
                              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
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
