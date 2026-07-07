import { useState } from 'react'
import { Sun, Moon, Mail, Clock, Plus, Trash2, Send } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { shiftSettingsApi } from '../api/shiftSettings'
import { reportConfigApi, REPORT_TYPE_LABELS, type ReportScheduleItem, type ReportType } from '../api/reportConfig'
import type { Language } from '../types/tenant'

const LANGS: Array<{ key: Language; label: string }> = [
  { key: 'ru', label: 'Русский' },
  { key: 'en', label: 'English' },
  { key: 'tr', label: 'Türkçe' },
]

// ─── Shift Settings Card ──────────────────────────────────────────────────────

function ShiftSettingsCard() {
  const qc = useQueryClient()
  const { data: settings = [] } = useQuery({
    queryKey: ['shift-settings'],
    queryFn: shiftSettingsApi.getAll,
    staleTime: 60_000,
  })
  const [dayStart,    setDayStart]    = useState('')
  const [dayEnd,      setDayEnd]      = useState('')
  const [dayGrace,    setDayGrace]    = useState('')
  const [nightStart,  setNightStart]  = useState('')
  const [nightEnd,    setNightEnd]    = useState('')
  const [nightGrace,  setNightGrace]  = useState('')
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
      )
      await shiftSettingsApi.update(
        'night',
        nightStart || nightS?.startTime || '19:00',
        nightEnd   || nightS?.endTime   || '07:00',
        Number(nightGrace || nightS?.graceMinutes || 60),
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
      <div className="card-header"><h3>Shift Wagtlary</h3></div>
      <div className="card-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Başlangy wagty + çäk minuty: işçi bu wagta çenli gelmese "Gelmedi" hasaplanýar.
          </p>

          {/* Day shift */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Sun size={13} style={{ color: 'var(--warning)' }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Gündiz shift</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div className="form-row">
                <label className="form-label">Başlangy</label>
                <input type="time" value={dayStart || dayS?.startTime || '07:00'}
                  onChange={e => setDayStart(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Gutarýan</label>
                <input type="time" value={dayEnd || dayS?.endTime || '19:00'}
                  onChange={e => setDayEnd(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Çäk (min)</label>
                <input type="number" min="0" max="120"
                  value={dayGrace || String(dayS?.graceMinutes ?? 60)}
                  onChange={e => setDayGrace(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Night shift */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Moon size={13} style={{ color: 'var(--info)' }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Gije shift</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div className="form-row">
                <label className="form-label">Başlangy</label>
                <input type="time" value={nightStart || nightS?.startTime || '19:00'}
                  onChange={e => setNightStart(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Gutarýan</label>
                <input type="time" value={nightEnd || nightS?.endTime || '07:00'}
                  onChange={e => setNightEnd(e.target.value)} />
              </div>
              <div className="form-row">
                <label className="form-label">Çäk (min)</label>
                <input type="number" min="0" max="120"
                  value={nightGrace || String(nightS?.graceMinutes ?? 60)}
                  onChange={e => setNightGrace(e.target.value)} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn--primary btn--sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saklanýar…' : 'Sakla'}
            </button>
            {saved && <span style={{ fontSize: 12, color: 'var(--success)' }}>✓ Saklandi</span>}
            {mutation.isError && <span style={{ fontSize: 12, color: 'var(--danger)' }}>Ýalňyşlyk</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Report Emails Card ───────────────────────────────────────────────────────

function ReportEmailsCard() {
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
    mutationFn: () => reportConfigApi.saveAll(emails, schedules),
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
      label: 'Günlük hasabat',
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
      await reportConfigApi.sendNow(today, 'daily_all')
      setSendMsg('✓ Hasabat iberildi!')
    } catch {
      setSendMsg('✗ Iberilmedi — email sazlamalaryny barla')
    } finally {
      setSending(false)
      setTimeout(() => setSendMsg(''), 4000)
    }
  }

  if (isLoading) return <div className="card"><div className="card-body">Ýüklenýär…</div></div>

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={16} /> Awtomatik Hasabat Iberijisi
        </h3>
        <button
          className="btn btn--sm"
          style={{ background: 'var(--success)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={handleSendNow}
          disabled={sending || emails.length === 0}
        >
          <Send size={13} />
          {sending ? 'Iberilýär…' : 'Şu wagt iber'}
        </button>
      </div>
      <div className="card-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

          {/* ── Email recipients ── */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={13} /> Hasabat alyjy e-mailler
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
                Heniz email goşulmady
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
                <Clock size={13} /> Iber wagtlary
              </span>
              <button className="btn btn--sm btn--secondary" onClick={addSchedule} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={12} /> Goş
              </button>
            </div>
            {schedules.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Heniz wagt bellenilmedi
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
                      placeholder="Hasabat ady"
                    />
                    <select
                      value={sch.reportType ?? 'daily_all'}
                      onChange={e => updateSchedule(idx, { reportType: e.target.value as ReportType })}
                      style={{ fontSize: 11, padding: '3px 6px' }}
                    >
                      {(Object.entries(REPORT_TYPE_LABELS) as [ReportType, string][]).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={sch.enabled}
                        onChange={e => updateSchedule(idx, { enabled: e.target.checked })}
                      />
                      Işjeň
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
                      Soňky iberilen: {sch.lastSentDate}
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
            {saveMutation.isPending ? 'Saklanýar…' : 'Sazlamalary sakla'}
          </button>
          {saved && <span style={{ fontSize: 12, color: 'var(--success)' }}>✓ Saklandi</span>}
          {saveMutation.isError && <span style={{ fontSize: 12, color: 'var(--danger)' }}>Ýalňyşlyk</span>}
          {sendMsg && (
            <span style={{ fontSize: 12, color: sendMsg.startsWith('✓') ? 'var(--success)' : 'var(--danger)' }}>
              {sendMsg}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            Hasabatlar öňki güniň maglumatlaryny öz içine alýar
          </span>
        </div>
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
                { label: 'Object', value: user?.objectName ?? '—' },
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
      </div>
    </>
  )
}
