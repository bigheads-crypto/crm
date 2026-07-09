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

// Grafik pracy — działy (= role pracownicze) mające grafik. Admin nie jest
// działem — używa przełącznika do wyboru któregokolwiek z tych działów.
export const SCHEDULE_DEPARTMENTS = ['handlowiec', 'support', 'logistyka', 'hr', 'manager'] as const
export type ScheduleDepartment = (typeof SCHEDULE_DEPARTMENTS)[number]

// Dostępność pracownika — rodzaje i kolory (zielony/czerwony/niebieski).
export const AVAILABILITY_KINDS = ['available', 'unavailable', 'preferred'] as const
export type AvailabilityKind = (typeof AVAILABILITY_KINDS)[number]
export const AVAILABILITY_COLORS: Record<AvailabilityKind, string> = {
  available: '#22c55e',
  unavailable: '#ef4444',
  preferred: '#3b82f6',
}

// Statusy rozmów telefonicznych (QUO) — popup + zakładka Rozmowy.
export const CALL_STATUS_OPTIONS = ['ringing', 'completed', 'missed']

export const CALL_STATUS_COLORS: Record<string, string> = {
  ringing: '#e07818', // = var(--accent)
  completed: '#10a872', // = var(--success)
  missed: '#e8384f', // = var(--danger)
}
