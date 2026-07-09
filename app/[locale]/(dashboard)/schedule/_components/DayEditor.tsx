'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Modal } from '@/components/shared/Modal'
import { createClient } from '@/lib/supabase/client'
import { describeSupabaseError } from '@/lib/errors'
import { useErrorToast } from '@/components/shared/ErrorToast'
import { inputStyle } from '@/components/shared/forms'
import { AVAILABILITY_COLORS, type AvailabilityKind } from '@/lib/constants'
import type { ShiftType } from '@/lib/supabase/types'

interface EmployeeRow {
  id: string
  full_name: string | null
  is_lead: boolean
}

interface Props {
  dateStr: string // 'YYYY-MM-DD'
  department: string
  employees: EmployeeRow[]
  shiftTypes: ShiftType[]
  currentUserId: string
  // empId → aktualnie przypisany shift_type_id (dla tego dnia)
  initial: Record<string, number>
  // empId → zadeklarowana dostępność (podkład dla kierownika)
  availability: Record<string, { kind: AvailabilityKind; shiftPref: number | null }>
  onClose: () => void
  onSaved: () => void
}

export function DayEditor({ dateStr, department, employees, shiftTypes, currentUserId, initial, availability, onClose, onSaved }: Props) {
  const t = useTranslations('schedule')
  const locale = useLocale()
  const { showError } = useErrorToast()

  // empId → wybrana wartość ('' = wolne, lub id zmiany jako string)
  const [assign, setAssign] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const e of employees) init[e.id] = initial[e.id] != null ? String(initial[e.id]) : ''
    return init
  })
  const [saving, setSaving] = useState(false)

  const shiftName = new Map(shiftTypes.map((s) => [s.id, s.name]))

  const dateLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    const upserts: {
      user_id: string; work_date: string; shift_type_id: number; department: string; status: string; created_by: string
    }[] = []
    const deletes: string[] = []

    for (const e of employees) {
      const desired = assign[e.id] || ''
      const existing = initial[e.id] // number | undefined
      if (desired === '') {
        if (existing != null) deletes.push(e.id)
      } else if (Number(desired) !== existing) {
        upserts.push({
          user_id: e.id,
          work_date: dateStr,
          shift_type_id: Number(desired),
          department,
          status: 'draft', // każda edycja ląduje jako robocza — publikuje się osobno
          created_by: currentUserId,
        })
      }
    }

    if (upserts.length > 0) {
      const { error } = await supabase.from('schedule_entries').upsert(upserts, { onConflict: 'user_id,work_date' })
      if (error) {
        showError(describeSupabaseError(error, { table: 'schedule_entries', operation: 'insert' }))
        setSaving(false)
        return
      }
    }
    if (deletes.length > 0) {
      const { error } = await supabase
        .from('schedule_entries')
        .delete()
        .eq('work_date', dateStr)
        .eq('department', department)
        .in('user_id', deletes)
      if (error) {
        showError(describeSupabaseError(error, { table: 'schedule_entries', operation: 'delete' }))
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={`${t('editTitle')} · ${dateLabel}`} size="md">
      <div className="flex flex-col gap-3">
        {employees.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('noEmployees')}</p>
        ) : (
          employees.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3">
              <span className="text-sm truncate inline-flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                {availability[e.id] && (
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: AVAILABILITY_COLORS[availability[e.id].kind] }}
                    title={t(availability[e.id].kind as Parameters<typeof t>[0])}
                  />
                )}
                {e.full_name || '—'}
                {e.is_lead && <span style={{ color: 'var(--accent)' }}>★</span>}
                {availability[e.id] && (
                  <span className="text-xs" style={{ color: AVAILABILITY_COLORS[availability[e.id].kind] }}>
                    · {t(availability[e.id].kind as Parameters<typeof t>[0])}
                    {availability[e.id].shiftPref != null && shiftName.get(availability[e.id].shiftPref!) ? ` (${shiftName.get(availability[e.id].shiftPref!)})` : ''}
                  </span>
                )}
              </span>
              <select
                value={assign[e.id]}
                onChange={(ev) => setAssign((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                style={{ ...inputStyle, width: '11rem' }}
              >
                <option value="">{t('dayOff')}</option>
                {shiftTypes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.start_time && s.end_time ? ` (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ))
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg"
            style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || employees.length === 0}
            className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
