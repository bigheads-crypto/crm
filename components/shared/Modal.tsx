'use client'

// Komponent Modal oparty na Radix Dialog

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
        />

        {/* Treść modala */}
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-2xl ${sizeClasses[size]}`}
          style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          {/* Nagłówek */}
          <div
            className="flex items-center justify-between p-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <Dialog.Title
              className="text-base font-semibold"
              style={{ color: 'var(--text)' }}
            >
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--text-muted)'
                }}
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Zawartość */}
          <div className="p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
