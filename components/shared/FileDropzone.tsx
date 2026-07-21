'use client'

// Pole wyboru pliku z obsługą przeciągnij-i-upuść oraz kliknięcia.
// Współdzielone — używane m.in. przy dodawaniu instrukcji i wgrywaniu wersji.

import { useState, useRef } from 'react'
import { UploadCloud, X } from 'lucide-react'

interface Props {
  file: File | null
  onChange: (file: File | null) => void
  /** Tekst podpowiedzi (przetłumaczony przez rodzica). */
  hint: string
  /** Opcjonalny filtr rozszerzeń (podpowiedź dla okna wyboru, nie twarde ograniczenie). */
  accept?: string
}

export function FileDropzone({ file, onChange, hint, accept }: Props) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onChange(f)
      }}
      style={{
        border: `1.5px dashed ${drag ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 10,
        padding: '14px 12px',
        textAlign: 'center',
        cursor: 'pointer',
        backgroundColor: drag ? 'rgba(224,120,24,0.06)' : 'var(--surface)',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{file.name}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'inline-flex' }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 13 }}>
          <UploadCloud size={20} style={{ color: 'var(--text-dim)' }} />
          <span>{hint}</span>
        </div>
      )}
    </div>
  )
}
