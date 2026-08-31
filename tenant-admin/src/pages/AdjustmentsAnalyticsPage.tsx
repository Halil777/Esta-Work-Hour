import { useState, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, GitCompareArrows,
  Users, ListChecks, ExternalLink, RotateCcw,
} from 'lucide-react'
import { adjustmentsApi, type AdjustmentAnalyticsWorker } from '../api/workTime'

function fmtMins(ms: number): string {
  const sign = ms < 0 ? '-' : ''
  const a = Math.abs(ms)
  const totalMin = Math.round(a / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0 && m === 0) return '—'
  return m > 0 ? `${sign}${h}s ${m}dk` : `${sign}${h}s`
}

function todayStr(): string {
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function monthsAgoStr(n: number): string {
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000)
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 10)
}

type RangeMode = 'all' | '30d' | '90d' | 'custom'

export function AdjustmentsAnalyticsPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<RangeMode>('all')
  const [customStart, setCustomStart] = useState(monthsAgoStr(1))
  const [customEnd, setCustomEnd] = useState(todayStr())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const { startDate, endDate } = useMemo(() => {
    if (mode === 'all') return { startDate: undefined, endDate: undefined }
    if (mode === '30d') return { startDate: monthsAgoStr(1), endDate: todayStr() }
    if (mode === '90d') return { startDate: monthsAgoStr(3), endDate: todayStr() }
    return { startDate: customStart, endDate: customEnd }
  }, [mode, customStart, customEnd])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['adjustments-analytics', startDate, endDate],
    queryFn: () => adjustmentsApi.getAnalytics(startDate, endDate),
  })

  const workers = data?.workers ?? []
  const filtered = search
    ? workers.filter(w => w.name.toLowerCase().includes(search.toLowerCase()) || w.workerId.includes(search))
    : workers

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const s = data?.summary

  const kpis = [
    { label: 'JEMI ÜÝTGETME', value: String(s?.totalAdjustments ?? 0), icon: ListChecks, color: 'var(--accent)' },
    { label: 'TÄSIR ESEN IŞÇI', value: String(s?.workersAffected ?? 0), icon: Users, color: 'var(--accent)' },
    { label: 'GOŞULAN SAGAT', value: fmtMins(s?.totalIncreaseMs ?? 0), icon: TrendingUp, color: 'var(--green)' },
    { label: 'AZALDYLAN SAGAT', value: fmtMins(-(s?.totalDecreaseMs ?? 0)), icon: TrendingDown, color: 'var(--red)' },
    { label: 'ARASSA TAPAWUT', value: fmtMins(s?.netDiffMs ?? 0), icon: GitCompareArrows, color: (s?.netDiffMs ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Sagat Üýtgetmeleri — Analitika</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13, maxWidth: 640 }}>
            Admin tarapyndan haýsy işçä, haýsy güne, näçe sagatdan näçe sagada üýtgedilendigi we hakyky scan wagtyndan
            näçe tapawut edilendigi — artan (mesaý ýaly) ýa-da azaldylan tarapa.
          </p>
        </div>
        <button onClick={() => navigate('/work-time')} className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ExternalLink size={14} />
          Iş Wagtyna Gaýt
        </button>
      </div>

      {/* Range filter */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20,
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px',
      }}>
        {([
          ['all', 'Şu wagta çenli'],
          ['30d', 'Soňky 30 gün'],
          ['90d', 'Soňky 90 gün'],
          ['custom', 'Aralyk saýla'],
        ] as [RangeMode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={mode === m ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ fontSize: 12.5, padding: '6px 14px' }}
          >
            {label}
          </button>
        ))}
        {mode === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 6 }}>
            <input type="date" value={customStart} max={customEnd} onChange={e => setCustomStart(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
            <input type="date" value={customEnd} min={customStart} max={todayStr()} onChange={e => setCustomEnd(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }} />
          </div>
        )}
        <button onClick={() => refetch()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: 'auto', color: 'var(--text-muted)' }} title="Täzele">
          <RotateCcw size={14} />
        </button>
      </div>

      {/* KPI band */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 22 }}>
        {kpis.map(kpi => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Icon size={14} color={kpi.color} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.4 }}>{kpi.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            </div>
          )
        })}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          placeholder="At ýa-da sicil belgisi boýunça gözle..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', maxWidth: 320, padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13,
          }}
        />
      </div>

      {/* Worker table */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Ýüklenýär...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--red)' }}>{(error as Error).message}</div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 48, color: 'var(--text-muted)',
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
        }}>
          Bu aralykda hiç hili üýtgetme tapylmady
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                <th style={{ width: 32 }} />
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>IŞÇI</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>ÜÝTGETME SANY</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>GOŞULAN</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>AZALDYLAN</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>ARASSA TAPAWUT</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((w: AdjustmentAnalyticsWorker) => {
                const isOpen = expanded.has(w.workerEntityId)
                return (
                  <Fragment key={w.workerEntityId}>
                    <tr
                      onClick={() => toggle(w.workerEntityId)}
                      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '12px 8px 12px 16px' }}>
                        {isOpen ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600 }}>{w.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{w.workerId} · {w.profession} · {w.brigade}</div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>{w.adjustmentCount}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>
                        {w.totalIncreaseMs > 0 ? `+${fmtMins(w.totalIncreaseMs)}` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--red)', fontWeight: 600 }}>
                        {w.totalDecreaseMs > 0 ? `-${fmtMins(w.totalDecreaseMs)}` : '—'}
                      </td>
                      <td style={{
                        padding: '12px 14px', textAlign: 'right', fontWeight: 800,
                        color: w.netDiffMs > 0 ? 'var(--green)' : w.netDiffMs < 0 ? 'var(--red)' : 'var(--text-secondary)',
                      }}>
                        {w.netDiffMs > 0 ? '+' : ''}{fmtMins(w.netDiffMs)}
                      </td>
                      <td style={{ padding: '12px 16px 12px 8px', textAlign: 'center' }}>
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/work-time/${w.workerEntityId}`) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }}
                          title="Aýlyk tablisany gör"
                        >
                          <ExternalLink size={14} />
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${w.workerEntityId}-detail`}>
                        <td colSpan={7} style={{ padding: 0, background: 'var(--bg-surface)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                            <thead>
                              <tr>
                                <th style={{ padding: '8px 16px 8px 52px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10.5 }}>SENE</th>
                                <th style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10.5 }}>HAKYKY (SCAN)</th>
                                <th style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10.5 }}>HASABA ALYNAN</th>
                                <th style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10.5 }}>TAPAWUT</th>
                                <th style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 10.5 }}>SEBÄBI</th>
                              </tr>
                            </thead>
                            <tbody>
                              {w.days.map(d => (
                                <tr key={d.date} style={{ borderTop: '1px solid var(--border)' }}>
                                  <td style={{ padding: '8px 16px 8px 52px', fontFamily: 'monospace', fontSize: 12 }}>{d.date}</td>
                                  <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtMins(d.actualMs)}</td>
                                  <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700 }}>{fmtMins(d.creditedMs)}</td>
                                  <td style={{
                                    padding: '8px 14px', textAlign: 'right', fontWeight: 700,
                                    color: d.diffMs > 0 ? 'var(--green)' : d.diffMs < 0 ? 'var(--red)' : 'var(--text-muted)',
                                  }}>
                                    {d.diffMs > 0 ? '+' : ''}{fmtMins(d.diffMs)}
                                  </td>
                                  <td style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>
                                    {d.adjustments.map(a => a.reasonLabel || a.description || a.adjustmentType).join(', ')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
