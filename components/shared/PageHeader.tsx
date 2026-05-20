import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  const wrapClass = `${className ?? 'mb-6'}${actions ? ' flex items-start justify-between gap-4' : ''}`
  return (
    <div className={wrapClass}>
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{title}</h2>
        {subtitle && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}
