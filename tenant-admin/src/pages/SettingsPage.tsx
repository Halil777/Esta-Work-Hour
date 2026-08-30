import { useState } from 'react'
import { Sun, Moon, Mail, Clock, Plus, Trash2, Send, Smartphone, Copy, Eye, EyeOff, RefreshCw, Bell } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { shiftSettingsApi } from '../api/shiftSettings'
import { reportConfigApi, type ReportScheduleItem, type ReportType } from '../api/reportConfig'
import { anomaliesApi } from '../api/anomaliesApi'
import { adminAuthApi } from '../api/adminAuth'
import type { Language } from '../types/tenant'

const LANGS: Array<{ key: Language; label: string }> = [
  { key: 'ru', label: 'Русский' },
  { key: 'en', label: 'English' },
  { key: 'tr', label: 'Türkçe' },
]

// ─── Shift Settings Card ──────────────────────────────────────────────────────

function ShiftSettingsCard() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: settings = [] } = useQuery({
    queryKey: ['shift-settings'],
    queryFn: shiftSettingsApi.getAll,
    staleTime: 60_000,
  })
  const [dayStart,    setDayStart]    = useState('')
  const [dayEnd,      setDayEnd]      = useState('')
  const [dayGrace,    setDayGrace]    = useState('')
  const [dayStandard, setDayStandard] = useState('')
  const [nightStart,  setNightStart]  = useState('')
  const [nightEnd,    setNightEnd]    = useState('')
  const [nightGrace,  setNightGrace]  = useState('')
  const [nightStandard, setNightStandard] = useState('')
  const [saved,       setSaved]       = useState(false)

  const dayS   = settings.find(s => s.shiftType === 'day')
  const nightS = settings.find(s => s.shiftType === 'night')

  const mutation = useMutation({
    mutationFn: async () => {
      await shiftSettingsApi.update(
        'day',
        dayStart   || dayS?.startTime   || '07:00',
        dayEnd     || dayS?.endTime     || '19:00',
        Number(dayGrace   || dayS?.graceMinutes   || 60),
        Math.round(Number(dayStandard   || (dayS?.standardMinutes   ?? 660) / 60) * 60),
      )
      await shiftSettingsApi.update(
        'night',
        nightStart || nightS?.startTime || '19:00',
        nightEnd   || nightS?.endTime   || '07:00',
        Number(nightGrace || nightS?.graceMinutes || 60),
        Math.round(Number(nightStandard || (nightS?.standardMinutes ?? 660) / 60) * 60),
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <div className="card">
      <div className="card-header"><h3>{t.shiftSettings.title}</h3></div>
      <div className="card-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {t.shiftSettings.description}
          </p>

          {/* Day shift */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Sun size={13} style={{ color: 'var(--warning)' }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{t.shiftSettings.dayShift}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              <div className="form-row">
                <label className="form-label">{t.shiftSettings.start}</label>
                <input type="time" value={dayStart || dayS?.startTime || '07:00'}
                  onChange={e => setDayStart(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">{t.shiftSettings.end}</label>
                <input type="time" value={dayEnd || dayS?.endTime || '19:00'}
                  onChange={e => setDayEnd(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">{t.shiftSettings.graceMins}</label>
                <input type="number" min="0" max="120"
                  value={dayGrace || String(dayS?.graceMinutes ?? 60)}
                  onChange={e => setDayGrace(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">{t.shiftSettings.standardHours}</label>
                <input type="number" min="0" max="24" step="0.5"
                  value={dayStandard || String((dayS?.standardMinutes ?? 660) / 60)}
                  onChange={e => setDayStandard(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Night shift */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Moon size={13} style={{ color: 'var(--info)' }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{t.shiftSettings.nightShift}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              <div className="form-row">
                <label className="form-label">{t.shiftSettings.start}</label>
                <input type="time" value={nightStart || nightS?.startTime || '19:00'}
                  onChange={e => setNightStart(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">{t.shiftSettings.end}</label>
                <input type="time" value={nightEnd || nightS?.endTime || '07:00'}
                  onChange={e => setNightEnd(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">{t.shiftSettings.graceMins}</label>
                <input type="number" min="0" max="120"
                  value={nightGrace || String(nightS?.graceMinutes ?? 60)}
                  onChange={e => setNightGrace(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">{t.shiftSettings.standardHours}</label>
                <input type="number" min="0" max="24" step="0.5"
                  value={nightStandard || String((nightS?.standardMinutes ?? 660) / 60)}
                  onChange={e => setNightStandard(e.target.value)} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn--primary btn--sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? t.common.saving : t.common.save}
            </button>
            {saved && <span style={{ fontSize: 12, color: 'var(--success)' }}>{t.common.saved}</span>}
            {mutation.isError && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{t.common.error}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Report Emails Card ───────────────────────────────────────────────────────

function ReportEmailsCard() {
  const { t } = useTranslation()
  const { language } = useUiPreferences()
  const qc = useQueryClient()

  const { data: config, isLoading } = useQuery({
    queryKey: ['report-config'],
    queryFn: reportConfigApi.getConfig,
    staleTime: 30_000,
  })

  const [emails,    setEmails]    = useState<string[]>([])
  const [schedules, setSchedules] = useState<ReportScheduleItem[]>([])
  const [newEmail,  setNewEmail]  = useState('')
  const [saved,     setSaved]     = useState(false)
  const [sending,   setSending]   = useState(false)
  const [sendMsg,   setSendMsg]   = useState('')

  // Sync from server on first load
  const [synced, setSynced] = useState(false)
  if (config && !synced) {
    setEmails(config.emails)
    setSchedules(config.schedules)
    setSynced(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => reportConfigApi.saveAll(emails, schedules, undefined, language),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-config'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  function addEmail() {
    const v = newEmail.trim()
    if (!v || !v.includes('@') || emails.includes(v)) { setNewEmail(''); return }
    setEmails(prev => [...prev, v])
    setNewEmail('')
  }

  function removeEmail(idx: number) {
    setEmails(prev => prev.filter((_, i) => i !== idx))
  }

  function addSchedule() {
    const newItem: ReportScheduleItem = {
      id: `sch-${Date.now()}`,
      label: t.common.dailyReport,
      time: '08:00',
      enabled: true,
      reportType: 'daily_all',
      lastSentDate: null,
    }
    setSchedules(prev => [...prev, newItem])
  }

  function updateSchedule(idx: number, patch: Partial<ReportScheduleItem>) {
    setSchedules(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  function removeSchedule(idx: number) {
    setSchedules(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSendNow() {
    setSending(true)
    setSendMsg('')
    try {
      // Pass today's date so manual test sends use current-day scan data
      const today = new Date().toISOString().split('T')[0]
      await reportConfigApi.sendNow(today, 'daily_all', language)
      setSendMsg(t.reportEmails.sent)
    } catch {
      setSendMsg(t.reportEmails.failed)
    } finally {
      setSending(false)
      setTimeout(() => setSendMsg(''), 4000)
    }
  }

  if (isLoading) return <div className="card"><div className="card-body">{t.common.loading}</div></div>

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={16} /> {t.reportEmails.title}
        </h3>
        <button
          className="btn btn--sm"
          style={{ background: 'var(--success)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={handleSendNow}
          disabled={sending || emails.length === 0}
        >
          <Send size={13} />
          {sending ? t.reportEmails.sending : t.reportEmails.sendNow}
        </button>
      </div>
      <div className="card-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

          {/* ── Email recipients ── */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={13} /> {t.reportEmails.recipients}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input
                type="email"
                placeholder="email@mysal.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEmail()}
                style={{ flex: 1, fontSize: 13 }}
              />
              <button className="btn btn--primary btn--sm" onClick={addEmail}>
                <Plus size={14} />
              </button>
            </div>
            {emails.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                {t.reportEmails.noEmails}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {emails.map((email, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 10px', background: 'var(--bg)', borderRadius: 8,
                  border: '1px solid var(--border)', fontSize: 13,
                }}>
                  <span>{email}</span>
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2 }}
                    onClick={() => removeEmail(idx)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Schedules ── */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={13} /> {t.reportEmails.scheduleTimes}
              </span>
              <button className="btn btn--sm btn--secondary" onClick={addSchedule} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={12} /> Goş
              </button>
            </div>
            {schedules.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                {t.reportEmails.noSchedules}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {schedules.map((sch, idx) => (
                <div key={sch.id} style={{
                  padding: '10px 12px', background: 'var(--bg)', borderRadius: 8,
                  border: `1px solid ${sch.enabled ? 'var(--primary)' : 'var(--border)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="time"
                      value={sch.time}
                      onChange={e => updateSchedule(idx, { time: e.target.value })}
                      style={{ width: 90, fontSize: 13 }}
                    />
                    <input
                      type="text"
                      value={sch.label}
                      onChange={e => updateSchedule(idx, { label: e.target.value })}
                      style={{ flex: 1, fontSize: 12 }}
                      placeholder={t.reportEmails.reportName}
                    />
                    <select
                      value={sch.reportType ?? 'daily_all'}
                      onChange={e => updateSchedule(idx, { reportType: e.target.value as ReportType })}
                      style={{ fontSize: 11, padding: '3px 6px' }}
                    >
                      {(['daily_all','daily_staff','daily_shift_day','daily_shift_night','daily_attended','daily_absent'] as ReportType[]).map(key => {
                        const reportTypeLabel: Record<ReportType, string> = {
                          daily_all: t.settings.reportTypeAll,
                          daily_staff: t.settings.reportTypeStaff,
                          daily_shift_day: t.settings.reportTypeDayShift,
                          daily_shift_night: t.settings.reportTypeNightShift,
                          daily_attended: t.settings.reportTypeAttended,
                          daily_absent: t.settings.reportTypeAbsent,
                        }
                        return <option key={key} value={key}>{reportTypeLabel[key]}</option>
                      })}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={sch.enabled}
                        onChange={e => updateSchedule(idx, { enabled: e.target.checked })}
                      />
                      {t.common.active}
                    </label>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 2 }}
                      onClick={() => removeSchedule(idx)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {sch.lastSentDate && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {t.reportEmails.lastSent}: {sch.lastSentDate}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? t.common.saving : t.reportEmails.saveSettings}
          </button>
          {saved && <span style={{ fontSize: 12, color: 'var(--success)' }}>{t.common.saved}</span>}
          {saveMutation.isError && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{t.common.error}</span>}
          {sendMsg && (
            <span style={{ fontSize: 12, color: sendMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)' }}>
              {sendMsg}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {t.reportEmails.note}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── NFC Device Token Card ────────────────────────────────────────────────────

function NfcDeviceCard() {
  const qc = useQueryClient()
  const [showToken, setShowToken] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['device-token'],
    queryFn: adminAuthApi.getDeviceToken,
    staleTime: 60_000,
    initialData: () => {
      const stored = localStorage.getItem('deviceToken')
      return stored ? { deviceToken: stored } : undefined
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: adminAuthApi.regenerateDeviceToken,
    onSuccess: (result) => {
      localStorage.setItem('deviceToken', result.deviceToken)
      qc.setQueryData(['device-token'], { deviceToken: result.deviceToken })
    },
  })

  const token = data?.deviceToken ?? ''
  const serverUrl = window.location.origin

  function copyToken() {
    if (!token) return
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function copyServerUrl() {
    navigator.clipboard.writeText(serverUrl)
  }

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="card-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Smartphone size={16} /> NFC Enjam Sazlamalary
        </h3>
      </div>
      <div className="card-body">
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, marginTop: 0 }}>
          EstaAttendance Android programmasy üçin aşakdaky maglumatlary programmanyň ilkinji işledilişinde giriziň.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Server URL */}
          <div className="form-row">
            <label className="form-label">Server URL</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input readOnly value={serverUrl} style={{ flex: 1, fontSize: 12, fontFamily: 'monospace' }} />
              <button className="btn btn--sm btn--secondary" onClick={copyServerUrl} title="Kopirle">
                <Copy size={13} />
              </button>
            </div>
          </div>

          {/* Device Token */}
          <div className="form-row">
            <label className="form-label">Device Token</label>
            {isLoading ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ýüklenýär...</span>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  readOnly
                  value={showToken ? token : token ? '••••••••-••••-••••-••••-••••••••••••' : '—'}
                  style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', letterSpacing: showToken ? 0 : 2 }}
                />
                <button className="btn btn--sm btn--secondary" onClick={() => setShowToken(v => !v)} title={showToken ? 'Gizle' : 'Görkez'}>
                  {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button className="btn btn--sm btn--secondary" onClick={copyToken} title="Kopirle">
                  {copied ? '✓' : <Copy size={13} />}
                </button>
              </div>
            )}
          </div>

        </div>

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <button
            className="btn btn--sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--warning)', color: '#000' }}
            onClick={() => {
              if (window.confirm('Token täzeden döredilensoň, enjamda täze token girizilmeli. Dowam etmelimi?')) {
                regenerateMutation.mutate()
              }
            }}
            disabled={regenerateMutation.isPending}
          >
            <RefreshCw size={13} />
            {regenerateMutation.isPending ? 'Täzelenýär...' : 'Tokeni täzele'}
          </button>
          {regenerateMutation.isSuccess && (
            <span style={{ fontSize: 12, color: 'var(--success)' }}>✓ Täze token döredildi</span>
          )}
          {regenerateMutation.isError && (
            <span style={{ fontSize: 12, color: 'var(--danger)' }}>Ýalňyşlyk boldy</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            Token gizlin saklaň — enjam bilen paýlaşyň
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Anomaly Alert Card ───────────────────────────────────────────────────────

function AnomalyAlertCard() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: schedule } = useQuery({
    queryKey: ['anomaly-schedule'],
    queryFn: anomaliesApi.getSchedule,
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: (patch: { missingCheckInEnabled?: boolean; shiftAlertEnabled?: boolean; checkOutAlertEnabled?: boolean }) =>
      anomaliesApi.updateSchedule(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anomaly-schedule'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const toggle = (key: 'missingCheckInEnabled' | 'shiftAlertEnabled' | 'checkOutAlertEnabled') => {
    if (!schedule) return
    mutation.mutate({ [key]: !schedule[key] })
  }

  const ToggleRow = ({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--bg-border)' }}>
      <button
        onClick={onToggle}
        disabled={mutation.isPending}
        style={{
          width: 40, height: 22, borderRadius: 11,
          background: value ? 'var(--brand-primary)' : 'var(--bg-border)',
          border: 'none', cursor: 'pointer', position: 'relative',
          flexShrink: 0, transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: value ? 20 : 3,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
        }} />
      </button>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{label}</span>
    </div>
  )

  return (
    <div className="card">
      <div className="card-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Bell size={14} style={{ color: 'var(--warning)' }} />
          {t.anomaly.alertSettingsTitle}
        </h3>
      </div>
      <div className="card-body">
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
          {t.reportEmails.note}
        </p>
        {schedule ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <ToggleRow
              label={t.anomaly.enableMissingCheckin}
              value={schedule.missingCheckInEnabled}
              onToggle={() => toggle('missingCheckInEnabled')}
            />
            <ToggleRow
              label={t.anomaly.enableShiftAlert}
              value={schedule.shiftAlertEnabled}
              onToggle={() => toggle('shiftAlertEnabled')}
            />
            <ToggleRow
              label={t.anomaly.enableCheckOutAlert}
              value={schedule.checkOutAlertEnabled}
              onToggle={() => toggle('checkOutAlertEnabled')}
            />
            {saved && (
              <span style={{ fontSize: 12, color: 'var(--success)', marginTop: 10 }}>{t.anomaly.saved}</span>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.common.loading}</p>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { t } = useTranslation()
  const { theme, setTheme, language, setLanguage, user } = useUiPreferences()

  return (
    <>
      <div className="page-header">
        <h1>{t.settings.title}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div className="card">
          <div className="card-header"><h3>{t.settings.preferences}</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-row">
                <label className="form-label">{t.settings.theme}</label>
                <div className="theme-row">
                  <button className={`theme-btn${theme === 'dark' ? ' active' : ''}`} onClick={() => setTheme('dark')}>
                    <Moon size={14} />{t.settings.darkMode}
                  </button>
                  <button className={`theme-btn${theme === 'light' ? ' active' : ''}`} onClick={() => setTheme('light')}>
                    <Sun size={14} />{t.settings.lightMode}
                  </button>
                </div>
              </div>
              <div className="form-row">
                <label className="form-label">{t.settings.language}</label>
                <select value={language} onChange={e => setLanguage(e.target.value as Language)}>
                  {LANGS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t.settings.account}</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: t.common.name, value: user?.name ?? '—' },
                { label: t.settings.role, value: user?.role ?? '—' },
                { label: t.settings.objectLabel, value: user?.objectName ?? '—' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span className="text-sm text-muted">{item.label}</span>
                  <span className="fw-600 text-sm">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ShiftSettingsCard />

        <ReportEmailsCard />

        <AnomalyAlertCard />

        <NfcDeviceCard />
      </div>
    </>
  )
}
