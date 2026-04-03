// Strona Dashboard — KPI cards + wykresy + ostatnia aktywność
// Server Component — pobiera dane i przekazuje do komponentów klienckich

import { createClient } from '@/lib/supabase/server'
import { DashboardCharts } from './_components/DashboardCharts'
import {
  Handshake,
  HeadphonesIcon,
  Users,
  ShoppingCart,
} from 'lucide-react'

// Formatuje datę tygodnia (np. "Wk 14")
function getWeekLabel(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 1)
  const weekNum = Math.ceil(
    ((date.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7
  )
  return `Wk ${weekNum}`
}

// Grupuje rekordy po tygodniach — ostatnie N tygodni
function groupByWeek(
  records: { created_at: string }[],
  weeks: number
): { week: string; count: number }[] {
  const now = new Date()
  const result: { week: string; count: number }[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - i * 7 - now.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    const count = records.filter((r) => {
      const d = new Date(r.created_at)
      return d >= weekStart && d <= weekEnd
    }).length

    result.push({ week: getWeekLabel(weekStart), count })
  }

  return result
}

// Formatuje datę względnie
function formatRelative(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)

  if (diffH < 1) return 'przed chwilą'
  if (diffH < 24) return `${diffH}h temu`
  if (diffD < 7) return `${diffD}d temu`
  return date.toLocaleDateString('pl-PL')
}

// Karta KPI
function KpiCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string
  value: number
  icon: React.ElementType
  color: string
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
            {title}
          </p>
          <p className="text-3xl font-bold mt-2" style={{ color: 'var(--text)' }}>
            {value.toLocaleString('pl-PL')}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Pobierz KPI równolegle
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { count: activeDeals },
    { count: openCases },
    { count: candidatesMonth },
    { count: ordersMonth },
    { data: recentDeals },
    { data: recentCases },
    { data: allDeals },
    { data: allCases },
  ] = await Promise.all([
    // Aktywne transakcje (status != 'closed')
    supabase
      .from('SalesDeals')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'closed'),

    // Otwarte sprawy supportu
    supabase
      .from('SupportCase')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'closed'),

    // Kandydaci OLX w tym miesiącu — OLX nie ma created_at, więc zliczamy wszystkich
    supabase
      .from('OLX')
      .select('*', { count: 'exact', head: true }),

    // Zamówienia w tym miesiącu
    supabase
      .from('Sales')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth),

    // Ostatnie 5 transakcji sprzedażowych
    supabase
      .from('SalesDeals')
      .select('id, client_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),

    // Ostatnie 5 spraw supportu
    supabase
      .from('SupportCase')
      .select('id, clients_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),

    // Dane dla wykresu SalesDeals — ostatnie 8 tygodni
    supabase
      .from('SalesDeals')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 8 * 7 * 86400000).toISOString()),

    // Dane dla wykresu SupportCase — ostatnie 8 tygodni
    supabase
      .from('SupportCase')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 8 * 7 * 86400000).toISOString()),
  ])

  // Przygotuj dane dla wykresów
  const dealsChartData = groupByWeek(allDeals ?? [], 8)
  const casesChartData = groupByWeek(allCases ?? [], 8)

  // Połącz ostatnią aktywność
  const recentActivity = [
    ...(recentDeals ?? []).map((d) => ({
      id: `deal-${d.id}`,
      name: d.client_name || '—',
      type: 'Transakcja',
      status: d.status || '—',
      date: d.created_at,
    })),
    ...(recentCases ?? []).map((c) => ({
      id: `case-${c.id}`,
      name: c.clients_name || '—',
      type: 'Support',
      status: c.status || '—',
      date: c.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8)

  return (
    <div className="flex flex-col gap-6">
      {/* Tytuł */}
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
          Dashboard
        </h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Przegląd aktywności CRM 4DPF
        </p>
      </div>

      {/* Karty KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Aktywne transakcje"
          value={activeDeals ?? 0}
          icon={Handshake}
          color="var(--accent)"
        />
        <KpiCard
          title="Otwarte sprawy"
          value={openCases ?? 0}
          icon={HeadphonesIcon}
          color="var(--warning)"
        />
        <KpiCard
          title="Kandydaci OLX"
          value={candidatesMonth ?? 0}
          icon={Users}
          color="var(--success)"
        />
        <KpiCard
          title="Zamówienia (mies.)"
          value={ordersMonth ?? 0}
          icon={ShoppingCart}
          color="#a855f7"
        />
      </div>

      {/* Wykresy — Client Component */}
      <DashboardCharts dealsData={dealsChartData} casesData={casesChartData} />

      {/* Tabela ostatniej aktywności */}
      <div
        className="rounded-xl"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          className="px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Ostatnia aktywność
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Klient', 'Typ', 'Status', 'Data'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left font-medium"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentActivity.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-8 text-center text-sm"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    Brak aktywności
                  </td>
                </tr>
              ) : (
                recentActivity.map((item, idx) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: idx < recentActivity.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <td className="px-5 py-3 font-medium" style={{ color: 'var(--text)' }}>
                      {item.name}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor:
                            item.type === 'Transakcja'
                              ? 'rgba(79, 110, 247, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                          color:
                            item.type === 'Transakcja' ? 'var(--accent)' : 'var(--warning)',
                        }}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>
                      {item.status}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-dim)' }}>
                      {formatRelative(item.date)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
