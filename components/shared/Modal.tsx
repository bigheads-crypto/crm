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
        {/* Overlay — blur tła */}
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            animation: 'overlayShow 0.2s ease forwards',
          }}
        />

        {/* Treść modala */}
        <Dialog.Content
          aria-describedby={undefined}
          className={`fixed left-1/2 top-1/2 z-50 w-full ${sizeClasses[size]}`}
          style={{
            backgroundColor: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            boxShadow: '0 0 0 1px rgba(239,127,26,0.12), 0 32px 64px rgba(0,0,0,0.6), 0 0 60px rgba(239,127,26,0.04)',
            animation: 'contentShow 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            outline: 'none',
            overflow: 'hidden',
          }}
        >
          {/* Linia akcentu na górze */}
          <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--accent), #fdb909 60%, transparent)', flexShrink: 0 }} />

          {/* Nagłówek */}
          <div
            className="flex items-center justify-between px-5 py-4"
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
                  e.currentTarget.style.backgroundColor = 'rgba(239,127,26,0.1)'
                  e.currentTarget.style.color = 'var(--accent)'
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
          <div className="px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
