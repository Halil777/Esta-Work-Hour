import { useRef, useState, useCallback, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import {
  Users, UserCheck, UserX, Clock, ChevronRight, AlertTriangle,
  FileDown, CalendarDays, Download, Mail, Plus, X, Edit2, Trash2,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { workersApi } from '../api/workers'
import { extraHoursApi } from '../api/extraHours'
import { auditLogApi } from '../api/auditLog'
import { attendanceApi } from '../api/attendance'
import { analyticsApi, type AttendanceChartPoint, type TopWorkerItem } from '../api/analyticsApi'
import { apiFetch } from '../api/http'
import { Sparkline, ProgressRing, DeltaBadge } from '../components/dashboard/DashboardVisuals'
import { pctChange } from '../components/dashboard/dashboardMath'

// ─── Date helpers ────────────────────────────────────────────────────────────

function isoDaysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
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

// ─── Sequential ramp (magnitude → single hue, light→dark; largest = darkest) ──

function seqColor(idx: number, len: number) {
  if (len <= 1) return 'var(--seq-6)'
  const step = 6 - Math.round((idx / (len - 1)) * 5)
  return `var(--seq-${step})`
}

// ─── Recharts tooltips & custom dot ─────────────────────────────────────────

function RateEndDot(props: any) {
  const { cx, cy, index, payload, dataLength } = props
  if (index !== dataLength - 1) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill="var(--primary)" stroke="var(--bg-surface)" strokeWidth={2} />
      <text x={cx} y={cy - 14} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text)">{payload.rate}%</text>
    </g>
  )
}

function RateTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <strong style={{ color: 'var(--text)', fontSize: 14 }}>{payload[0].payload.rate}%</strong>
    </div>
  )
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-secondary)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, flexShrink: 0 }} />
          <span>{p.name}:</span>
          <strong style={{ color: 'var(--text)', marginLeft: 'auto' }}>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

function TopWorkersTooltip({ active, payload, hoursLabel }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 2 }}>{p.payload.name}</div>
      <span style={{ color: 'var(--text-muted)' }}>{hoursLabel}: </span><strong style={{ color: 'var(--text)' }}>{p.value}h</strong>
    </div>
  )
}

// ─── Chart components ───────────────────────────────────────────────────────

function RateTrendChart({ data }: { data: { date: string; rate: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 24, right: 28, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date" tickFormatter={(d: string) => d.slice(5)}
          tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} tickLine={false}
          axisLine={{ stroke: 'var(--border)' }} interval={data.length > 10 ? 1 : 0}
        />
        <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
        <Tooltip content={<RateTooltip />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
        <Area
          type="monotone" dataKey="rate" stroke="var(--primary)" strokeWidth={2} fill="url(#rateFill)"
          dot={(props: any) => <RateEndDot {...props} dataLength={data.length} />}
          activeDot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--bg-surface)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function AttendanceBarChart({ data, presentLabel, absentLabel }: {
  data: AttendanceChartPoint[]; presentLabel: string; absentLabel: string
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date" tickFormatter={(d: string) => d.slice(5)}
          tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} tickLine={false}
          axisLine={{ stroke: 'var(--border)' }} interval={data.length > 10 ? 1 : 0}
        />
        <YAxis tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={30} />
        <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        <Bar dataKey="present" name={presentLabel} fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="absent" name={absentLabel} fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function TopWorkersChart({ data, hoursLabel, noDataLabel }: {
  data: TopWorkerItem[]; hoursLabel: string; noDataLabel: string
}) {
  if (data.length === 0) {
    return <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{noDataLabel}</div>
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
        <YAxis
          type="category" dataKey="name" width={126}
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}
          tickFormatter={(v: string) => v.length > 13 ? v.slice(0, 12) + '…' : v}
        />
        <Tooltip content={<TopWorkersTooltip hoursLabel={hoursLabel} />} cursor={{ fill: 'var(--bg-hover)' }} />
        <Bar dataKey="totalHours" name={hoursLabel} radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((_, idx) => <Cell key={idx} fill={seqColor(idx, data.length)} />)}
          <LabelList dataKey="totalHours" position="right" formatter={(v: any) => `${v}h`} style={{ fontSize: 11, fontWeight: 700, fill: 'var(--text)' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── KPI tile ────────────────────────────────────────────────────────────────

function KpiTile({ icon, iconColor, iconBg, value, label, deltaPct, spark, invert, onClick }: {
  icon: React.ReactNode; iconColor: string; iconBg: string
  value: string | number; label: string
  deltaPct: number | null; spark?: number[]; invert?: boolean
  onClick?: () => void
}) {
  return (
    <div className={`kpi-tile${onClick ? ' kpi-tile--clickable' : ''}`} onClick={onClick}>
      <div className="kpi-tile__top">
        <div className="kpi-tile__icon" style={{ background: iconBg, color: iconColor }}>{icon}</div>
        <DeltaBadge pct={deltaPct} invert={invert} />
      </div>
      <div>
        <div className="kpi-tile__value">{value}</div>
        <div className="kpi-tile__label">{label}</div>
      </div>
      {spark && spark.length >= 2 && (
        <div className="kpi-tile__spark"><Sparkline points={spark} color={iconColor} /></div>
      )}
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

// ─── Analytics section (trend + daily attendance + top workers + exports) ──

function AnalyticsSection({ tenantName }: { tenantName: string }) {
  const { t } = useTranslation()

  const defaultEnd   = isoDaysAgo(0)
  const defaultStart = isoDaysAgo(13)

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

  const rateData = useMemo(
    () => chartData.map(d => ({ date: d.date, rate: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0 })),
    [chartData],
  )

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

  return (
    <div className="dash-section">
      <div className="analytics-header">
        <div>
          <div className="chart-card__title">{t.analytics.title}</div>
          <div className="chart-card__desc">{t.analytics.rateTrendDesc}</div>
        </div>
        <div className="analytics-toolbar">
          <input
            type="date" value={startInput} onChange={e => setStartInput(e.target.value)}
            className="input" style={{ padding: '5px 8px', fontSize: 13, width: 140 }}
          />
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <input
            type="date" value={endInput} onChange={e => setEndInput(e.target.value)}
            className="input" style={{ padding: '5px 8px', fontSize: 13, width: 140 }}
          />
          <button className="btn btn--primary btn--sm" onClick={handleApply}>{t.analytics.apply}</button>
          <div className="analytics-toolbar__exports">
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
      </div>

      {isLoading ? (
        <div className="chart-card" style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          {t.analytics.loading}
        </div>
      ) : chartData.length === 0 ? (
        <div className="chart-card" style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          {t.analytics.noData}
        </div>
      ) : (
        <div ref={chartsRef}>
          <div className="chart-card" style={{ marginBottom: 16 }}>
            <div className="chart-card__body"><RateTrendChart data={rateData} /></div>
          </div>

          <div className="dash-two-col" style={{ marginBottom: 16 }}>
            <div className="chart-card">
              <div className="chart-card__head">
                <span className="chart-card__title">{t.analytics.attendanceChart}</span>
              </div>
              <div className="chart-card__body">
                <AttendanceBarChart data={chartData} presentLabel={t.analytics.present} absentLabel={t.analytics.absent} />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-card__head">
                <span className="chart-card__title">{t.analytics.topWorkersChart}</span>
                <span className="scale-legend">
                  {t.analytics.scaleLow}<span className="scale-legend__bar" />{t.analytics.scaleHigh}
                </span>
              </div>
              <div className="chart-card__body">
                <TopWorkersChart data={topWorkers} hoursLabel={t.analytics.totalHours} noDataLabel={t.analytics.noData} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: t.analytics.present, value: Math.round(chartData.reduce((s, d) => s + d.present, 0) / chartData.length), color: 'var(--success)' },
              { label: t.analytics.absent, value: Math.round(chartData.reduce((s, d) => s + d.absent, 0) / chartData.length), color: 'var(--danger)' },
              { label: topWorkers[0] ? `#1 ${topWorkers[0].name}` : '', value: topWorkers[0] ? `${topWorkers[0].totalHours}h` : '', color: 'var(--primary)' },
            ].filter(x => x.label).map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--bg-surface-2)', borderRadius: 8, padding: '8px 16px', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
                <strong style={{ color }}>{value}</strong>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
              {tenantName} · {startDate} – {endDate}
            </div>
          </div>
        </div>
      )}

      <DashboardScheduleCard startDate={startDate} endDate={endDate} tenantName={tenantName} />
    </div>
  )
}

// ─── Brigade avatar initials ─────────────────────────────────────────────────

function initials(name: string) {
  const letters = name.replace(/[^\p{L}]/gu, '')
  return letters.slice(0, 2).toUpperCase() || '—'
}

function rateColor(rate: number) {
  return rate >= 90 ? 'var(--success)' : rate >= 70 ? 'var(--warning)' : 'var(--danger)'
}

// ─── Activity feed action metadata ──────────────────────────────────────────

const ACTION_META: Record<string, { icon: React.ComponentType<any>; color: string; bg: string }> = {
  CREATE: { icon: Plus, color: 'var(--success)', bg: 'var(--success-light)' },
  UPDATE: { icon: Edit2, color: 'var(--info)', bg: 'var(--info-light)' },
  DELETE: { icon: Trash2, color: 'var(--danger)', bg: 'var(--danger-light)' },
}

// ─── Main Dashboard page ──────────────────────────────────────────────────────

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const today = isoDaysAgo(0)

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

  // Same query key/params AnalyticsSection uses for its default range, so
  // React Query serves both from one cached fetch — no duplicate request.
  const { data: trendChart = [] } = useQuery({
    queryKey: ['analytics-chart', isoDaysAgo(13), today],
    queryFn: () => analyticsApi.getAttendanceChart(isoDaysAgo(13), today),
    staleTime: 60_000,
  })

  const presentToday  = workers.filter(w => w.lastCheckIn).length
  const absentToday   = workers.filter(w => !w.lastCheckIn).length
  const totalWorkers  = workers.length
  const pendingOTCount = pendingOT.length + seenOT.length
  const attendanceRate = totalWorkers > 0 ? Math.round((presentToday / totalWorkers) * 100) : 0
  const riskCount     = lateArrivals.length + missingCheckouts.length + pendingOTCount
  const todayLabel    = new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Moscow', day: '2-digit', month: 'long', year: 'numeric' })

  const last7 = trendChart.slice(-7)
  const totalSpark   = last7.map(d => d.total)
  const presentSpark = last7.map(d => d.present)
  const absentSpark  = last7.map(d => d.absent)
  const heroDelta     = pctChange(trendChart.at(-2)?.present, trendChart.at(-1)?.present)
  const totalDelta    = pctChange(trendChart.at(-2)?.total, trendChart.at(-1)?.total)
  const presentDelta  = pctChange(trendChart.at(-2)?.present, trendChart.at(-1)?.present)
  const absentDelta   = pctChange(trendChart.at(-2)?.absent, trendChart.at(-1)?.absent)

  // Overtime-request volume trend (last 7 days, bucketed by request send date) —
  // a real signal derived from the actual extra-hours records, not a stand-in.
  const otSpark = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => isoDaysAgo(6 - i))
    const counts = new Map(days.map(d => [d, 0]))
    for (const item of [...pendingOT, ...seenOT]) {
      const day = (item.sentAt ?? '').split('T')[0]
      if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1)
    }
    return days.map(d => counts.get(d) ?? 0)
  }, [pendingOT, seenOT])
  const otDelta = pctChange(otSpark.at(-2), otSpark.at(-1))

  const brigadeMap = new Map<string, { name: string; total: number; present: number }>()
  for (const w of workers) {
    const key = w.brigadeName || '—'
    const b = brigadeMap.get(key) ?? { name: key, total: 0, present: 0 }
    b.total++; if (w.lastCheckIn) b.present++
    brigadeMap.set(key, b)
  }
  const brigadeRows = Array.from(brigadeMap.values()).sort((a, b) => b.total - a.total).slice(0, 10)

  const entityMap: Record<string, string> = { Worker: t.dashboard.entityWorker, Foreman: t.dashboard.entityForeman }
  const actionMap: Record<string, string> = { CREATE: t.dashboard.actionCreated, UPDATE: t.dashboard.actionUpdated, DELETE: t.dashboard.actionDeleted }

  return (
    <div className="dash-page">
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

      {/* Hero card */}
      <div className="hero-card">
        <div className="hero-card__ring">
          <ProgressRing pct={attendanceRate} />
          <div className="hero-card__ring-label">{attendanceRate}%</div>
        </div>
        <div className="hero-card__body">
          <div className="hero-card__kicker"><CalendarDays size={13} />{t.dashboard.heroKicker}</div>
          <div className="hero-card__figure">{presentToday}<span>/ {totalWorkers} {t.dashboard.heroUnit}</span></div>
          <div className="hero-card__sub">
            <DeltaBadge pct={heroDelta} size="md" />
            <span>{t.dashboard.deltaVsYesterday}</span>
            <span>·</span>
            <span>{riskCount === 0 ? t.dashboard.clean : `${riskCount} ${t.dashboard.openIssues}`}</span>
            <span>·</span>
            <span>{todayLabel}</span>
          </div>
        </div>
        <div className="hero-card__actions">
          <button className="btn btn--secondary btn--sm" onClick={() => downloadDailyPdf(today)}>
            <FileDown size={14} /> {t.dashboard.pdfReport}
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="kpi-grid">
        <KpiTile
          icon={<Users size={16} />} iconColor="var(--primary-text)" iconBg="var(--primary-light)"
          value={totalWorkers} label={t.dashboard.totalWorkers}
          deltaPct={totalDelta} spark={totalSpark}
          onClick={() => navigate('/workers')}
        />
        <KpiTile
          icon={<UserCheck size={16} />} iconColor="var(--success)" iconBg="var(--success-light)"
          value={presentToday} label={t.dashboard.presentToday}
          deltaPct={presentDelta} spark={presentSpark}
          onClick={() => navigate('/workers')}
        />
        <KpiTile
          icon={<UserX size={16} />} iconColor="var(--danger)" iconBg="var(--danger-light)"
          value={absentToday} label={t.dashboard.absentToday}
          deltaPct={absentDelta} spark={absentSpark} invert
          onClick={() => navigate('/absent-today')}
        />
        <KpiTile
          icon={<Clock size={16} />} iconColor="var(--warning)" iconBg="var(--warning-light)"
          value={pendingOTCount} label={t.dashboard.pendingOvertime}
          deltaPct={otDelta} spark={otSpark} invert
          onClick={() => navigate('/overtime')}
        />
      </div>

      {/* Analytics: trend + daily attendance + top workers + exports + schedule */}
      <AnalyticsSection tenantName={tenantName} />

      {/* Brigade + activity */}
      <div className="dash-two-col">
        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ margin: 0 }}>{t.dashboard.brigadeStatus}</h3>
              <div className="chart-card__desc">{t.dashboard.brigadeStatusDesc}</div>
            </div>
          </div>
          <div className="card-body" style={{ padding: '4px 16px 12px' }}>
            {brigadeRows.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <p style={{ fontSize: 13 }}>{t.dashboard.noScanToday}</p>
              </div>
            ) : brigadeRows.map(b => {
              const rate = b.total > 0 ? Math.round((b.present / b.total) * 100) : 0
              return (
                <div className="brigade-row" key={b.name}>
                  <div className="brigade-avatar">{initials(b.name)}</div>
                  <div className="brigade-row__body">
                    <div className="brigade-row__top">
                      <span className="brigade-row__name">{b.name}</span>
                      <span className="brigade-row__stat">{b.present}/{b.total} · <strong style={{ color: rateColor(rate) }}>{rate}%</strong></span>
                    </div>
                    <div className="brigade-meter-track">
                      <div className="brigade-meter-fill" style={{ width: `${rate}%`, background: rateColor(rate) }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ margin: 0 }}>{t.dashboard.recentActivity}</h3>
              <div className="chart-card__desc">{t.dashboard.recentActivityDesc}</div>
            </div>
          </div>
          <div className="card-body" style={{ padding: '4px 16px 12px' }}>
            {auditLogs.length === 0 ? (
              <div style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                {t.dashboard.noActivity}
              </div>
            ) : (
              <div className="activity-feed2">
                {auditLogs.slice(0, 8).map((log, i, arr) => {
                  const meta = ACTION_META[log.action] ?? ACTION_META.UPDATE
                  const Icon = meta.icon
                  const entity = entityMap[log.entityType] ?? log.entityType
                  const action = actionMap[log.action] ?? log.action
                  const name = log.after?.name ?? log.before?.name ?? ''
                  const time = new Date(log.changedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                  return (
                    <div className="activity-feed2__item" key={log.id}>
                      <div className="activity-feed2__rail">
                        <div className="activity-feed2__dot" style={{ background: meta.bg, color: meta.color }}>
                          <Icon size={13} />
                        </div>
                        {i < arr.length - 1 && <div className="activity-feed2__line" />}
                      </div>
                      <div className="activity-feed2__body">
                        <div className="activity-feed2__text">
                          {entity} {name ? `"${name}" ` : ''}{action} — {log.changedBy}
                        </div>
                        <div className="activity-feed2__time">{time}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
