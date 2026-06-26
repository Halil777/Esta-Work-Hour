import { useState } from 'react'
import { Sun, Moon, KeyRound } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { shiftSettingsApi } from '../api/shiftSettings'
import type { Language } from '../types/tenant'

const LANGS: Array<{ key: Language; label: string }> = [
  { key: 'ru', label: 'Русский' },
  { key: 'en', label: 'English' },
  { key: 'tr', label: 'Türkçe' },
]

function ShiftSettingsCard() {
  const qc = useQueryClient()
  const { data: settings = [] } = useQuery({
    queryKey: ['shift-settings'],
    queryFn: shiftSettingsApi.getAll,
    staleTime: 60_000,
  })
  const [dayTime,       setDayTime]       = useState('')
  const [dayGrace,      setDayGrace]      = useState('')
  const [nightTime,     setNightTime]     = useState('')
  const [nightGrace,    setNightGrace]    = useState('')
  const [saved,         setSaved]         = useState(false)

  const dayS   = settings.find(s => s.shiftType === 'day')
  const nightS = settings.find(s => s.shiftType === 'night')

  const mutation = useMutation({
    mutationFn: async () => {
      await shiftSettingsApi.update('day',   dayTime   || dayS?.startTime   || '07:00', Number(dayGrace   || dayS?.graceMinutes   || 60))
      await shiftSettingsApi.update('night', nightTime || nightS?.startTime || '18:00', Number(nightGrace || nightS?.graceMinutes || 60))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <div className="card">
      <div className="card-header"><h3>Shift Başlangy Wagty</h3></div>
      <div className="card-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Işçiler bu wagt + çäk sagadyna çenli gelmese, "Gelmedi" bildirişi çykar.
          </p>
          {/* Day shift */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-row">
              <label className="form-label"><Sun size={12} style={{ display: 'inline', marginRight: 4 }} />Gündiz başlangy</label>
              <input type="time" value={dayTime || dayS?.startTime || '07:00'}
                onChange={e => setDayTime(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Çäk (minut)</label>
              <input type="number" min="0" max="120" value={dayGrace || String(dayS?.graceMinutes ?? 60)}
                onChange={e => setDayGrace(e.target.value)} />
            </div>
          </div>
          {/* Night shift */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-row">
              <label className="form-label"><Moon size={12} style={{ display: 'inline', marginRight: 4 }} />Gije başlangy</label>
              <input type="time" value={nightTime || nightS?.startTime || '18:00'}
                onChange={e => setNightTime(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Çäk (minut)</label>
              <input type="number" min="0" max="120" value={nightGrace || String(nightS?.graceMinutes ?? 60)}
                onChange={e => setNightGrace(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn--primary btn--sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saklanýar…' : 'Sakla'}
            </button>
            {saved && <span style={{ fontSize: 12, color: 'var(--success)' }}>✓ Saklandi</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminTokenCard() {
  const [token, setToken] = useState(() => localStorage.getItem('adminToken') ?? '')
  const [saved, setSaved] = useState(false)

  const save = () => {
    if (token.trim()) {
      localStorage.setItem('adminToken', token.trim())
    } else {
      localStorage.removeItem('adminToken')
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="card">
      <div className="card-header"><h3><KeyRound size={14} style={{ display: 'inline', marginRight: 6 }} />Admin Token</h3></div>
      <div className="card-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Backend API-ä girişmek üçin token. Boş goýsaňyz — token iberilmez.
          </p>
          <div className="form-row">
            <label className="form-label">Token</label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="workhour-admin-2025"
              autoComplete="off"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn--primary btn--sm" onClick={save}>Sakla</button>
            {saved && <span style={{ fontSize: 12, color: 'var(--success)' }}>✓ Saklandi</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const { theme, setTheme, language, setLanguage, user } = useUiPreferences()

  return (
    <>
      <div className="page-header">
        <h1>{t.settings.title}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, maxWidth: 720 }}>
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
        <AdminTokenCard />
      </div>
    </>
  )
}
