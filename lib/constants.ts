export const PAGE_SIZE = 25
export const PAGE_SIZE_LARGE = 50

// Statusy zamówień (Sales) — współdzielone między DataTable (moduł Zamówienia)
// a popupami rozmów (ściąga handlowca). Jedno źródło prawdy.
export const SALE_STATUS_OPTIONS = ['new', 'processing', 'shipped', 'delivered', 'cancelled'] as const

export const SALE_STATUS_COLORS: Record<string, string> = {
  new: '#e07818',
  processing: '#f59e0b',
  shipped: '#a855f7',
  delivered: '#22c55e',
  cancelled: '#ef4444',
}

// Statusy rozmów telefonicznych (QUO) — popup + zakładka Rozmowy.
export const CALL_STATUS_OPTIONS = ['ringing', 'completed', 'missed']

export const CALL_STATUS_COLORS: Record<string, string> = {
  ringing: '#e07818', // = var(--accent)
  completed: '#10a872', // = var(--success)
  missed: '#e8384f', // = var(--danger)
}
