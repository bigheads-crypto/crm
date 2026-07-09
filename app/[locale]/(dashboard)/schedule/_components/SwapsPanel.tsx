'use client'

import { useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowLeftRight, Plus } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { createClient } from '@/lib/supabase/client'
import { describeSupabaseError } from '@/lib/errors'
import { useErrorToast } from '@/components/shared/ErrorToast'
import { inputStyle } from '@/components/shared/forms'
import type { ShiftType, ScheduleEntry, ShiftSwap, ShiftSwapStatus } from '@/lib/supabase/types'

interface EmployeeRow {
  id: string
  full_name: string | null
  is_lead: boolean
}

interface SwapEntryInfo {
  id: number
  user_id: string
  work_date: string
  shift_type_id: number | null
}

interface Props {
  department: string
  currentUserId: string
  canManage: boolean
  employees: EmployeeRow[]
  shiftTypes: ShiftType[]
  entries: ScheduleEntry[]
  swaps: ShiftSwap[]
  swapEntries: SwapEntryInfo[]
  onChanged: () => void
}

const STATUS_COLORS: Record<ShiftSwapStatus, string> = {
  pending: '#f59e0b',
  accepted: '#3b82f6',
  approved: '#22c55e',
  rejected: '#ef4444',
  cancelled: '#6b7280',
}
const STATUS_KEYS: Record<ShiftSwapStatus, string> = {
  pending: 'statusPending',
  accepted: 'statusAccepted',
  approved: 'statusApproved',
  rejected: 'statusRejected',
  cancelled: 'statusCancelled',
}

export function SwapsPanel({
  department, currentUserId, canManage, employees, shiftTypes, entries, swaps, swapEntries, onChanged,
}: Props) {
  const t = useTranslations('schedule')
  const locale = useLocale()
  const { showError } = useErrorToast()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)

  const empName = useMemo(() => new Map(employees.map((e) => [e.id, e.full_name || '—'])), [employees])
  const shiftName = useMemo(() => new Map(shiftTypes.map((s) => [s.id, s.name])), [shiftTypes])
  const entryInfo = useMemo(() => new Map(swapEntries.map((e) => [e.id, e])), [swapEntries])

  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' })

  // Opis jednej strony zamiany: „Nazwisko — 10 lip · Rano".
  const sideLabel = (entryId: number, userId: string) => {
    const info = entryInfo.get(entryId)
    const name = empName.get(userId) ?? '—'
    if (!info) return name
    const shift = info.shift_type_id != null ? shiftName.get(info.shift_type_id) : null
    return `${name} — ${fmtDate(info.work_date)}${shift ? ` · ${shift}` : ''}`
  }

  const toAccept = swaps.filter((s) => s.status === 'pending' && s.target_id === currentUserId)
  const myRequests = swaps.filter((s) => s.requester_id === currentUserId && (s.status === 'pending' || s.status === 'accepted'))
  const toApprove = canManage ? swaps.filter((s) => s.status === 'accepted') : []
  const history = swaps.filter((s) => s.status === 'approved' || s.status === 'rejected' || s.status === 'cancelled')

  async function updateStatus(swap: ShiftSwap, status: ShiftSwapStatus) {
    setBusyId(swap.id)
    const supabase = createClient()
    const patch: Record<string, unknown> = { status }
    if (status === 'approved' || status === 'rejected') {
      patch.resolved_by = currentUserId
      patch.resolved_at = new Date().toISOString()
    }
    const { error } = await supabase.from('shift_swaps').update(patch).eq('id', swap.id)
    setBusyId(null)
    if (error) {
      showError(describeSupabaseError(error, { table: 'shift_swaps', operation: 'update' }))
      return
    }
    onChanged()
  }

  async function approve(swap: ShiftSwap) {
    const a = entryInfo.get(swap.requester_entry_id)
    const b = entryInfo.get(swap.target_entry_id)
    if (!a || !b) return
    setBusyId(swap.id)
    const supabase = createClient()

    // Podmiana zmian między dwoma wpisami (ta sama data — zmienia się tylko shift_type_id).
    const u1 = await supabase.from('schedule_entries').update({ shift_type_id: b.shift_type_id }).eq('id', swap.requester_entry_id)
    if (u1.error) { setBusyId(null); showError(describeSupabaseError(u1.error, { table: 'schedule_entries', operation: 'update' })); return }
    const u2 = await supabase.from('schedule_entries').update({ shift_type_id: a.shift_type_id }).eq('id', swap.target_entry_id)
    if (u2.error) { setBusyId(null); showError(describeSupabaseError(u2.error, { table: 'schedule_entries', operation: 'update' })); return }

    const u3 = await supabase.from('shift_swaps').update({ status: 'approved', resolved_by: currentUserId, resolved_at: new Date().toISOString() }).eq('id', swap.id)
    setBusyId(null)
    if (u3.error) { showError(describeSupabaseError(u3.error, { table: 'shift_swaps', operation: 'update' })); return }
    onChanged()
  }

  const btn = (label: string, onClick: () => void, color: string, disabled: boolean) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1 text-xs font-medium rounded-md disabled:opacity-50"
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
    >
      {label}
    </button>
  )

  const renderSwapCard = (swap: ShiftSwap, actions?: React.ReactNode) => (
    <div key={swap.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 text-sm flex-1 min-w-0" style={{ color: 'var(--text)' }}>
        <span className="truncate">{sideLabel(swap.requester_entry_id, swap.requester_id)}</span>
        <ArrowLeftRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span className="truncate">{sideLabel(swap.target_entry_id, swap.target_id)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: `${STATUS_COLORS[swap.status]}22`, color: STATUS_COLORS[swap.status] }}>
          {t(STATUS_KEYS[swap.status] as Parameters<typeof t>[0])}
        </span>
        {actions}
      </div>
    </div>
  )

  const renderSection = (title: string, children: React.ReactNode) => (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</h3>
      {children}
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <div>
        <button
          onClick={() => setRequestOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          <Plus size={14} /> {t('swapNew')}
        </button>
      </div>

      {toAccept.length > 0 && renderSection(t('swapToAccept'),
        toAccept.map((s) => renderSwapCard(s,
          <>
            {btn(t('accept'), () => updateStatus(s, 'accepted'), '#22c55e', busyId === s.id)}
            {btn(t('reject'), () => updateStatus(s, 'rejected'), '#ef4444', busyId === s.id)}
          </>,
        )),
      )}

      {toApprove.length > 0 && renderSection(t('swapToApprove'),
        toApprove.map((s) => renderSwapCard(s,
          <>
            {btn(t('approveSwap'), () => approve(s), '#22c55e', busyId === s.id)}
            {btn(t('reject'), () => updateStatus(s, 'rejected'), '#ef4444', busyId === s.id)}
          </>,
        )),
      )}

      {myRequests.length > 0 && renderSection(t('swapMyRequests'),
        myRequests.map((s) => renderSwapCard(s, btn(t('cancel'), () => updateStatus(s, 'cancelled'), '#6b7280', busyId === s.id))),
      )}

      {history.length > 0 && renderSection(t('swapHistory'),
        history.map((s) => renderSwapCard(s)),
      )}

      {swaps.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('swapNone')}</p>
      )}

      {requestOpen && (
        <SwapRequestEditor
          department={department}
          currentUserId={currentUserId}
          employees={employees}
          shiftTypes={shiftTypes}
          entries={entries}
          onClose={() => setRequestOpen(false)}
          onSaved={() => { setRequestOpen(false); onChanged() }}
        />
      )}
    </div>
  )
}

// ─── Modal tworzenia prośby o zamianę ────────────────────────────────────────

function SwapRequestEditor({
  department, currentUserId, employees, shiftTypes, entries, onClose, onSaved,
}: {
  department: string
  currentUserId: string
  employees: EmployeeRow[]
  shiftTypes: ShiftType[]
  entries: ScheduleEntry[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('schedule')
  const locale = useLocale()
  const { showError } = useErrorToast()

  const empName = useMemo(() => new Map(employees.map((e) => [e.id, e.full_name || '—'])), [employees])
  const shiftName = useMemo(() => new Map(shiftTypes.map((s) => [s.id, s.name])), [shiftTypes])
  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })

  // Moje dniówki w tym miesiącu (z przypisaną zmianą).
  const myEntries = useMemo(
    () => entries.filter((e) => e.user_id === currentUserId && e.shift_type_id != null),
    [entries, currentUserId],
  )

  const [myEntryId, setMyEntryId] = useState<string>(myEntries[0] ? String(myEntries[0].id) : '')
  const [targetEntryId, setTargetEntryId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const myEntry = myEntries.find((e) => String(e.id) === myEntryId)

  // Współpracownicy z INNĄ zmianą tego samego dnia.
  const colleagueEntries = useMemo(() => {
    if (!myEntry) return []
    return entries.filter(
      (e) => e.work_date === myEntry.work_date && e.user_id !== currentUserId && e.shift_type_id != null && e.shift_type_id !== myEntry.shift_type_id,
    )
  }, [entries, myEntry, currentUserId])

  async function handleCreate() {
    const target = colleagueEntries.find((e) => String(e.id) === targetEntryId)
    if (!myEntry || !target) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('shift_swaps').insert({
      department,
      requester_id: currentUserId,
      requester_entry_id: myEntry.id,
      target_id: target.user_id,
      target_entry_id: target.id,
      status: 'pending',
    })
    setSaving(false)
    if (error) {
      showError(describeSupabaseError(error, { table: 'shift_swaps', operation: 'insert' }))
      return
    }
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={t('swapRequestTitle')} size="md">
      {myEntries.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('swapNoMyEntries')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('swapMyShift')}</span>
            <select value={myEntryId} onChange={(e) => { setMyEntryId(e.target.value); setTargetEntryId('') }} style={inputStyle}>
              {myEntries.map((e) => (
                <option key={e.id} value={e.id}>
                  {fmtDate(e.work_date)} · {e.shift_type_id != null ? shiftName.get(e.shift_type_id) : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('swapColleague')}</span>
            {colleagueEntries.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('swapNoColleagues')}</p>
            ) : (
              <select value={targetEntryId} onChange={(e) => setTargetEntryId(e.target.value)} style={inputStyle}>
                <option value="">—</option>
                {colleagueEntries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {empName.get(e.user_id)} · {e.shift_type_id != null ? shiftName.get(e.shift_type_id) : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>
              {t('cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !myEntry || !targetEntryId}
              className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              {saving ? t('saving') : t('swapCreate')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
