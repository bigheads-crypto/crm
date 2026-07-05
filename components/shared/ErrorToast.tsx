'use client'

// Globalny toast błędów — tytuł wg operacji (zapis/usuwanie/ładowanie),
// przetłumaczony opis przyczyny (klucz z lib/errors.ts) i techniczny detail
// (tabela · operacja · kod PG · message) z przyciskiem kopiowania, żeby można
// było zgłosić błąd i od razu wiedzieć gdzie szukać przyczyny.
//
// Użycie:
//   const { showError } = useErrorToast()
//   if (error) showError(describeSupabaseError(error, { table: 'Clients', operation: 'update' }))

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, X, Copy, Check } from 'lucide-react'
import type { DescribedError, ErrorOperation } from '@/lib/errors'

interface ToastItem extends DescribedError {
  id: number
}

const ErrorToastContext = createContext<{ showError: (err: DescribedError) => void } | null>(null)

export function useErrorToast() {
  const ctx = useContext(ErrorToastContext)
  if (!ctx) throw new Error('useErrorToast musi być użyty wewnątrz <ErrorToastProvider>')
  return ctx
}

const TOAST_TTL_MS = 12000

export function ErrorToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const showError = useCallback((err: DescribedError) => {
    const id = nextId.current++
    setToasts(prev => [...prev, { ...err, id }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), TOAST_TTL_MS)
  }, [])

  return (
    <ErrorToastContext.Provider value={{ showError }}>
      {children}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-4 right-4 flex flex-col gap-2"
          style={{ zIndex: 1100, width: '380px', maxWidth: 'calc(100vw - 32px)' }}
        >
          {toasts.map(toast => (
            <ErrorToastCard
              key={toast.id}
              toast={toast}
              onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            />
          ))}
        </div>
      )}
    </ErrorToastContext.Provider>
  )
}

const TITLE_KEYS: Record<ErrorOperation, string> = {
  load: 'loadFailedTitle',
  insert: 'saveFailedTitle',
  update: 'saveFailedTitle',
  delete: 'deleteFailedTitle',
}

function ErrorToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const tErr = useTranslations('errors')
  const [copied, setCopied] = useState(false)

  function copyDetail() {
    void navigator.clipboard.writeText(toast.detail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      role="alert"
      className="rounded-lg p-3 shadow-lg"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--danger)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      }}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '1px' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {tErr(TITLE_KEYS[toast.operation])}
          </p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {tErr(toast.messageKey)}
          </p>
          <p
            className="text-xs mt-2 rounded px-2 py-1.5"
            style={{
              fontFamily: 'monospace',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              wordBreak: 'break-word',
            }}
          >
            {toast.detail}
          </p>
          <button
            onClick={copyDetail}
            className="flex items-center gap-1.5 mt-2 text-xs font-medium"
            style={{ color: copied ? 'var(--success, #22c55e)' : 'var(--text-muted)' }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? tErr('copied') : tErr('copyDetails')}
          </button>
        </div>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md flex-shrink-0"
          style={{ color: 'var(--text-muted)' }}
          aria-label={tErr('close')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
