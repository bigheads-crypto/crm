'use client'

// Host popupów rozmów telefonicznych (QUO). Montowany w layoucie dashboardu
// tylko dla roli handlowiec/admin. Subskrybuje Realtime przez useCallNotifications
// i renderuje karty aktywnych rozmów w prawym dolnym rogu.
//
// Karta (zwinięta): nazwa/numer/status + notatka-akcja „Utwórz leada"/„Przypisz kontakt".
// Karta (rozwinięta): ściąga handlowca — dane klienta + historia zamówień + „Dodaj zamówienie".

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  X,
  ChevronDown,
  ChevronUp,
  Building2,
  MapPin,
  Mail,
  User,
  UserPlus,
  UserCheck,
  ShoppingBag,
  Plus,
} from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { useCallNotifications } from '@/hooks/useCallNotifications'
import { useCallNotificationsEnabled } from '@/hooks/useCallNotificationsEnabled'
import { createClient } from '@/lib/supabase/client'
import { normalizePhone } from '@/lib/phone'
import { StatusBadge } from '@/components/shared/Badge'
import { SALE_STATUS_COLORS } from '@/lib/constants'
import type { Call, Client, Sale } from '@/lib/supabase/types'

export function CallPopupHost({ salesmanName }: { salesmanName: string }) {
  const { enabled } = useCallNotificationsEnabled()
  const { activeCalls, dismissCall } = useCallNotifications(enabled)

  if (!enabled || activeCalls.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col gap-3"
      style={{ width: '360px', maxWidth: 'calc(100vw - 2rem)' }}
    >
      {activeCalls.map((call) => (
        <CallCard
          key={call.id}
          call={call}
          salesmanName={salesmanName}
          onClose={() => dismissCall(call.id)}
        />
      ))}
    </div>
  )
}

// Kolor akcentu karty zależny od statusu rozmowy.
function statusColor(status: Call['status']): string {
  switch (status) {
    case 'completed':
      return 'var(--success)'
    case 'missed':
      return 'var(--danger)'
    case 'ringing':
    default:
      return 'var(--accent)'
  }
}

function CallCard({
  call,
  salesmanName,
  onClose,
}: {
  call: Call
  salesmanName: string
  onClose: () => void
}) {
  const t = useTranslations('calls')
  const locale = useLocale()
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [client, setClient] = useState<Client | null>(null)
  const [clientLoaded, setClientLoaded] = useState(false)
  const [note, setNote] = useState(() => call.notes ?? '')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const accent = statusColor(call.status)

  // Eager: pobierz powiązanego klienta (po client_id z n8n lub po numerze), żeby stopka
  // mogła pokazać właściwy przycisk (utwórz leada / przypisz / brak) bez rozwijania.
  useEffect(() => {
    let cancelled = false
    async function loadClient() {
      const supabase = createClient()
      let row: Client | null = null
      if (call.client_id) {
        const { data } = await supabase.from('Clients').select('*').eq('id', call.client_id).maybeSingle()
        row = (data as Client | null) ?? null
      } else if (call.phone) {
        const normalized = normalizePhone(call.phone)
        const { data } = await supabase
          .from('Clients')
          .select('*')
          .or(`phone.eq.${normalized},phone_alt.eq.${normalized}`)
          .maybeSingle()
        row = (data as Client | null) ?? null
      }
      if (cancelled) return
      setClient(row)
      setClientLoaded(true)
    }
    loadClient()
    return () => {
      cancelled = true
    }
  }, [call.client_id, call.phone])

  const handleNoteChange = (v: string) => {
    setNote(v)
    setActionMsg(null)
  }

  // Zapis notatki do rozmowy (calls.notes)
  async function saveNote() {
    setActionBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from('calls').update({ notes: note || null }).eq('id', call.id)
    setActionBusy(false)
    setActionMsg(error ? { text: t('saveError'), ok: false } : { text: t('saved'), ok: true })
  }

  // Utwórz leada: nowy klient w Clients (przypisany do zalogowanego handlowca) + powiązanie rozmowy
  async function createLead() {
    if (!call.phone) return
    setActionBusy(true)
    const supabase = createClient()
    const { data: created, error } = await supabase
      .from('Clients')
      .insert({
        phone: normalizePhone(call.phone),
        client_name: call.client_name || null,
        assigned_salesman: salesmanName || null,
        source: 'call',
        notes: note || null,
      })
      .select('*')
      .single()
    if (error || !created) {
      setActionBusy(false)
      setActionMsg({ text: t('saveError'), ok: false })
      return
    }
    await supabase
      .from('calls')
      .update({
        client_id: created.id,
        is_known_client: true,
        client_name: created.client_name,
        lead_created: true,
        notes: note || null,
      })
      .eq('id', call.id)
    setClient(created as Client)
    setActionBusy(false)
    setActionMsg({ text: t('leadCreated'), ok: true })
  }

  // Przypisz kontakt do siebie: ustaw assigned_salesman na istniejącym kliencie
  async function assignToMe() {
    if (!client) return
    setActionBusy(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('Clients')
      .update({ assigned_salesman: salesmanName || null })
      .eq('id', client.id)
    if (error) {
      setActionBusy(false)
      setActionMsg({ text: t('saveError'), ok: false })
      return
    }
    await supabase.from('calls').update({ notes: note || null }).eq('id', call.id)
    setClient({ ...client, assigned_salesman: salesmanName })
    setActionBusy(false)
    setActionMsg({ text: t('contactAssigned'), ok: true })
  }

  // „Dodaj zamówienie" — przekaż telefon do modala Zamówień bez ujawniania go w URL.
  // sessionStorage obsługuje przypadek nawigacji, event okna — gdy już jesteśmy na /sales.
  function handleAddOrder() {
    const phone = call.phone ?? ''
    try {
      sessionStorage.setItem('crm:newOrderPhone', phone)
    } catch {
      // brak dostępu do sessionStorage — event i tak zadziała na /sales
    }
    window.dispatchEvent(new CustomEvent('crm:openNewOrder', { detail: { phone } }))
    router.push(`/${locale}/sales`)
  }

  // Ikona kierunku/statusu
  const Icon =
    call.status === 'missed'
      ? PhoneMissed
      : call.direction === 'outgoing'
        ? PhoneOutgoing
        : PhoneIncoming

  // Etykieta statusu
  const statusLabel =
    call.status === 'completed'
      ? t('completed')
      : call.status === 'missed'
        ? t('missed')
        : t('ringing')

  const title = call.direction === 'outgoing' ? t('outgoingCall') : t('incomingCall')

  // Stopka — przycisk akcji kontekstowy (widoczny bez rozwijania)
  const showCreateLead = clientLoaded && !client && !!call.phone
  const showAssign = clientLoaded && !!client && !client.assigned_salesman

  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-xl"
      style={{
        backgroundColor: 'var(--surface-2)',
        border: '1px solid var(--border)',
        boxShadow: `0 0 0 1px ${accent}22, 0 18px 40px rgba(0,0,0,0.45)`,
      }}
    >
      {/* Pasek akcentu na górze */}
      <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: accent }} />

      <div className="p-4">
        {/* Zamknij */}
        <button
          onClick={onClose}
          aria-label={t('close')}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(224,120,24,0.1)'
            e.currentTarget.style.color = 'var(--accent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-3 pl-2">
          {/* Ikona */}
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${accent}1f`, color: accent }}
          >
            <Icon size={17} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {title}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: `${accent}1f`, color: accent }}
              >
                {statusLabel}
              </span>
            </div>

            <p className="mt-1 truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {call.is_known_client && call.client_name ? call.client_name : t('unknownNumber')}
            </p>

            <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
              {call.phone ?? '—'}
              {call.is_known_client && (
                <span className="ml-2" style={{ color: 'var(--success)' }}>
                  · {t('knownClient')}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Stopka: przełącznik szczegółów + utwórz leada / przypisz kontakt */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors"
            style={{ backgroundColor: 'var(--surface)', color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? t('collapse') : t('expand')}
          </button>

          {showCreateLead && (
            <button
              onClick={createLead}
              disabled={actionBusy}
              className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
            >
              <UserPlus size={14} />
              {t('createLead')}
            </button>
          )}

          {showAssign && (
            <button
              onClick={assignToMe}
              disabled={actionBusy}
              className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
            >
              <UserCheck size={14} />
              {t('assignContact')}
            </button>
          )}
        </div>

        {actionMsg && (
          <p
            className="mt-2 text-[11px]"
            style={{ color: actionMsg.ok ? 'var(--success)' : 'var(--danger)' }}
          >
            {actionMsg.text}
          </p>
        )}
      </div>

      {/* Rozwinięta ściąga */}
      {expanded && (
        <div
          className="px-4 pb-4 pl-6"
          style={{ borderTop: '1px solid var(--border)', maxHeight: '380px', overflowY: 'auto' }}
        >
          <CallDetails
            call={call}
            client={client}
            note={note}
            onNoteChange={handleNoteChange}
            onSaveNote={saveNote}
            onAddOrder={handleAddOrder}
            actionBusy={actionBusy}
          />
        </div>
      )}
    </div>
  )
}

// Pojedynczy wiersz metadanej klienta (ikona + tekst).
function InfoRow({ icon: IconC, value }: { icon: typeof User; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text)' }}>
      <IconC size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <span className="truncate">{value}</span>
    </div>
  )
}

interface OrderRow {
  sale: Sale
  zestawy: string[]
}

function CallDetails({
  call,
  client,
  note,
  onNoteChange,
  onSaveNote,
  onAddOrder,
  actionBusy,
}: {
  call: Call
  client: Client | null
  note: string
  onNoteChange: (v: string) => void
  onSaveNote: () => void
  onAddOrder: () => void
  actionBusy: boolean
}) {
  const t = useTranslations('calls')
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [orderCount, setOrderCount] = useState(0)

  // Historia zamówień — ciężki fetch, leniwy (dopiero przy rozwinięciu karty).
  useEffect(() => {
    let cancelled = false

    async function load() {
      const supabase = createClient()
      const effectiveClientId = call.client_id ?? client?.id ?? null

      let saleRows: Sale[] = []
      let count = 0
      if (effectiveClientId) {
        const { data, count: c } = await supabase
          .from('Sales')
          .select('*', { count: 'exact' })
          .eq('client_id', effectiveClientId)
          .order('created_at', { ascending: false })
          .limit(5)
        saleRows = (data ?? []) as Sale[]
        count = c ?? saleRows.length
      } else if (call.phone) {
        const normalized = normalizePhone(call.phone)
        const { data, count: c } = await supabase
          .from('Sales')
          .select('*', { count: 'exact' })
          .eq('phone', normalized)
          .order('created_at', { ascending: false })
          .limit(5)
        saleRows = (data ?? []) as Sale[]
        count = c ?? saleRows.length
      }

      // Pozycje (zestawy) dla pobranych zamówień — „co kupował"
      const zestawBySale: Record<number, string[]> = {}
      if (saleRows.length > 0) {
        const { data: items } = await supabase
          .from('Sales Items')
          .select('sale_id, zestaw_id')
          .in('sale_id', saleRows.map((s) => s.id))
        const zestawIds = [...new Set((items ?? []).map((i) => i.zestaw_id).filter((z): z is number => z != null))]
        const labels: Record<number, string> = {}
        if (zestawIds.length > 0) {
          const { data: zestawy } = await supabase.from('Zestawy').select('id, nr, name').in('id', zestawIds)
          for (const z of zestawy ?? []) labels[z.id] = `#${z.nr} ${z.name}`
        }
        for (const item of items ?? []) {
          if (item.zestaw_id == null) continue
          if (!zestawBySale[item.sale_id]) zestawBySale[item.sale_id] = []
          zestawBySale[item.sale_id].push(labels[item.zestaw_id] ?? `#${item.zestaw_id}`)
        }
      }

      if (cancelled) return
      setOrders(saleRows.map((s) => ({ sale: s, zestawy: zestawBySale[s.id] ?? [] })))
      setOrderCount(count)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [call.client_id, call.phone, client?.id])

  return (
    <div className="flex flex-col gap-3 pt-3">
      {/* Dane klienta */}
      <div>
        <p
          className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          {t('clientInfo')}
        </p>
        {client ? (
          <div className="flex flex-col gap-1">
            {client.company && <InfoRow icon={Building2} value={client.company} />}
            {client.location && <InfoRow icon={MapPin} value={client.location} />}
            {client.email && <InfoRow icon={Mail} value={client.email} />}
            {client.assigned_salesman && (
              <InfoRow icon={User} value={`${t('fieldSalesman')}: ${client.assigned_salesman}`} />
            )}
            {client.notes && (
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                {client.notes}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('noClientRecord')} · {t('newContact')}
          </p>
        )}
      </div>

      {/* Historia zamówień */}
      <div>
        <p
          className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          <ShoppingBag size={12} />
          {t('orderHistory')}
          {orderCount > 0 && <span style={{ color: 'var(--accent)' }}>({orderCount})</span>}
        </p>
        {loading ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('loading')}
          </p>
        ) : orders.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('noOrders')}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {orders.map(({ sale, zestawy }) => (
              <div
                key={sale.id}
                className="rounded-lg px-2.5 py-1.5"
                style={{ backgroundColor: 'var(--surface)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {sale.created_at ? new Date(sale.created_at).toLocaleDateString('pl-PL') : '—'}
                  </span>
                  <div className="flex items-center gap-2">
                    {sale.total != null && (
                      <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                        {Number(sale.total).toLocaleString('pl-PL')} €
                      </span>
                    )}
                    {sale.sale_status && (
                      <StatusBadge status={sale.sale_status} colors={SALE_STATUS_COLORS} />
                    )}
                  </div>
                </div>
                {zestawy.length > 0 && (
                  <p className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {zestawy.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notatka z rozmowy */}
      <div>
        <p
          className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          {t('notesLabel')}
        </p>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder={t('notesPlaceholder')}
          className="w-full rounded-lg p-2 text-xs"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            minHeight: '52px',
            resize: 'vertical',
            outline: 'none',
          }}
        />
      </div>

      {/* Akcje rozwinięte: zapis notatki + dodaj zamówienie */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSaveNote}
          disabled={actionBusy}
          className="flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor: 'var(--surface)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          {t('saveNote')}
        </button>
        <button
          onClick={onAddOrder}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
        >
          <Plus size={14} />
          {t('addOrder')}
        </button>
      </div>
    </div>
  )
}
