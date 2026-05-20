// Współdzielone elementy formularzy — używane przez wszystkie *Client.tsx

import type { CSSProperties, ReactNode } from 'react'

export const inputStyle: CSSProperties = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '14px',
  width: '100%',
  outline: 'none',
}

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: '100px',
}

interface FormFieldProps {
  label: string
  error?: string
  children: ReactNode
}

export function FormField({ label, error, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}

interface FormActionsProps {
  onCancel: () => void
  isSubmitting?: boolean
  cancelLabel?: string
  submitLabel?: string
  submittingLabel?: string
  className?: string
}

export function FormActions({
  onCancel,
  isSubmitting = false,
  cancelLabel = 'Anuluj',
  submitLabel = 'Zapisz',
  submittingLabel = 'Zapisywanie...',
  className,
}: FormActionsProps) {
  return (
    <div className={`flex justify-end gap-2 mt-2${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-sm rounded-lg"
        style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}
      >
        {cancelLabel}
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60"
        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </div>
  )
}
