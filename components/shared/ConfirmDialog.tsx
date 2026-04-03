'use client'

// Dialog potwierdzenia operacji (np. usunięcia rekordu)

import { Modal } from './Modal'
import { Loader2 } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  loading?: boolean
  confirmLabel?: string
  cancelLabel?: string
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  loading = false,
  confirmLabel = 'Usuń',
  cancelLabel = 'Anuluj',
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        {description}
      </p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          style={{
            backgroundColor: 'var(--border)',
            color: 'var(--text)',
          }}
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          style={{
            backgroundColor: 'var(--danger)',
            color: '#ffffff',
          }}
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
