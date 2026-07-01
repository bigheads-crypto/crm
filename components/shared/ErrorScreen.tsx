'use client'

// Pełnoekranowy ekran błędu — wspólny wygląd dla error.tsx i not-found.tsx.
// Prezentacyjny: teksty i akcje przekazuje się z zewnątrz (i18n po stronie wywołującego).

import type { ReactNode } from 'react'

interface Props {
  icon: ReactNode
  title: string
  message: string
  /** Przyciski akcji (retry / powrót) */
  children?: ReactNode
}

export function ErrorScreen({ icon, title, message, children }: Props) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-2xl text-center"
        style={{
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5"
          style={{ backgroundColor: 'rgba(232, 56, 79, 0.12)', color: 'var(--danger)' }}
        >
          {icon}
        </div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
          {title}
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
          {message}
        </p>
        {children && <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">{children}</div>}
      </div>
    </div>
  )
}
