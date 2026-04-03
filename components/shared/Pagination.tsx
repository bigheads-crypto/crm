'use client'

// Komponent paginacji z numerami stron i ellipsis

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  // Generuj numery stron do wyświetlenia (max 7 przycisków)
  function getPageNumbers(): (number | 'ellipsis')[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    if (page <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis', totalPages]
    }

    if (page >= totalPages - 3) {
      return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }

    return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', totalPages]
  }

  const pages = getPageNumbers()

  const btnBase = 'flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-medium transition-colors'

  return (
    <div className="flex items-center gap-1">
      {/* Przycisk Poprzednia */}
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className={btnBase}
        style={{
          backgroundColor: 'var(--border)',
          color: page === 1 ? 'var(--text-dim)' : 'var(--text)',
          cursor: page === 1 ? 'not-allowed' : 'pointer',
        }}
      >
        ‹
      </button>

      {/* Numery stron */}
      {pages.map((p, idx) =>
        p === 'ellipsis' ? (
          <span
            key={`ellipsis-${idx}`}
            className="flex h-8 w-8 items-center justify-center text-sm"
            style={{ color: 'var(--text-dim)' }}
          >
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={btnBase}
            style={{
              backgroundColor: p === page ? 'var(--accent)' : 'var(--border)',
              color: p === page ? '#ffffff' : 'var(--text)',
            }}
          >
            {p}
          </button>
        )
      )}

      {/* Przycisk Następna */}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className={btnBase}
        style={{
          backgroundColor: 'var(--border)',
          color: page === totalPages ? 'var(--text-dim)' : 'var(--text)',
          cursor: page === totalPages ? 'not-allowed' : 'pointer',
        }}
      >
        ›
      </button>
    </div>
  )
}
