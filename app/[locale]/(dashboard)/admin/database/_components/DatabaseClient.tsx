'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Database, Download, Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'

interface TableHealth {
  table: string
  ok: boolean
  count: number | null
  error: string | null
}

interface HealthReport {
  connectionOk: boolean
  connectionError: string | null
  tables: TableHealth[]
  missingCount: number
  adminExists: boolean
  checkedAt: string
}

const cardStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 12,
  border: '1px solid var(--border)',
  backgroundColor: 'var(--surface)',
  marginBottom: 16,
}

export function DatabaseClient() {
  const t = useTranslations('adminDatabase')

  // ── Diagnostyka ──
  const [health, setHealth] = useState<HealthReport | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState<string | null>(null)

  const loadHealth = useCallback(async () => {
    setHealthLoading(true)
    setHealthError(null)
    try {
      const res = await fetch('/api/health')
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      setHealth(body as HealthReport)
    } catch (e) {
      setHealthError((e as Error).message)
    } finally {
      setHealthLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHealth()
  }, [loadHealth])

  // ── Zrzut schematu ──
  const [dumpLoading, setDumpLoading] = useState(false)
  const [dumpError, setDumpError] = useState<string | null>(null)

  async function handleDump() {
    setDumpLoading(true)
    setDumpError(null)
    try {
      const res = await fetch('/api/admin/schema-dump')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const text = await res.text()
      const blob = new Blob([text], { type: 'application/sql' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `baseline_${date}.sql`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setDumpError((e as Error).message)
    } finally {
      setDumpLoading(false)
    }
  }

  const allOk = health && health.connectionOk && health.missingCount === 0

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div style={{ maxWidth: 720 }}>
        {/* ── Karta diagnostyki ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Database size={18} style={{ color: 'var(--accent)' }} />
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{t('healthTitle')}</span>
            </div>
            <button
              onClick={loadHealth}
              disabled={healthLoading}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: healthLoading ? 'default' : 'pointer' }}
            >
              {healthLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {healthLoading ? t('checking') : t('refresh')}
            </button>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>{t('healthDescription')}</p>

          {healthError && (
            <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>
              {t('healthError')}: {healthError}
            </p>
          )}

          {healthLoading && !health && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 14 }}>
              <Loader2 size={16} className="animate-spin" /> {t('checking')}
            </div>
          )}

          {health && (
            <>
              {/* Podsumowanie */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <StatusLine ok={health.connectionOk} okText={t('connectionOk')} failText={t('connectionFail')} />
                <StatusLine ok={health.adminExists} okText={t('adminExists')} failText={t('adminMissing')} warn />
                <StatusLine
                  ok={health.missingCount === 0}
                  okText={t('allOk', { count: health.tables.length })}
                  failText={t('problemsFound', { count: health.missingCount, total: health.tables.length })}
                />
              </div>

              {/* Lista tabel */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 6,
                }}
              >
                {health.tables.map((tab) => (
                  <div
                    key={tab.table}
                    title={tab.error ?? undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      fontSize: 13,
                    }}
                  >
                    {tab.ok
                      ? <CheckCircle2 size={15} style={{ color: '#3ba55d', flexShrink: 0 }} />
                      : <XCircle size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
                    <code style={{ color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tab.table}
                    </code>
                    <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                      {tab.ok ? `${tab.count} ${t('records')}` : '—'}
                    </span>
                  </div>
                ))}
              </div>

              {!allOk && (
                <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={13} style={{ color: 'var(--danger)' }} /> {t('healthHint')}
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Karta zrzutu schematu ── */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Download size={18} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{t('cardTitle')}</span>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>{t('cardDescription')}</p>

          <button
            onClick={handleDump}
            disabled={dumpLoading}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--accent)', color: '#fff', opacity: dumpLoading ? 0.7 : 1, cursor: dumpLoading ? 'default' : 'pointer' }}
          >
            {dumpLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {dumpLoading ? t('generating') : t('download')}
          </button>

          {dumpError && (
            <p style={{ marginTop: 12, color: 'var(--danger)', fontSize: 13 }}>{t('error')}: {dumpError}</p>
          )}

          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-dim)' }}>{t('note')}</p>
        </div>
      </div>
    </div>
  )
}

function StatusLine({ ok, okText, failText, warn }: { ok: boolean; okText: string; failText: string; warn?: boolean }) {
  const failColor = warn ? '#d9a13a' : 'var(--danger)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
      {ok
        ? <CheckCircle2 size={16} style={{ color: '#3ba55d', flexShrink: 0 }} />
        : <XCircle size={16} style={{ color: failColor, flexShrink: 0 }} />}
      <span style={{ color: ok ? 'var(--text)' : failColor }}>{ok ? okText : failText}</span>
    </div>
  )
}
