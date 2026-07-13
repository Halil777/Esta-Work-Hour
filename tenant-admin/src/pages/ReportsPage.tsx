import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileSpreadsheet, Mail, Search, Calendar, Users, ChevronDown,
  RefreshCw, Settings2, Clock, ToggleLeft, ToggleRight,
  Plus, X, CheckSquare, Square, TrendingUp, BarChart3, Download,
} from 'lucide-react'
import { reportConfigApi, reportsApi, type MonthlySchedule } from '../api/reportConfig'
import { apiFetch } from '../api/http'
import type { WorkerApi } from '../api/workers'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  if (!ms || ms <= 0) return '—'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return m > 0 ? `${h} sag ${m} min` : `${h} sag`
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function monthStart(offsetMonths = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offsetMonths)
  return d.toISOString().split('T')[0]
}

function monthEnd(offsetMonths = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offsetMonths + 1)
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

// ─── WorkerMultiSelect ────────────────────────────────────────────────────────

interface WorkerMultiSelectProps {
  workers: WorkerApi[]
  selected: string[]          // workerId values
  onChange: (ids: string[]) => void
}

function WorkerMultiSelect({ workers, selected, onChange }: WorkerMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = workers.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.workerId.includes(search),
  )

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  const selectAll = () => onChange(workers.map(w => w.workerId))
  const clearAll = () => onChange([])

  const label = selected.length === 0
    ? 'Ähli işçiler'
    : selected.length === 1
      ? workers.find(w => w.workerId === selected[0])?.name ?? selected[0]
      : `${selected.length} işçi saýlanydy`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8,
          background: '#fff', cursor: 'pointer', width: '100%', minWidth: 220,
          fontSize: 13, color: selected.length > 0 ? '#1e3a5f' : '#6b7280',
          fontWeight: selected.length > 0 ? 600 : 400,
        }}
      >
        <Users size={14} color="#64748b" />
        <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
        {selected.length > 0 && (
          <span style={{
            background: '#1e3a5f', color: '#fff', borderRadius: 99,
            padding: '1px 7px', fontSize: 11, fontWeight: 700,
          }}>{selected.length}</span>
        )}
        <ChevronDown size={14} color="#64748b" />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 1000,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 320, padding: 10,
        }}>
          {/* search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 7, marginBottom: 8 }}>
            <Search size={13} color="#94a3b8" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Gözle..."
              style={{ border: 'none', outline: 'none', fontSize: 12, flex: 1 }}
            />
          </div>

          {/* select/clear all */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button type="button" onClick={selectAll} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11, cursor: 'pointer', color: '#374151' }}>Hemmesini saýla</button>
            <button type="button" onClick={clearAll} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11, cursor: 'pointer', color: '#374151' }}>Arassala</button>
          </div>

          {/* list */}
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.map(w => {
              const checked = selected.includes(w.workerId)
              return (
                <div
                  key={w.id}
                  onClick={() => toggle(w.workerId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                    background: checked ? '#eff6ff' : 'transparent',
                  }}
                >
                  {checked ? <CheckSquare size={14} color="#1d4ed8" /> : <Square size={14} color="#94a3b8" />}
                  <span style={{ fontSize: 12, flex: 1, color: '#1e293b' }}>{w.name}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>{w.workerId}</span>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: 16, fontSize: 12 }}>Tapylmady</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const qc = useQueryClient()

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(monthStart(0))
  const [endDate, setEndDate] = useState(monthEnd(0))
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'report' | 'auto'>('report')

  // ── Monthly config local state ────────────────────────────────────────────────
  const [monthly, setMonthly] = useState<MonthlySchedule>({
    enabled: false, time: '08:00', emails: [], lastSentMonth: null,
  })
  const [newMonthlyEmail, setNewMonthlyEmail] = useState('')

  // ── Queries ───────────────────────────────────────────────────────────────────
  const { data: workers = [] } = useQuery<WorkerApi[]>({
    queryKey: ['workers-all'],
    queryFn: () => apiFetch<WorkerApi[]>('/workers?status=Active'),
    staleTime: 60_000,
  })

  const { data: cfgData } = useQuery({
    queryKey: ['report-config'],
    queryFn: () => reportConfigApi.getConfig(),
  })

  const [rangeQueried, setRangeQueried] = useState(false)
  const { data: rangeData, isFetching: isFetchingRange, refetch: fetchRange } = useQuery({
    queryKey: ['range-data', startDate, endDate, selectedWorkerIds.join(',')],
    queryFn: () => reportsApi.getRangeData(startDate, endDate, selectedWorkerIds.length > 0 ? selectedWorkerIds : undefined),
    enabled: false,
  })

  // Sync monthly config from server
  useEffect(() => {
    if (cfgData?.monthlySchedule) {
      setMonthly(cfgData.monthlySchedule)
    }
  }, [cfgData])

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const saveCfgMut = useMutation({
    mutationFn: () =>
      reportConfigApi.saveAll(
        cfgData?.emails ?? [],
        cfgData?.schedules ?? [],
        monthly,
      ),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['report-config'] }); alert('Awtomatik hasabat sazlamalary saklandy!') },
    onError: (e: Error) => alert(`Ýalňyşlyk: ${e.message}`),
  })

  const [sendingEmail, setSendingEmail] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const handlePreview = useCallback(async () => {
    setRangeQueried(true)
    await fetchRange()
  }, [fetchRange])

  const handleDownloadXlsx = useCallback(async () => {
    setDownloading(true)
    try {
      await reportsApi.downloadRangeXlsx(
        startDate, endDate,
        selectedWorkerIds.length > 0 ? selectedWorkerIds : undefined,
      )
    } catch (e: any) {
      alert(`Ýükläp bolmady: ${e.message}`)
    } finally {
      setDownloading(false)
    }
  }, [startDate, endDate, selectedWorkerIds])

  const handleSendEmail = useCallback(async () => {
    setSendingEmail(true)
    try {
      const res = await reportConfigApi.sendRange(
        startDate, endDate,
        selectedWorkerIds.length > 0 ? selectedWorkerIds : undefined,
      )
      alert(res.message ?? 'Hasabat iberildi!')
    } catch (e: any) {
      alert(`Iberilemedi: ${e.message}`)
    } finally {
      setSendingEmail(false)
    }
  }, [startDate, endDate, selectedWorkerIds])

  // ── Monthly email helpers ─────────────────────────────────────────────────────
  const addMonthlyEmail = () => {
    const v = newMonthlyEmail.trim()
    if (!v || !v.includes('@')) return
    if (!monthly.emails.includes(v)) setMonthly(m => ({ ...m, emails: [...m.emails, v] }))
    setNewMonthlyEmail('')
  }

  const removeMonthlyEmail = (email: string) => {
    setMonthly(m => ({ ...m, emails: m.emails.filter(e => e !== email) }))
  }

  // ── Quick presets ─────────────────────────────────────────────────────────────
  const presets = [
    { label: 'Bu aý', sd: monthStart(0), ed: monthEnd(0) },
    { label: 'Geçen aý', sd: monthStart(-1), ed: monthEnd(-1) },
    { label: 'Bu ýyl', sd: `${new Date().getFullYear()}-01-01`, ed: today() },
    { label: 'Bu hepde', sd: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().split('T')[0] })(), ed: today() },
  ]

  // ── Stats banner ──────────────────────────────────────────────────────────────
  const totalMs = rangeData?.totalMs ?? 0
  const totalWorkers = rangeData?.totalWorkers ?? 0
  const workedWorkers = rangeData?.rows.filter(r => r.totalMs > 0).length ?? 0
  const avgMs = workedWorkers > 0 ? Math.floor(totalMs / workedWorkers) : 0

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e3a5f' }}>İş Sagatlaryny Hasabat</h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
          Döwür boýunça işçileriň is sagatlaryny görüň, Excel ýükläň ýa-da email iberiň
        </p>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #e2e8f0' }}>
        {([
          { key: 'report', icon: BarChart3, label: 'Hasabat Al' },
          { key: 'auto', icon: Settings2, label: 'Awtomatik Hasabat' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', border: 'none', cursor: 'pointer',
              background: 'none', fontSize: 13, fontWeight: 600,
              color: activeTab === tab.key ? '#1e3a5f' : '#64748b',
              borderBottom: activeTab === tab.key ? '2px solid #1e3a5f' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — REPORT
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'report' && (
        <>
          {/* ── Filter card ────────────────────────────────────────────── */}
          <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
            padding: '20px 24px', marginBottom: 20,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={15} color="#1e3a5f" /> Döwür saýla
            </div>

            {/* Quick presets */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {presets.map(p => (
                <button
                  key={p.label}
                  onClick={() => { setStartDate(p.sd); setEndDate(p.ed) }}
                  style={{
                    padding: '5px 14px', borderRadius: 99, border: '1px solid #d1d5db',
                    background: startDate === p.sd && endDate === p.ed ? '#1e3a5f' : '#f8fafc',
                    color: startDate === p.sd && endDate === p.ed ? '#fff' : '#374151',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date inputs + worker filter */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 600 }}>Başlangyç</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 600 }}>Soňy</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 600 }}>İşçi filteri</label>
                <WorkerMultiSelect
                  workers={workers}
                  selected={selectedWorkerIds}
                  onChange={setSelectedWorkerIds}
                />
              </div>
              <button
                onClick={handlePreview}
                disabled={isFetchingRange}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 20px', borderRadius: 8, border: 'none',
                  background: '#1e3a5f', color: '#fff', fontWeight: 600,
                  fontSize: 13, cursor: 'pointer', height: 38,
                }}
              >
                {isFetchingRange ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
                Görkez
              </button>
            </div>
          </div>

          {/* ── Stats banner ────────────────────────────────────────────── */}
          {rangeQueried && rangeData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Jemi işçi', value: totalWorkers, color: '#1d4ed8', bg: '#eff6ff', icon: Users },
                { label: 'İşlän işçi', value: workedWorkers, color: '#16a34a', bg: '#f0fdf4', icon: TrendingUp },
                { label: 'Jemi sagat', value: fmtMs(totalMs), color: '#4f46e5', bg: '#eef2ff', icon: Clock },
                { label: 'Ortaça (işçi başyna)', value: fmtMs(avgMs), color: '#b45309', bg: '#fef9c3', icon: BarChart3 },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <s.icon size={22} color={s.color} />
                  <div>
                    <div style={{ fontSize: typeof s.value === 'number' ? 22 : 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Action buttons ───────────────────────────────────────────── */}
          {rangeQueried && rangeData && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button
                onClick={handleDownloadXlsx}
                disabled={downloading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 22px', borderRadius: 8, border: 'none',
                  background: '#16a34a', color: '#fff', fontWeight: 600,
                  fontSize: 13, cursor: 'pointer',
                }}
              >
                {downloading
                  ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Download size={14} />}
                Excel Ýükle (.xlsx)
              </button>

              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 22px', borderRadius: 8, border: '1px solid #3b82f6',
                  background: '#eff6ff', color: '#1d4ed8', fontWeight: 600,
                  fontSize: 13, cursor: 'pointer',
                }}
              >
                {sendingEmail
                  ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Mail size={14} />}
                E-mail Ugrat
              </button>
            </div>
          )}

          {/* ── Results table ────────────────────────────────────────────── */}
          {rangeQueried && (
            <div style={{
              background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
              overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              {isFetchingRange ? (
                <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite' }} />
                  <div style={{ marginTop: 8 }}>Hasabat taýarlanýar...</div>
                </div>
              ) : rangeData && rangeData.rows.length > 0 ? (
                <>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#1e3a5f' }}>
                      Netijeler — {rangeData.startDate} — {rangeData.endDate}
                    </span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{rangeData.rows.length} işçi</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['#', 'İşçi adı', 'Sicil No', 'Görev', 'Ekip', 'İşlän gün', 'Jemi sagat', 'Ortaça gün'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rangeData.rows.map((row, i) => {
                        const avgDay = row.daysPresent > 0 ? Math.floor(row.totalMs / row.daysPresent) : 0
                        return (
                          <tr key={row.workerId} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '9px 14px', fontSize: 12, color: '#94a3b8' }}>{i + 1}</td>
                            <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{row.name}</td>
                            <td style={{ padding: '9px 14px', fontSize: 12, color: '#64748b' }}>{row.workerId}</td>
                            <td style={{ padding: '9px 14px', fontSize: 12, color: '#64748b' }}>{row.profession || '—'}</td>
                            <td style={{ padding: '9px 14px', fontSize: 12, color: '#64748b' }}>{row.brigade || '—'}</td>
                            <td style={{ padding: '9px 14px', fontSize: 12, textAlign: 'center' }}>
                              {row.daysPresent > 0
                                ? <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 99, padding: '2px 10px', fontWeight: 600, fontSize: 12 }}>{row.daysPresent} gün</span>
                                : <span style={{ color: '#ef4444', fontSize: 12 }}>—</span>}
                            </td>
                            <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 700, color: row.totalMs > 0 ? '#1e3a5f' : '#ef4444' }}>
                              {fmtMs(row.totalMs)}
                            </td>
                            <td style={{ padding: '9px 14px', fontSize: 12, color: '#64748b' }}>{fmtMs(avgDay)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </>
              ) : (
                <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  Bu döwürde maglumat ýok
                </div>
              )}
            </div>
          )}

          {!rangeQueried && (
            <div style={{
              background: '#f8fafc', borderRadius: 12, border: '2px dashed #e2e8f0',
              padding: 48, textAlign: 'center', color: '#94a3b8',
            }}>
              <FileSpreadsheet size={40} color="#cbd5e1" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Döwür saýlap "Görkez" düwmesine basyň</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Excel ýüklemek ýa-da email ibermek üçin öňünden görkezme gerek</div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — AUTO MONTHLY REPORT
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'auto' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Monthly auto-send card */}
          <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
            padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1e3a5f', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={17} color="#1e3a5f" />
                  Aýlyk Awtomatik Hasabat
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Her ayın 1-inde geçen ayın iş sagatlaryny awtomatik usulda email iberer
                </div>
              </div>
              <button
                onClick={() => setMonthly(m => ({ ...m, enabled: !m.enabled }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                title={monthly.enabled ? 'Öçür' : 'Aç'}
              >
                {monthly.enabled
                  ? <ToggleRight size={36} color="#16a34a" />
                  : <ToggleLeft size={36} color="#94a3b8" />}
              </button>
            </div>

            {/* Status badge */}
            <div style={{ marginBottom: 20 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                background: monthly.enabled ? '#f0fdf4' : '#f8fafc',
                color: monthly.enabled ? '#16a34a' : '#94a3b8',
                border: `1px solid ${monthly.enabled ? '#bbf7d0' : '#e2e8f0'}`,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: monthly.enabled ? '#16a34a' : '#94a3b8', display: 'inline-block' }} />
                {monthly.enabled ? 'Işjeň' : 'Öçürilen'}
              </span>
              {monthly.lastSentMonth && (
                <span style={{ marginLeft: 10, fontSize: 11, color: '#94a3b8' }}>
                  Soňky iberilen: {monthly.lastSentMonth}
                </span>
              )}
            </div>

            {/* Send time */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                <Clock size={13} style={{ marginRight: 4 }} />
                Iberilmeli wagt (her ayın 1-inde)
              </label>
              <input
                type="time"
                value={monthly.time}
                onChange={e => setMonthly(m => ({ ...m, time: e.target.value }))}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#1e3a5f' }}
              />
            </div>

            {/* Email list */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                <Mail size={13} style={{ marginRight: 4 }} />
                Email alyjylar (boş bolsa umumy email sanawyny ulanar)
              </label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="email"
                  value={newMonthlyEmail}
                  onChange={e => setNewMonthlyEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addMonthlyEmail()}
                  placeholder="email@mysal.com"
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
                />
                <button
                  onClick={addMonthlyEmail}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} /> Goş
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {monthly.emails.map(email => (
                  <span key={email} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 99,
                    padding: '4px 12px', fontSize: 12, color: '#1d4ed8',
                  }}>
                    {email}
                    <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeMonthlyEmail(email)} />
                  </span>
                ))}
                {monthly.emails.length === 0 && (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Email goşulmadyk — umumy sanaw ulanylar</span>
                )}
              </div>
            </div>

            <button
              onClick={() => saveCfgMut.mutate()}
              disabled={saveCfgMut.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: '#1e3a5f', color: '#fff', fontWeight: 700,
                fontSize: 13, cursor: 'pointer',
              }}
            >
              {saveCfgMut.isPending ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              Sakla
            </button>
          </div>

          {/* Info card */}
          <div style={{
            background: '#fefce8', borderRadius: 10, border: '1px solid #fef08a',
            padding: '16px 20px', fontSize: 12, color: '#92400e',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <div style={{ fontSize: 20 }}>ℹ️</div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Nähili işleýär?</div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>Her ayın 1-inde bellenen sagatda (server wagty) hasabat awtomatik iberilýär</li>
                <li>Hasabatda geçen ayın ähli işçileriniň jemi iş sagatlary bolýar</li>
                <li>Excel faýly hem email goşundysy hökmünde goşulýar</li>
                <li>Hasabat iberilen soň, täzeden iberilmez (bir gezek iberilýär)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* spin animation */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default ReportsPage
