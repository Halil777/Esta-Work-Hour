import { useRef, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import {
  Users, UserCheck, UserX, Clock, ChevronRight, AlertTriangle,
  FileDown, Gauge, CalendarDays, Activity, Download, Mail, Plus, X,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { workersApi } from '../api/workers'
import { extraHoursApi } from '../api/extraHours'
import { auditLogApi } from '../api/auditLog'
import { attendanceApi } from '../api/attendance'
import { analyticsApi } from '../api/analyticsApi'
import { apiFetch } from '../api/http'

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ value, label, sub, icon, color, bg, onClick }: {
  value: string | number; label: string; sub?: string
  icon: React.ReactNode; color: string; bg: string
  onClick?: () => void
}) {
  return (
    <div className="stat-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="stat-card__header">
        <div className="stat-card__icon" style={{ background: bg }}>
          <span style={{ color }}>{icon}</span>
        </div>
        {onClick && <ChevronRight size={14} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />}
      </div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </div>
  )
}

// ─── Daily PDF download (existing) ──────────────────────────────────────────

function downloadDailyPdf(date: string) {
  const token = localStorage.getItem('adminJwt') ?? ''
  fetch(`/api/reports/daily?date=${date}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then(r => { if (!r.ok) throw new Error(`PDF ýüklenip bilinmedi: ${r.status}`); return r.blob() })
    .then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `daily-report-${date}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
    .catch(err => alert(err.message))
}

// ─── Export helpers ────────────────────────────────────────────────────────────

async function exportAsPng(el: HTMLElement, filename: string) {
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  const link = document.createElement('a')
  link.download = filename
  link.href = canvas.toDataURL('image/png')
  link.click()
}

async function exportAsPdf(
  el: HTMLElement,
  filename: string,
  tenantName: string,
  startDate: string,
  endDate: string,
) {
  const { default: html2canvas } = await import('html2canvas')
  const { jsPDF } = await import('jspdf')
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  const imgData = canvas.toDataURL('image/png')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFontSize(18)
  doc.setTextColor(99, 102, 241)
  doc.text(tenantName, 14, 16)
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text(`Dashboard Report · ${startDate} – ${endDate}`, 14, 23)
  doc.setTextColor(0)
  const pw = doc.internal.pageSize.getWidth()
  const iw = pw - 28
  const ih = (canvas.height / canvas.width) * iw
  doc.addImage(imgData, 'PNG', 14, 28, iw, ih)
  doc.save(filename)
}

function exportAsXlsx(
  chartData: { date: string; present: number; absent: number; total: number }[],
  topWorkers: { name: string; totalHours: number; daysPresent: number }[],
  tenantName: string,
  startDate: string,
  endDate: string,
) {
  import('xlsx').then(XLSX => {
    const wb = XLSX.utils.book_new()

    const attendanceRows = [
      [`${tenantName} — Dashboard Report`],
      [`Period: ${startDate} — ${endDate}`],
      [],
      ['Date', 'Present', 'Absent', 'Total'],
      ...chartData.map(r => [r.date, r.present, r.absent, r.total]),
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(attendanceRows)
    ws1['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Attendance')

    const topRows = [
      [`${tenantName} — Top Workers by Hours`],
      [`Period: ${startDate} — ${endDate}`],
      [],
      ['#', 'Worker', 'Total Hours', 'Days Present'],
      ...topWorkers.map((w, i) => [i + 1, w.name, w.totalHours, w.daysPresent]),
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(topRows)
    ws2['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Top Workers')

    XLSX.writeFile(wb, `dashboard-${startDate}-${endDate}.xlsx`)
  })
}

// ─── Custom tooltip for recharts ─────────────────────────────────────────────

function AttendanceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 13,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.fill, display: 'flex', gap: 8 }}>
          <span>{p.name}:</span><strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ─── Dashboard schedule sub-component ────────────────────────────────────────

function DashboardScheduleCard({
  startDate, endDate,
}: { startDate: string; endDate: string; tenantName: string }) {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['dashboard-schedule'],
    queryFn: analyticsApi.getDashboardSchedule,
    staleTime: 60_000,
  })

  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [emails, setEmails] = useState<string[] | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const eff = {
    enabled: enabled ?? schedule?.enabled ?? false,
    time: time ?? schedule?.time ?? '08:00',
    emails: emails ?? schedule?.emails ?? [],
  }

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const saveMut = useMutation({
    mutationFn: () => analyticsApi.updateDashboardSchedule(eff),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dashboard-schedule'] }); showToast(t.analytics.saveSuccess, true) },
    onError: () => showToast(t.analytics.sendError, false),
  })

  const sendNowMut = useMutation({
    mutationFn: () => analyticsApi.sendDashboardNow({ startDate, endDate, emails: eff.emails }),
    onSuccess: () => showToast(t.analytics.sendSuccess, true),
    onError: () => showToast(t.analytics.sendError, false),
  })

  const addEmail = () => {
    const e = newEmail.trim()
    if (!e || !e.includes('@')) return
    setEmails([...eff.emails, e])
    setNewEmail('')
  }

  const removeEmail = (idx: number) => setEmails(eff.emails.filter((_, i) => i !== idx))

  if (isLoading) return null

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-header">
        <Mail size={16} style={{ color: 'var(--primary)' }} />
        <h3 style={{ margin: 0 }}>{t.analytics.scheduleTitle}</h3>
      </div>
      <div className="card-body" style={{ padding: '16px 20px' }}>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>{t.analytics.scheduleDesc}</p>

        {toast && (
          <div style={{
            padding: '8px 14px', borderRadius: 6, marginBottom: 14, fontSize: 13, fontWeight: 600,
            background: toast.ok ? 'var(--success-light)' : 'var(--danger-light)',
            color: toast.ok ? 'var(--success)' : 'var(--danger)',
          }}>{toast.msg}</div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={eff.enabled}
            onChange={e => setEnabled(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{t.analytics.scheduleEnabled}</span>
        </label>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {t.analytics.scheduleTime}
            </span>
            <input
              type="time"
              value={eff.time}
              onChange={e => setTime(e.target.value)}
              className="input"
              style={{ width: 120 }}
            />
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            {t.analytics.scheduleEmails}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {eff.emails.map((em, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'var(--primary-light)', color: 'var(--primary-text)',
                padding: '4px 10px', borderRadius: 20, fontSize: 13,
              }}>
                {em}
                <button onClick={() => removeEmail(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--text-muted)' }}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEmail()}
              placeholder={t.analytics.emailPlaceholder}
              className="input"
              style={{ flex: 1, maxWidth: 280 }}
            />
            <button className="btn btn--secondary btn--sm" onClick={addEmail}>
              <Plus size={14} /> {t.analytics.addEmail}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? t.common.saving : t.analytics.saveSchedule}
          </button>
          <button
            className="btn btn--secondary btn--sm"
            onClick={() => sendNowMut.mutate()}
            disabled={sendNowMut.isPending}
          >
            <Mail size={14} />
            {sendNowMut.isPending ? t.analytics.exporting : t.analytics.sendNow}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Analytics section ─────────────────────────────────────────────────────────

function AnalyticsSection({ tenantName }: { tenantName: string }) {
  const { t } = useTranslation()

  const defaultEnd   = new Date().toISOString().split('T')[0]
  const defaultStart = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0] })()

  const [startInput, setStartInput] = useState(defaultStart)
  const [endInput,   setEndInput]   = useState(defaultEnd)
  const [startDate,  setStartDate]  = useState(defaultStart)
  const [endDate,    setEndDate]    = useState(defaultEnd)
  const [exporting,  setExporting]  = useState<string | null>(null)
  const chartsRef = useRef<HTMLDivElement>(null)

  const { data: chartData = [], isFetching: chartLoading } = useQuery({
    queryKey: ['analytics-chart', startDate, endDate],
    queryFn: () => analyticsApi.getAttendanceChart(startDate, endDate),
    staleTime: 60_000,
  })

  const { data: topWorkers = [], isFetching: topLoading } = useQuery({
    queryKey: ['analytics-top', startDate, endDate],
    queryFn: () => analyticsApi.getTopWorkers(startDate, endDate),
    staleTime: 60_000,
  })

  const handleApply = useCallback(() => {
    setStartDate(startInput)
    setEndDate(endInput)
  }, [startInput, endInput])

  const handlePng = async () => {
    if (!chartsRef.current) return
    setExporting('png')
    try { await exportAsPng(chartsRef.current, `dashboard-${startDate}-${endDate}.png`) }
    finally { setExporting(null) }
  }

  const handlePdf = async () => {
    if (!chartsRef.current) return
    setExporting('pdf')
    try { await exportAsPdf(chartsRef.current, `dashboard-${startDate}-${endDate}.pdf`, tenantName, startDate, endDate) }
    finally { setExporting(null) }
  }

  const handleXlsx = () => {
    setExporting('xlsx')
    exportAsXlsx(chartData, topWorkers, tenantName, startDate, endDate)
    setTimeout(() => setExporting(null), 1000)
  }

  const isLoading = chartLoading || topLoading

  // Truncate date labels for x-axis
  const fmtDate = (d: string) => d.slice(5) // MM-DD

  return (
    <div className="card" style={{ marginTop: 24 }}>
      {/* Header row */}
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ margin: 0 }}>{t.analytics.title}</h3>

        {/* Date range filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={startInput}
            onChange={e => setStartInput(e.target.value)}
            className="input"
            style={{ padding: '5px 8px', fontSize: 13, width: 140 }}
          />
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <input
            type="date"
            value={endInput}
            onChange={e => setEndInput(e.target.value)}
            className="input"
            style={{ padding: '5px 8px', fontSize: 13, width: 140 }}
          />
          <button className="btn btn--primary btn--sm" onClick={handleApply}>
            {t.analytics.apply}
          </button>
        </div>

        {/* Export buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn--secondary btn--sm" onClick={handlePdf} disabled={!!exporting || isLoading}>
            <Download size={13} />{exporting === 'pdf' ? t.analytics.exporting : t.analytics.exportPdf}
          </button>
          <button className="btn btn--secondary btn--sm" onClick={handlePng} disabled={!!exporting || isLoading}>
            <Download size={13} />{exporting === 'png' ? t.analytics.exporting : t.analytics.exportPng}
          </button>
          <button className="btn btn--secondary btn--sm" onClick={handleXlsx} disabled={!!exporting || isLoading}>
            <FileDown size={13} />{exporting === 'xlsx' ? t.analytics.exporting : t.analytics.exportXlsx}
          </button>
        </div>
      </div>

      {/* Charts */}
      <div ref={chartsRef} className="card-body" style={{ padding: '20px' }}>
        {isLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            {t.analytics.loading}
          </div>
        ) : chartData.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            {t.analytics.noData}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

            {/* Chart 1: Daily Attendance */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--text)' }}>
                {t.analytics.attendanceChart}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip content={<AttendanceTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="present" name={t.analytics.present} fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="absent"  name={t.analytics.absent}  fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2: Top Workers by hours */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--text)' }}>
                {t.analytics.topWorkersChart}
              </div>
              {topWorkers.length === 0 ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  {t.analytics.noData}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    layout="vertical"
                    data={topWorkers}
                    margin={{ top: 4, right: 40, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + '…' : v}
                    />
                    <Tooltip
                      formatter={(val: any) => [`${val}h`, t.analytics.totalHours]}
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                    />
                    <Bar dataKey="totalHours" name={t.analytics.totalHours} radius={[0, 3, 3, 0]}>
                      {topWorkers.map((_, idx) => (
                        <Cell key={idx} fill={`hsl(${245 - idx * 18},70%,${55 + idx * 2}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Summary row (included in PNG/PDF capture) */}
      {!isLoading && chartData.length > 0 && (
        <div style={{
          display: 'flex', gap: 12, padding: '12px 20px 16px',
          borderTop: '1px solid var(--border)', flexWrap: 'wrap',
        }}>
          {[
            { label: t.analytics.present, value: Math.round(chartData.reduce((s, d) => s + d.present, 0) / chartData.length), color: 'var(--success)' },
            { label: t.analytics.absent, value: Math.round(chartData.reduce((s, d) => s + d.absent, 0) / chartData.length), color: 'var(--danger)' },
            { label: topWorkers[0] ? `#1 ${topWorkers[0].name}` : '', value: topWorkers[0] ? `${topWorkers[0].totalHours}h` : '', color: 'var(--primary)' },
          ].filter(x => x.label).map(({ label, value, color }) => (
            <div key={label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 16px', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
              <strong style={{ color }}>{value}</strong>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
            {tenantName} · {startDate} – {endDate}
          </div>
        </div>
      )}

      {/* Scheduled email component */}
      <div style={{ padding: '0 20px 20px' }}>
        <DashboardScheduleCard startDate={startDate} endDate={endDate} tenantName={tenantName} />
      </div>
    </div>
  )
}

// ─── Main Dashboard page ──────────────────────────────────────────────────────

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]

  // Read tenant name from JWT payload
  const tenantName = (() => {
    try {
      const jwt = localStorage.getItem('adminJwt') ?? ''
      const payload = JSON.parse(atob(jwt.split('.')[1]))
      return (payload.tenantName as string) ?? 'WorkForce'
    } catch { return 'WorkForce' }
  })()

  const { data: workers = [] } = useQuery({
    queryKey: ['workers-dash', today],
    queryFn: () => workersApi.list({ startDate: today, endDate: today }),
    staleTime: 30_000, refetchInterval: 60_000,
  })

  const { data: pendingOT = [] } = useQuery({
    queryKey: ['extra-hours', 'pending'],
    queryFn: () => extraHoursApi.list({ status: 'pending' }),
    staleTime: 30_000,
  })

  const { data: seenOT = [] } = useQuery({
    queryKey: ['extra-hours', 'seen'],
    queryFn: () => extraHoursApi.list({ status: 'seen' }),
    staleTime: 30_000,
  })

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs-dash'],
    queryFn: () => auditLogApi.list(15),
    staleTime: 30_000, refetchInterval: 60_000,
  })

  const { data: missingCheckouts = [] } = useQuery({
    queryKey: ['missing-checkouts'],
    queryFn: () => attendanceApi.getMissingCheckouts(),
    staleTime: 60_000, refetchInterval: 5 * 60_000,
  })

  const { data: lateData } = useQuery({
    queryKey: ['late-arrivals', 'all'],
    queryFn: () => apiFetch<{ workers: any[] }>('/attendance/late-arrivals'),
    staleTime: 60_000, refetchInterval: 5 * 60_000,
  })
  const lateArrivals: any[] = lateData?.workers ?? []

  const presentToday  = workers.filter(w => w.lastCheckIn).length
  const absentToday   = workers.filter(w => !w.lastCheckIn).length
  const totalWorkers  = workers.length
  const pendingOTCount = pendingOT.length + seenOT.length
  const attendanceRate = totalWorkers > 0 ? Math.round((presentToday / totalWorkers) * 100) : 0
  const riskCount     = lateArrivals.length + missingCheckouts.length + pendingOTCount
  const todayLabel    = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })

  const brigadeMap = new Map<string, { name: string; total: number; present: number }>()
  for (const w of workers) {
    const key = w.brigadeName || '—'
    const b = brigadeMap.get(key) ?? { name: key, total: 0, present: 0 }
    b.total++; if (w.lastCheckIn) b.present++
    brigadeMap.set(key, b)
  }
  const brigadeRows = Array.from(brigadeMap.values()).sort((a, b) => b.total - a.total).slice(0, 10)

  return (
    <>
      {/* Ops strip */}
      <div className="ops-strip">
        <div className="ops-strip__main">
          <div className="ops-strip__icon"><Gauge size={18} /></div>
          <div style={{ minWidth: 0 }}>
            <div className="ops-strip__title">{t.dashboard.opsTitle}</div>
            <div className="ops-strip__meta">
              {attendanceRate}% {t.dashboard.attendanceRateSub} · {presentToday}/{totalWorkers} {t.dashboard.workersCame} · {riskCount} {t.dashboard.openIssues}
            </div>
          </div>
        </div>
        <div className="ops-strip__side">
          <span className="ops-pill"><CalendarDays size={13} />{todayLabel}</span>
          <span className="ops-pill"><Activity size={13} />{riskCount === 0 ? t.dashboard.clean : `${riskCount} ${t.dashboard.openIssues}`}</span>
          <button className="btn btn--secondary btn--sm" onClick={() => downloadDailyPdf(today)}>
            <FileDown size={14} /> {t.dashboard.pdfReport}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {lateArrivals.length > 0 && (
        <div className="alert-row alert-row--warning" onClick={() => navigate('/late-arrivals')}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <div className="alert-row__body">
            <span className="alert-row__title">{lateArrivals.length} {t.dashboard.lateWarning}</span>
            <span className="alert-row__sub">{t.dashboard.lateWarningSub}</span>
          </div>
          <ChevronRight size={15} />
        </div>
      )}
      {/* Stat cards */}
      <div className="stats-grid">
        <StatCard value={totalWorkers} label={t.dashboard.totalWorkers}
          icon={<Users size={16} />} color="var(--primary-text)" bg="var(--primary-light)"
          onClick={() => navigate('/workers')} />
        <StatCard
          value={presentToday} label={t.dashboard.presentToday}
          sub={totalWorkers > 0 ? `${Math.round((presentToday / totalWorkers) * 100)}% ${t.dashboard.attendanceRateSub}` : undefined}
          icon={<UserCheck size={16} />} color="var(--success)" bg="var(--success-light)"
          onClick={() => navigate('/workers')}
        />
        <StatCard value={absentToday} label={t.dashboard.absentToday}
          icon={<UserX size={16} />} color="var(--danger)" bg="var(--danger-light)"
          onClick={() => navigate('/absent-today')} />
        <StatCard value={pendingOTCount} label={t.dashboard.pendingOvertime}
          icon={<Clock size={16} />} color="var(--warning)" bg="var(--warning-light)"
          onClick={() => navigate('/overtime')} />
      </div>

      {/* Brigade + activity grid */}
      <div className="dash-grid">
        <div className="card">
          <div className="card-header"><h3>{t.dashboard.brigadeStatus}</h3></div>
          <div className="card-body card-body--p0">
            {brigadeRows.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <p style={{ fontSize: 13 }}>{t.dashboard.noScanToday}</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.dashboard.brigade}</th>
                      <th>{t.dashboard.workers}</th>
                      <th>{t.dashboard.presentToday}</th>
                      <th>{t.dashboard.attendance}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brigadeRows.map(b => {
                      const rate = b.total > 0 ? Math.round((b.present / b.total) * 100) : 0
                      return (
                        <tr key={b.name}>
                          <td className="fw-600">{b.name}</td>
                          <td className="td-muted">{b.total}</td>
                          <td>{b.present}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{
                                  width: `${rate}%`, height: '100%', borderRadius: 99,
                                  background: rate >= 90 ? 'var(--success)' : rate >= 70 ? 'var(--warning)' : 'var(--danger)',
                                }} />
                              </div>
                              <span className="text-xs text-muted">{rate}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header"><h3>{t.dashboard.recentActivity}</h3></div>
            <div className="activity-list">
              {auditLogs.length === 0 ? (
                <div style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                  {t.dashboard.noActivity}
                </div>
              ) : auditLogs.slice(0, 10).map(log => {
                const entityMap: Record<string, string> = { Worker: t.dashboard.entityWorker, Foreman: t.dashboard.entityForeman }
                const actionMap: Record<string, string> = { CREATE: t.dashboard.actionCreated, UPDATE: t.dashboard.actionUpdated, DELETE: t.dashboard.actionDeleted }
                const entity = entityMap[log.entityType] ?? log.entityType
                const action = actionMap[log.action] ?? log.action
                const name = log.after?.name ?? log.before?.name ?? ''
                const time = new Date(log.changedAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={log.id} className="activity-item">
                    <span className="activity-time">{time}</span>
                    <div className="activity-dot" style={{
                      background: log.action === 'DELETE' ? 'var(--danger)' : log.action === 'CREATE' ? 'var(--success)' : 'var(--info)',
                    }} />
                    <span className="activity-text">
                      {entity} {name ? `"${name}" ` : ''}{action} — {log.changedBy}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Analytics charts + schedule ─────────────────────────────────────────── */}
      <AnalyticsSection tenantName={tenantName} />
    </>
  )
}
