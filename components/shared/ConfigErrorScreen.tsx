'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import type { EnvVar } from '@/lib/env'

// Ekran pokazywany, gdy brakuje wymaganych zmiennych środowiskowych.
// Renderowany z layoutu locale (wewnątrz NextIntlClientProvider), więc i18n działa
// nawet gdy reszta aplikacji nie może wystartować.
export function ConfigErrorScreen({ missing }: { missing: EnvVar[] }) {
  const t = useTranslations('configError')

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: '100%',
          padding: 28,
          borderRadius: 14,
          border: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <AlertTriangle size={26} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{t('title')}</h1>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
          {t('description')}
        </p>

        <div style={{ marginBottom: 20 }}>
          {missing.map((v) => (
            <div
              key={v.name}
              style={{
                padding: 12,
                borderRadius: 10,
                border: '1px solid var(--border)',
                marginBottom: 10,
              }}
            >
              <code style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 600 }}>{v.name}</code>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 6px' }}>
                {v.description}
              </p>
              <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                {t('exampleLabel')}: <code>{v.example}</code>
              </p>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 10,
            border: '1px dashed var(--border)',
          }}
        >
          <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>{t('howto')}</p>
        </div>
      </div>
    </div>
  )
}
