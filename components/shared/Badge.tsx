export function getDiffDays(due: string) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const date = new Date(due)
  date.setHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function DueDateBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: 'var(--text-dim)' }}>—</span>
  const date = new Date(value)
  const diff = getDiffDays(value)
  const color = diff < 0 ? '#e8384f' : diff < 30 ? '#e8a800' : '#10a872'
  return (
    <span suppressHydrationWarning style={{ color, fontWeight: 500 }}>
      {date.toLocaleDateString('pl-PL')}
    </span>
  )
}

export function StatusBadge({ status, colors }: { status: string; colors: Record<string, string> }) {
  const color = colors[status] ?? '#6b7280'
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}>
      {status}
    </span>
  )
}

export function DirectionBadge({ dir }: { dir: string }) {
  const isIn = dir === 'inbound' || dir === 'in'
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: isIn ? 'rgba(34,197,94,0.15)' : 'rgba(239,127,26,0.15)', color: isIn ? '#22c55e' : '#e07818' }}>
      {isIn ? '↓ IN' : '↑ OUT'}
    </span>
  )
}

export function DaysLeftBadge({ days }: { days: number | null }) {
  if (days == null) return <span style={{ color: 'var(--text-dim)' }}>—</span>
  const expired = days < 0
  const soon = days >= 0 && days < 30
  const color = expired ? '#e8384f' : soon ? '#e8a800' : '#10a872'
  const label = expired
    ? `${Math.abs(days)} dni temu`
    : days === 0
    ? 'Dziś!'
    : `${days} dni`
  return (
    <span suppressHydrationWarning style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 9px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 600,
      backgroundColor: `${color}22`,
      color,
      border: `1px solid ${color}44`,
    }}>
      {label}
    </span>
  )
}
