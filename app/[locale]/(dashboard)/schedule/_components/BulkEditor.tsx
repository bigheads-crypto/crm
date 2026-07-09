'use client'

import { useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Modal } from '@/components/shared/Modal'
import { createClient } from '@/lib/supabase/client'
import { describeSupabaseError } from '@/lib/errors'
import { useErrorToast } from '@/components/shared/ErrorToast'
import { inputStyle } from '@/components/shared/forms'
import type { ShiftType } from '@/lib/supabase/types'

interface EmployeeRow {
  id: string
  full_name: string | null
  is_lead: boolean
}

interface Props {
  department: string
  month: string // 'YYYY-MM'
  daysInMonth: number
  employees: EmployeeRow[]
  shiftTypes: ShiftType[]
  currentUserId: string
  onClose: () => void
  onSaved: () => void
}

const mondayIndex = (jsDay: number) => (jsDay + 6) % 7

export function BulkEditor({ department, month, daysInMonth, employees, shiftTypes, currentUserId, onClose, onSaved }: Props) {
  const t = useTranslations('schedule')
  const locale = useLocale()
  const { showError } = useErrorToast()

  const [year, monthNum] = month.split('-').map(Number)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [shift, setShift] = useState<string>(shiftTypes[0] ? String(shiftTypes[0].id) : '')
  const [fromDay, setFromDay] = useState(1)
  const [toDay, setToDay] = useState(daysInMonth)
  const [weekdays, setWeekdays] = useState<boolean[]>([true, true, true, true, true, true, true]) // Pn..Nd
  const [saving, setSaving] = useState(false)

  const weekdayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' })),
    [locale],
  )

  // Daty w zakresie pasujące do wybranych dni tygodnia.
  const targetDates = useMemo(() => {
    const lo = Math.min(fromDay, toDay)
    const hi = Math.max(fromDay, toDay)
    const dates: string[] = []
    for (let d = lo; d <= hi; d++) {
      const dow = mondayIndex(new Date(year, monthNum - 1, d).getDay())
      if (weekdays[dow]) dates.push(`${month}-${String(d).padStart(2, '0')}`)
    }
    return dates
  }, [fromDay, toDay, weekdays, year, monthNum, month])

  const toggleEmp = (id: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const allSelected = employees.length > 0 && selected.size === employees.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(employees.map((e) => e.id)))

  async function handleApply() {
    if (selected.size === 0 || targetDates.length === 0) return
    setSaving(true)
    const supabase = createClient()
    const empIds = [...selected]

    if (shift === '') {
      // Wyczyść (wolne) na wybranych dniach.
      const { error } = await supabase.from('schedule_entries')
        .delete().eq('department', department).in('user_id', empIds).in('work_date', targetDates)
      setSaving(false)
      if (error) { showError(describeSupabaseError(error, { table: 'schedule_entries', operation: 'delete' })); return }
    } else {
      const rows = empIds.flatMap((uid) =>
        targetDates.map((date) => ({
          user_id: uid, work_date: date, shift_type_id: Number(shift), department, status: 'draft', created_by: currentUserId,
        })),
      )
      const { error } = await supabase.from('schedule_entries').upsert(rows, { onConflict: 'user_id,work_date' })
      setSaving(false)
      if (error) { showError(describeSupabaseError(error, { table: 'schedule_entries', operation: 'insert' })); return }
    }
    onSaved()
  }

  const dayOptions = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <Modal open onClose={onClose} title={t('bulkTitle')} size="md">
      <div className="flex flex-col gap-4">
        {/* Pracownicy */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('bulkEmployees')}</span>
            <button onClick={toggleAll} className="text-xs font-medium" style={{ color: 'var(--accent)' }}>{t('bulkSelectAll')}</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {employees.map((e) => {
              const on = selected.has(e.id)
              return (
                <button
                  key={e.id}
                  onClick={() => toggleEmp(e.id)}
                  className="px-2.5 py-1 text-sm rounded-full transition-colors"
                  style={{
                    backgroundColor: on ? 'rgba(224,120,24,0.15)' : 'var(--surface)',
                    border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                    color: on ? 'var(--accent)' : 'var(--text)',
                  }}
                >
                  {e.full_name || '—'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Zmiana */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('bulkShift')}</span>
          <select value={shift} onChange={(e) => setShift(e.target.value)} style={inputStyle}>
            <option value="">{t('dayOff')}</option>
            {shiftTypes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.start_time && s.end_time ? ` (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Zakres dni */}
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('bulkFrom')}</span>
            <select value={fromDay} onChange={(e) => setFromDay(Number(e.target.value))} style={inputStyle}>
              {dayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('bulkTo')}</span>
            <select value={toDay} onChange={(e) => setToDay(Number(e.target.value))} style={inputStyle}>
              {dayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Dni tygodnia */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('bulkWeekdays')}</span>
            <button
              onClick={() => setWeekdays([true, true, true, true, true, false, false])}
              className="text-xs font-medium" style={{ color: 'var(--accent)' }}
            >
              {t('bulkWorkdaysOnly')}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {weekdayLabels.map((w, i) => {
              const on = weekdays[i]
              return (
                <button
                  key={i}
                  onClick={() => setWeekdays((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                  className="px-2.5 py-1 text-sm rounded-lg capitalize transition-colors"
                  style={{
                    backgroundColor: on ? 'rgba(224,120,24,0.15)' : 'var(--surface)',
                    border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                    color: on ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {w}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('bulkSummary', { count: targetDates.length * selected.size })}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>
              {t('cancel')}
            </button>
            <button
              onClick={handleApply}
              disabled={saving || selected.size === 0 || targetDates.length === 0}
              className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {saving ? t('saving') : t('bulkApply')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
