import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { RefreshCw, Building2, Users, UserCheck, TrendingUp, AlertCircle } from 'lucide-react'
import { superAdminApi, type SuperAdminStats } from '../api/superAdminApi'
import { useUiPreferences } from '../app/providers/useUiPreferences'

function AttendanceBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 99 }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 30, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

export function ReportsPage() {
  const { theme } = useUiPreferences()
  const [stats, setStats] = useState<SuperAdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try { setStats(await superAdminApi.stats()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
  const axisColor = 'var(--text-muted)'

  const comparisonData = stats?.tenants.map(t => ({
    name: t.tenantName.length > 12 ? t.tenantName.slice(0, 12) + '…' : t.tenantName,
    'Jemi': t.totalWorkers,
    'Aktif': t.activeWorkers,
    'Geldi': t.checkedInToday,
    rate: t.activeWorkers > 0 ? Math.round((t.checkedInToday / t.activeWorkers) * 100) : 0,
  })) ?? []

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0 }}>Umumy Hasabatlar</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Tenant gatnaşyk statistikasy — hakyky maglumatlar
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn--secondary btn--sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Täzele
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 8, marginBottom: 16 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading && !stats ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: 'var(--text-muted)' }}>
          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Ýüklenýär…
        </div>
      ) : (
        <>
          {/* ── Summary cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { icon: Building2, label: 'Jemi Tenantlar', value: stats?.totalTenants ?? 0, sub: `${stats?.activeTenants} aktif`, color: 'var(--primary-text)', bg: 'var(--primary-light)' },
              { icon: Users,     label: 'Jemi Işçiler',   value: stats?.totalWorkers ?? 0,  sub: `${stats?.activeWorkers} aktif`, color: 'var(--info)',    bg: 'var(--info-light)'    },
              { icon: UserCheck, label: 'Şu Gün Geldi',   value: stats?.checkedInToday ?? 0, sub: 'hakyky', color: 'var(--success)', bg: 'var(--success-light)' },
              { icon: TrendingUp,label: '7 Gün Skan',     value: stats?.trend7d.reduce((s, d) => s + d.scans, 0) ?? 0, sub: 'jemi', color: 'var(--warning)', bg: 'var(--warning-light)' },
            ].map(({ icon: Icon, label, value, sub, color, bg }) => (
              <div key={label} style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '18px 20px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={color} />
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Tenant comparison chart ── */}
          <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Tenant Deňeşdirme Diagrammasy</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Işçi sany, aktif we şu gün gelen</div>
            </div>
            <div style={{ padding: '16px' }}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={comparisonData} barSize={12} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="Jemi" fill="#6366F1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Aktif" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Geldi" fill="#22C55E" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Per-tenant stats table ── */}
          <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Tenant Gatnaşyk Hasabaty</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Hakyky maglumatlar, şu güne degişli</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-2)' }}>
                    {['Tenant', 'Status', 'Jemi Işçi', 'Aktif Işçi', 'Şu Gün Geldi', 'Gatnaşyk %', 'Potensiýal (Aktif)', 'Soňky Aktiw'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(stats?.tenants ?? []).sort((a, b) => b.checkedInToday - a.checkedInToday).map((t, i) => {
                    const rate = t.activeWorkers > 0 ? Math.round((t.checkedInToday / t.activeWorkers) * 100) : 0
                    const absent = t.activeWorkers - t.checkedInToday
                    const lastDate = t.lastActivityAt ? new Date(t.lastActivityAt).toLocaleDateString('ru-RU') : '—'
                    return (
                      <tr key={t.tenantId} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-hover)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--primary-text)', flexShrink: 0 }}>
                              {t.tenantName.slice(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600 }}>{t.tenantName}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: t.isActive ? 'var(--success-light)' : 'var(--danger-light)', color: t.isActive ? 'var(--success)' : 'var(--danger)' }}>
                            {t.isActive ? 'Aktif' : 'Deaktif'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{t.totalWorkers}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--info)' }}>{t.activeWorkers}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--success)' }}>{t.checkedInToday}</td>
                        <td style={{ padding: '12px 16px', minWidth: 160 }}><AttendanceBar pct={rate} /></td>
                        <td style={{ padding: '12px 16px', color: 'var(--danger)', fontSize: 12 }}>
                          {absent > 0 ? `${absent} işçi gelmedi` : <span style={{ color: 'var(--success)' }}>Hemmesi geldi</span>}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{lastDate}</td>
                      </tr>
                    )
                  })}
                  {!stats?.tenants.length && (
                    <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Maglumat tapylmady</td></tr>
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
