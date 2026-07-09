'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, Plus } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { createClient } from '@/lib/supabase/client'
import { describeSupabaseError } from '@/lib/errors'
import { useErrorToast } from '@/components/shared/ErrorToast'
import { inputStyle } from '@/components/shared/forms'
import type { ShiftType } from '@/lib/supabase/types'

interface Props {
  department: string
  shiftTypes: ShiftType[]
  onClose: () => void
  onSaved: () => void
}

interface Row {
  id: number | null
  name: string
  start_time: string // 'HH:MM' lub ''
  end_time: string
  color: string
}

// Waliduje 'GG:MM' (dopuszcza 24:00). Zwraca znormalizowaną wartość lub null gdy puste, undefined gdy błędne.
function normalizeTime(s: string): string | null | undefined {
  const v = s.trim()
  if (v === '') return null
  const m = v.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return undefined
  const h = Number(m[1]); const min = Number(m[2])
  if (h > 24 || min > 59 || (h === 24 && min !== 0)) return undefined
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function ShiftTypesEditor({ department, shiftTypes, onClose, onSaved }: Props) {
  const t = useTranslations('schedule')
  const { showError } = useErrorToast()

  const [rows, setRows] = useState<Row[]>(() =>
    shiftTypes.map((s) => ({
      id: s.id,
      name: s.name,
      start_time: s.start_time ? s.start_time.slice(0, 5) : '',
      end_time: s.end_time ? s.end_time.slice(0, 5) : '',
      color: s.color || '#e07818',
    })),
  )
  const [saving, setSaving] = useState(false)

  const update = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const addRow = () => setRows((prev) => [...prev, { id: null, name: '', start_time: '', end_time: '', color: '#e07818' }])
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i))

  async function handleSave() {
    // Walidacja
    for (const r of rows) {
      if (!r.name.trim()) { showError({ operation: 'insert', messageKey: 'requiredMissing', detail: t('shiftNameRequired') }); return }
      if (normalizeTime(r.start_time) === undefined || normalizeTime(r.end_time) === undefined) {
        showError({ operation: 'insert', messageKey: 'invalidFormat', detail: t('shiftTimeInvalid') }); return
      }
    }

    setSaving(true)
    const supabase = createClient()

    const originalIds = shiftTypes.map((s) => s.id)
    const keptIds = rows.filter((r) => r.id != null).map((r) => r.id as number)
    const deletedIds = originalIds.filter((id) => !keptIds.includes(id))

    if (deletedIds.length > 0) {
      const { error } = await supabase.from('shift_types').delete().in('id', deletedIds)
      if (error) { setSaving(false); showError(describeSupabaseError(error, { table: 'shift_types', operation: 'delete' })); return }
    }

    for (const r of rows.filter((r) => r.id != null)) {
      const { error } = await supabase.from('shift_types').update({
        name: r.name.trim(),
        start_time: normalizeTime(r.start_time),
        end_time: normalizeTime(r.end_time),
        color: r.color,
      }).eq('id', r.id as number)
      if (error) { setSaving(false); showError(describeSupabaseError(error, { table: 'shift_types', operation: 'update' })); return }
    }

    const inserts = rows.filter((r) => r.id == null).map((r) => ({
      department,
      name: r.name.trim(),
      start_time: normalizeTime(r.start_time),
      end_time: normalizeTime(r.end_time),
      color: r.color,
    }))
    if (inserts.length > 0) {
      const { error } = await supabase.from('shift_types').insert(inserts)
      if (error) { setSaving(false); showError(describeSupabaseError(error, { table: 'shift_types', operation: 'insert' })); return }
    }

    setSaving(false)
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={t('shiftTypesTitle')} size="lg">
      <div className="flex flex-col gap-3">
        {/* Nagłówki */}
        <div className="hidden sm:grid gap-2 text-xs" style={{ gridTemplateColumns: '1fr 6rem 6rem 3rem 2rem', color: 'var(--text-muted)' }}>
          <span>{t('shiftName')}</span>
          <span>{t('shiftStart')}</span>
          <span>{t('shiftEnd')}</span>
          <span>{t('shiftColor')}</span>
          <span />
        </div>

        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 6rem 6rem 3rem 2rem' }}>
            <input value={r.name} onChange={(e) => update(i, { name: e.target.value })} placeholder={t('shiftName')} style={inputStyle} />
            <input value={r.start_time} onChange={(e) => update(i, { start_time: e.target.value })} placeholder="08:00" style={inputStyle} />
            <input value={r.end_time} onChange={(e) => update(i, { end_time: e.target.value })} placeholder="16:00" style={inputStyle} />
            <input type="color" value={r.color} onChange={(e) => update(i, { color: e.target.value })}
              style={{ width: '2.5rem', height: '2.2rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'none', cursor: 'pointer' }} />
            <button onClick={() => removeRow(i)} aria-label={t('delete')} className="flex items-center justify-center h-8 w-8 rounded-md" style={{ color: 'var(--danger)' }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}

        <button onClick={addRow} className="inline-flex items-center gap-1.5 text-sm font-medium self-start" style={{ color: 'var(--accent)' }}>
          <Plus size={14} /> {t('shiftAdd')}
        </button>

        <div className="flex justify-end gap-2 mt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>
            {t('cancel')}
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
