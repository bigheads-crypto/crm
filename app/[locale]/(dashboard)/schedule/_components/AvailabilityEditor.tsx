'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Modal } from '@/components/shared/Modal'
import { createClient } from '@/lib/supabase/client'
import { describeSupabaseError } from '@/lib/errors'
import { useErrorToast } from '@/components/shared/ErrorToast'
import { inputStyle } from '@/components/shared/forms'
import { AVAILABILITY_KINDS, AVAILABILITY_COLORS, type AvailabilityKind } from '@/lib/constants'
import type { ShiftType, Availability } from '@/lib/supabase/types'

interface Props {
  dateStr: string
  department: string
  currentUserId: string
  shiftTypes: ShiftType[]
  initial: Availability | null
  onClose: () => void
  onSaved: () => void
}

export function AvailabilityEditor({ dateStr, department, currentUserId, shiftTypes, initial, onClose, onSaved }: Props) {
  const t = useTranslations('schedule')
  const locale = useLocale()
  const { showError } = useErrorToast()

  const [kind, setKind] = useState<AvailabilityKind>(initial?.kind ?? 'available')
  const [shiftPref, setShiftPref] = useState<string>(initial?.shift_pref != null ? String(initial.shift_pref) : '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)

  const dateLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('availability').upsert({
      user_id: currentUserId,
      work_date: dateStr,
      department,
      kind,
      shift_pref: shiftPref ? Number(shiftPref) : null,
      note: note.trim() || null,
    }, { onConflict: 'user_id,work_date' })
    setSaving(false)
    if (error) {
      showError(describeSupabaseError(error, { table: 'availability', operation: initial ? 'update' : 'insert' }))
      return
    }
    onSaved()
  }

  async function handleClear() {
    if (!initial) { onClose(); return }
    setClearing(true)
    const supabase = createClient()
    const { error } = await supabase.from('availability').delete().eq('user_id', currentUserId).eq('work_date', dateStr)
    setClearing(false)
    if (error) {
      showError(describeSupabaseError(error, { table: 'availability', operation: 'delete' }))
      return
    }
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={`${t('availabilityTitle')} · ${dateLabel}`} size="sm">
      <div className="flex flex-col gap-4">
        {/* Wybór statusu */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('kind')}</span>
          <div className="grid grid-cols-3 gap-2">
            {AVAILABILITY_KINDS.map((k) => {
              const active = kind === k
              const color = AVAILABILITY_COLORS[k]
              return (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className="px-2 py-2 text-sm rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: active ? `${color}22` : 'var(--surface)',
                    border: `1px solid ${active ? color : 'var(--border)'}`,
                    color: active ? color : 'var(--text)',
                  }}
                >
                  {t(k as Parameters<typeof t>[0])}
                </button>
              )
            })}
          </div>
        </div>

        {/* Preferowana zmiana (opcjonalnie) */}
        {shiftTypes.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('shiftPref')}</span>
            <select value={shiftPref} onChange={(e) => setShiftPref(e.target.value)} style={inputStyle}>
              <option value="">{t('noShift')}</option>
              {shiftTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.start_time && s.end_time ? ` (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Notatka */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('note')}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <div className="flex justify-between gap-2 mt-1">
          <button
            onClick={handleClear}
            disabled={clearing || !initial}
            className="px-4 py-2 text-sm rounded-lg disabled:opacity-40"
            style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}
          >
            {t('clear')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg"
              style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
