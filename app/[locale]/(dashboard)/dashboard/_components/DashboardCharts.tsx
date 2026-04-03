'use client'

// Wykresy dashboardu — Recharts (tylko client-side)

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useTranslations } from 'next-intl'

interface WeekData {
  week: string
  count: number
}

interface DashboardChartsProps {
  dealsData: WeekData[]
  casesData: WeekData[]
}

// Własny tooltip z dark mode
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="rounded-lg px-3 py-2 text-sm shadow-lg"
        style={{
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      >
        <p style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="font-semibold" style={{ color: 'var(--accent)' }}>
          {payload[0].value}
        </p>
      </div>
    )
  }
  return null
}

function ChartCard({
  title,
  data,
  subtitle,
}: {
  title: string
  data: WeekData[]
  subtitle: string
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {title}
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
          {subtitle}
        </p>
      </div>

      {data.length === 0 ? (
        <div
          className="flex h-40 items-center justify-center text-sm"
          style={{ color: 'var(--text-dim)' }}
        >
          Brak danych
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: 'var(--text-dim)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-dim)' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79, 110, 247, 0.08)' }} />
            <Bar
              dataKey="count"
              fill="var(--accent)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export function DashboardCharts({ dealsData, casesData }: DashboardChartsProps) {
  const t = useTranslations('dashboard')

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard
        title={t('dealsChart')}
        data={dealsData}
        subtitle={t('last8Weeks')}
      />
      <ChartCard
        title={t('casesChart')}
        data={casesData}
        subtitle={t('last8Weeks')}
      />
    </div>
  )
}
