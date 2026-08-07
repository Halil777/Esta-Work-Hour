import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import {
  Building2, Users, UserCheck, TrendingUp, RefreshCw,
  Activity, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react'
import { superAdminApi, type SuperAdminStats } from '../api/superAdminApi'
import { useUiPreferences } from '../app/providers/useUiPreferences'

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function timeSince(isoStr: string | null): string {
  if (!isoStr) return '—'
  const diff = Date.now() - new Date(isoStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const PIE_COLORS = ['#22C55E', '#EF4444']

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color, bg,
}: {
  icon: React.ElementType; label: string; value: number | string
  sub?: string; color: string; bg: string
}) {
  return (
    <div style={{
      background: 'var(--bg-surface)', borderRadius: 12, padding: '20px 24px',
      border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={color} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Attendance rate progress bar ─────────────────────────────────────────────

function AttendanceBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99 }}>
        <div style={{
          width: `${Math.min(pct, 100)}%`, height: '100%',
          background: color, borderRadius: 99, transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 34, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  )
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 8 }}>
          <span>{p.name}:</span><strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { theme } = useUiPreferences()
  const [stats, setStats] = useState<SuperAdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setStats(await superAdminApi.stats())
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  const axisColor = 'var(--text-muted)'
  const tooltipBg = theme === 'dark' ? '#1A2335' : '#fff'

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: 'var(--danger)' }}>
      <AlertCircle size={16} /> {error}
      <button className="btn btn--sm btn--secondary" onClick={load} style={{ marginLeft: 8 }}>Retry</button>
    </div>
  )

  // Derived data
  const tenantBarData = stats?.tenants.map(t => ({
    name: t.tenantName.length > 14 ? t.tenantName.slice(0, 14) + '…' : t.tenantName,
    'Jemi Işçi': t.totalWorkers,
    'Aktif Işçi': t.activeWorkers,
    'Geldi': t.checkedInToday,
  })) ?? []

  const trendData = stats?.trend7d.map(d => ({
    date: fmtDate(d.date),
    'Skanlar': d.scans,
    'Işçi': d.workers,
  })) ?? []

  const pieData = stats ? [
    { name: 'Aktif', value: stats.activeTenants },
    { name: 'Deaktif', value: stats.totalTenants - stats.activeTenants },
  ] : []

  const todayRate = stats && stats.activeWorkers > 0
    ? Math.round((stats.checkedInToday / stats.activeWorkers) * 100) : 0

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Soňky täzelenme: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn--secondary btn--sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Täzele
          </button>
        </div>
      </div>

      {loading && !stats ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-muted)', gap: 8 }}>
          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Ýüklenýär…
        </div>
      ) : (
        <>
          {/* ── Stat cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            <StatCard
              icon={Building2} label="Jemi Tenantlar"
              value={stats?.totalTenants ?? 0}
              sub={`${stats?.activeTenants ?? 0} aktif`}
              color="var(--primary-text)" bg="var(--primary-light)"
            />
            <StatCard
              icon={Users} label="Jemi Işçiler"
              value={stats?.totalWorkers ?? 0}
              sub={`${stats?.activeWorkers ?? 0} aktif`}
              color="var(--info)" bg="var(--info-light)"
            />
            <StatCard
              icon={UserCheck} label="Şu Gün Gelenler"
              value={stats?.checkedInToday ?? 0}
              sub={`Gatnaşyk: ${todayRate}%`}
              color="var(--success)" bg="var(--success-light)"
            />
            <StatCard
              icon={TrendingUp} label="7 Günlük Skanlar"
              value={stats?.trend7d.reduce((s, d) => s + d.scans, 0) ?? 0}
              sub={`Ortaça: ${stats?.trend7d.length ? Math.round((stats.trend7d.reduce((s, d) => s + d.scans, 0)) / stats.trend7d.length) : 0}/gün`}
              color="var(--warning)" bg="var(--warning-light)"
            />
          </div>

          {/* ── Charts row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 220px', gap: 16, marginBottom: 20 }}>

            {/* Tenant workers bar chart */}
            <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px 8px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Tenant Deňeşdirmesi</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Işçi sany we gatnaşyk</div>
              </div>
              <div style={{ padding: '12px 8px 8px' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={tenantBarData} barSize={9} barCategoryGap="28%">
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="Jemi Işçi" fill="#6366F1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Aktif Işçi" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Geldi" fill="#22C55E" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 7-day trend line chart */}
            <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px 8px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>7 Günlük Gatnaşyk Tendensiýasy</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Skan we işçi sanawlygy</div>
              </div>
              <div style={{ padding: '12px 8px 8px' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Line dataKey="Skanlar" stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line dataKey="Işçi" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tenant active/inactive pie */}
            <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px 8px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Tenant Statusy</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Aktif / deaktif paýy</div>
              </div>
              <div style={{ padding: '12px 8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: tooltipBg, border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  {pieData.map((d, i) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 99, background: PIE_COLORS[i] }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                      <strong style={{ color: 'var(--text)' }}>{d.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Per-tenant detail table ── */}
          <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Tenant Jikme-Jik Maglumatlary</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Hakyky döwürleýin maglumatlary — {stats?.tenants.length ?? 0} tenant
                </div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-2)' }}>
                    {['Tenant', 'Status', 'Jemi Işçi', 'Aktif Işçi', 'Şu Gün Geldi', 'Gatnaşyk', 'Soňky Aktiw'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(stats?.tenants ?? []).map((t, i) => {
                    const rate = t.activeWorkers > 0 ? Math.round((t.checkedInToday / t.activeWorkers) * 100) : 0
                    return (
                      <tr key={t.tenantId} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-hover)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 8,
                              background: 'var(--primary-light)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 700, color: 'var(--primary-text)',
                              flexShrink: 0,
                            }}>
                              {t.tenantName.slice(0, 2).toUpperCase()}
                            </div>
                            {t.tenantName}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: t.isActive ? 'var(--success-light)' : 'var(--danger-light)',
                            color: t.isActive ? 'var(--success)' : 'var(--danger)',
                          }}>
                            {t.isActive ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> Aktif</span> : 'Deaktif'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>{t.totalWorkers}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--info)' }}>{t.activeWorkers}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--success)' }}>{t.checkedInToday}</td>
                        <td style={{ padding: '12px 16px', minWidth: 140 }}>
                          <AttendanceBar pct={rate} />
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Clock size={12} />
                            {timeSince(t.lastActivityAt)}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!stats?.tenants.length && (
                    <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Activity size={28} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.3 }} />
                      Tenant tapylmady
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
