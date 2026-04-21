'use client'

import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, Filter, ArrowUp, ArrowDown, X } from 'lucide-react'
import { Pagination } from './Pagination'
import type { ColumnFilters, ColumnFilter, FilterCondition } from '@/lib/supabase/filters'

export interface Column<T> {
  key: keyof T | string
  header: string
  render?: (value: unknown, row: T) => React.ReactNode
  width?: string
  sortable?: boolean
  filterable?: boolean
  filterOptions?: string[]
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
  columnFilters?: ColumnFilters
  onColumnFiltersChange?: (filters: ColumnFilters) => void
  // legacy — kept for backward compat
  searchValue?: string
  onSearchChange?: (val: string) => void
}

const CONDITIONS: { value: FilterCondition; label: string; needsValue: boolean }[] = [
  { value: 'contains',      label: 'Zawiera',           needsValue: true  },
  { value: 'not_contains',  label: 'Nie zawiera',       needsValue: true  },
  { value: 'equals',        label: 'Równa się',         needsValue: true  },
  { value: 'not_equals',    label: 'Nie równa się',     needsValue: true  },
  { value: 'starts_with',   label: 'Zaczyna się od',    needsValue: true  },
  { value: 'ends_with',     label: 'Kończy się na',     needsValue: true  },
  { value: 'is_empty',      label: 'Jest puste',        needsValue: false },
  { value: 'is_not_empty',  label: 'Nie jest puste',    needsValue: false },
]

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
  const activeFilterCount = Object.keys(externalFilters ?? {}).length

  // Column resize
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null)
  const thRefs = useRef<Record<string, HTMLTableCellElement | null>>({})

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const [draftFilter, setDraftFilter] = useState<ColumnFilter>({ condition: 'contains', value: '' })
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Sync draft when dropdown opens
  useEffect(() => {
    if (openDropdown) {
      const existing = (externalFilters ?? {})[openDropdown]
      const colDef = columns.find(c => String(c.key) === openDropdown)
      if (colDef?.filterOptions?.length) {
        setDraftFilter(existing ?? { condition: 'one_of', value: '', values: [] })
      } else {
        setDraftFilter(existing ?? { condition: 'contains', value: '' })
      }
    }
  }, [openDropdown]) // eslint-disable-line react-hooks/exhaustive-deps

  // Click outside to close
  useEffect(() => {
    if (!openDropdown) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openDropdown])

  function openColDropdown(colKey: string, btn: HTMLElement) {
    if (openDropdown === colKey) { setOpenDropdown(null); return }
    const rect = btn.getBoundingClientRect()
    const dropdownWidth = 272
    const left = rect.left + dropdownWidth > window.innerWidth - 12
      ? rect.right - dropdownWidth
      : rect.left
    setDropdownPos({ top: rect.bottom + 6, left })
    setOpenDropdown(colKey)
  }

  function applyDraftFilter() {
    if (!openDropdown || !onColumnFiltersChange) return
    const newFilters = { ...(externalFilters ?? {}) }
    if (draftFilter.condition === 'one_of') {
      if (draftFilter.values && draftFilter.values.length > 0) {
        newFilters[openDropdown] = { condition: 'one_of', value: '', values: draftFilter.values }
      } else {
        delete newFilters[openDropdown]
      }
    } else {
      const cond = CONDITIONS.find(c => c.value === draftFilter.condition)
      if (!cond?.needsValue || draftFilter.value.trim()) {
        newFilters[openDropdown] = { condition: draftFilter.condition, value: draftFilter.value.trim() }
      } else {
        delete newFilters[openDropdown]
      }
    }
    onColumnFiltersChange(newFilters)
    setOpenDropdown(null)
  }

  function clearColFilter(colKey: string) {
    if (!onColumnFiltersChange) return
    const newFilters = { ...(externalFilters ?? {}) }
    delete newFilters[colKey]
    onColumnFiltersChange(newFilters)
    setOpenDropdown(null)
  }

  function handleSort(key: string, dir: 'asc' | 'desc') {
    onSortChange?.(key, dir)
    setOpenDropdown(null)
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

  const openColDef = columns.find(c => String(c.key) === openDropdown)
  const openColFilterable = openColDef?.filterable !== false
  const needsValue = CONDITIONS.find(c => c.value === draftFilter.condition)?.needsValue ?? true
  const hasActiveFilter = !!(externalFilters ?? {})[openDropdown ?? '']

  const [hoveredRow, setHoveredRow] = useState<string | number | null>(null)

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={() => onColumnFiltersChange?.({})}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
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
            <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
              {columns.map((col) => {
                const colKey = String(col.key)
                const isSortable = col.sortable !== false && !!onSortChange
                const isFilterable = col.filterable !== false && !!onColumnFiltersChange
                const hasFilter = !!(externalFilters ?? {})[colKey]
                const isSortedHere = sortKey === colKey
                const isOpen = openDropdown === colKey

                return (
                  <th
                    key={colKey}
                    ref={el => { thRefs.current[colKey] = el }}
                    className="px-3 py-2.5 text-left"
                    style={{
                      color: isSortedHere ? 'var(--accent)' : 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      position: 'relative',
                      userSelect: 'none',
                    }}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      {/* Header text + inline sort icon */}
                      {isSortable ? (
                        <button
                          onClick={() => handleSort(colKey, isSortedHere && sortDir === 'asc' ? 'desc' : 'asc')}
                          className="flex items-center gap-1 flex-1 text-left min-w-0"
                          style={{ overflow: 'hidden' }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'inherit' }}>
                            {col.header}
                          </span>
                          {isSortedHere
                            ? sortDir === 'asc'
                              ? <ChevronUp size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                              : <ChevronDown size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            : <ChevronsUpDown size={11} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                          }
                        </button>
                      ) : (
                        <span
                          className="flex-1"
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {col.header}
                        </span>
                      )}

                      {/* Filter icon — shown when filterable */}
                      {isFilterable && (
                        <button
                          onClick={e => openColDropdown(colKey, e.currentTarget)}
                          title="Filtruj / Sortuj"
                          className="flex items-center justify-center rounded"
                          style={{
                            flexShrink: 0,
                            width: 18,
                            height: 18,
                            color: hasFilter || isOpen ? 'var(--accent)' : 'var(--text-dim)',
                            backgroundColor: isOpen ? 'rgba(239,127,26,0.12)' : 'transparent',
                            transition: 'color 0.15s, background-color 0.15s',
                          }}
                        >
                          <Filter size={10} />
                        </button>
                      )}
                    </div>

                    {/* Active filter indicator — colored bottom border */}
                    {hasFilter && (
                      <div style={{
                        position: 'absolute',
                        bottom: 0, left: 0, right: 0,
                        height: 2,
                        backgroundColor: 'var(--accent)',
                        borderRadius: '1px 1px 0 0',
                      }} />
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
                <th className="px-4 py-2.5 text-right" style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Akcje</th>
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
                const isHovered = hoveredRow === key
                return (
                  <tr
                    key={key}
                    onMouseEnter={() => setHoveredRow(key)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: isHovered
                        ? 'rgba(239,127,26,0.07)'
                        : rowIdx % 2 === 0
                        ? 'transparent'
                        : 'rgba(255,255,255,0.03)',
                      transition: 'background-color 0.1s',
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

      {/* Column dropdown — rendered in portal to avoid overflow clipping */}
      {openDropdown && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: 272,
            zIndex: 9999,
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}
        >
          {/* Sort section */}
          {onSortChange && (
            <div style={{ padding: '12px 14px', borderBottom: openColFilterable && onColumnFiltersChange ? '1px solid var(--border)' : 'none' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Sortuj
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSort(openDropdown, 'asc')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium"
                  style={{
                    backgroundColor: sortKey === openDropdown && sortDir === 'asc' ? 'rgba(239,127,26,0.15)' : 'var(--bg)',
                    color: sortKey === openDropdown && sortDir === 'asc' ? 'var(--accent)' : 'var(--text-muted)',
                    border: `1px solid ${sortKey === openDropdown && sortDir === 'asc' ? 'rgba(239,127,26,0.5)' : 'var(--border)'}`,
                  }}
                >
                  <ArrowUp size={12} /> A → Z
                </button>
                <button
                  onClick={() => handleSort(openDropdown, 'desc')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium"
                  style={{
                    backgroundColor: sortKey === openDropdown && sortDir === 'desc' ? 'rgba(239,127,26,0.15)' : 'var(--bg)',
                    color: sortKey === openDropdown && sortDir === 'desc' ? 'var(--accent)' : 'var(--text-muted)',
                    border: `1px solid ${sortKey === openDropdown && sortDir === 'desc' ? 'rgba(239,127,26,0.5)' : 'var(--border)'}`,
                  }}
                >
                  <ArrowDown size={12} /> Z → A
                </button>
              </div>
            </div>
          )}

          {/* Filter section */}
          {onColumnFiltersChange && openColFilterable && (
            <div style={{ padding: '12px 14px' }}>
              {openColDef?.filterOptions?.length ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                      Wybierz wartości
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => setDraftFilter(prev => ({ ...prev, condition: 'one_of', values: openColDef!.filterOptions! }))}
                        style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                      >
                        Zaznacz wszystkie
                      </button>
                      <button
                        onClick={() => setDraftFilter(prev => ({ ...prev, condition: 'one_of', values: [] }))}
                        style={{ fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Odznacz
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                    {openColDef.filterOptions.map((opt, idx) => {
                      const checked = (draftFilter.values ?? []).includes(opt)
                      return (
                        <label
                          key={opt}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '5px 8px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            color: 'var(--text)',
                            backgroundColor: checked ? 'rgba(239,127,26,0.1)' : 'transparent',
                            border: `1px solid ${checked ? 'rgba(239,127,26,0.35)' : 'transparent'}`,
                            transition: 'background-color 0.12s, border-color 0.12s',
                          }}
                        >
                          <input
                            type="checkbox"
                            autoFocus={idx === 0}
                            checked={checked}
                            onChange={e => {
                              const vals = draftFilter.values ?? []
                              setDraftFilter(prev => ({
                                ...prev,
                                condition: 'one_of',
                                values: e.target.checked ? [...vals, opt] : vals.filter(v => v !== opt),
                              }))
                            }}
                            style={{ accentColor: 'var(--accent)', width: 13, height: 13, flexShrink: 0 }}
                          />
                          {opt}
                        </label>
                      )
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Filtruj wg warunku
                  </p>
                  <select
                    value={draftFilter.condition}
                    onChange={e => setDraftFilter(prev => ({ ...prev, condition: e.target.value as FilterCondition }))}
                    style={{
                      width: '100%',
                      marginBottom: needsValue ? 8 : 0,
                      padding: '7px 10px',
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--text)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    {CONDITIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>

                  {needsValue && (
                    <input
                      autoFocus
                      value={draftFilter.value}
                      onChange={e => setDraftFilter(prev => ({ ...prev, value: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') applyDraftFilter() }}
                      placeholder="Wpisz wartość..."
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        fontSize: 12,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--bg)',
                        color: 'var(--text)',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* Dropdown footer buttons */}
          <div
            className="flex items-center gap-2"
            style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', backgroundColor: 'rgba(0,0,0,0.06)' }}
          >
            {hasActiveFilter && (
              <button
                onClick={() => clearColFilter(openDropdown)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                Wyczyść filtr
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setOpenDropdown(null)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              Anuluj
            </button>
            {onColumnFiltersChange && openColFilterable && (
              <button
                onClick={applyDraftFilter}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              >
                Zastosuj
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
