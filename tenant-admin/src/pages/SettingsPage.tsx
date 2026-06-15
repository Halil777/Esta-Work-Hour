import { useState } from 'react'
import { Sun, Moon, Plus, X, Save, Check } from 'lucide-react'
import { useTranslation } from '../i18n/useTranslation'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import type { Language } from '../types/tenant'

const DEFAULT_REASONS = ['Sick Leave', 'Medical Point', 'Vacation', 'Business Trip', 'Unauthorized', 'No Information', 'Suspended']

const LANGS: Array<{ key: Language; label: string }> = [
  { key: 'ru', label: 'Русский' },
  { key: 'en', label: 'English' },
  { key: 'tr', label: 'Türkçe' },
]

export function SettingsPage() {
  const { t } = useTranslation()
  const { theme, setTheme, language, setLanguage, user } = useUiPreferences()
  const [saved, setSaved] = useState(false)
  const [reasons, setReasons] = useState(DEFAULT_REASONS)
  const [newReason, setNewReason] = useState('')
  const [object, setObject] = useState({
    name: 'Kazan Object',
    city: 'Kazan, Tatarstan',
    address: 'ul. Stroitelnaya 14, Kazan',
    siteChief: 'Dmitry Kozlov',
    shiftStart: '07:00',
    shiftEnd: '19:00',
    workHours: '11',
  })

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addReason = () => {
    const trimmed = newReason.trim()
    if (trimmed && !reasons.includes(trimmed)) {
      setReasons(prev => [...prev, trimmed])
      setNewReason('')
    }
  }

  const removeReason = (r: string) => {
    setReasons(prev => prev.filter(x => x !== r))
  }

  return (
    <>
      <div className="page-header">
        <h1>{t.settings.title}</h1>
        <div className="page-actions">
          <button className="btn btn--primary btn--sm" onClick={handleSave}>
            {saved ? <><Check size={13} />{t.settings.saved}</> : <><Save size={13} />{t.settings.saveChanges}</>}
          </button>
        </div>
      </div>

      <div className="settings-grid">
        <div className="card">
          <div className="card-header"><h3>{t.settings.objectInfo}</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-row">
                <label className="form-label">{t.settings.objectName}</label>
                <input value={object.name} onChange={e => setObject(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-row">
                <label className="form-label">{t.settings.objectCity}</label>
                <input value={object.city} onChange={e => setObject(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="form-row">
                <label className="form-label">{t.settings.objectAddress}</label>
                <input value={object.address} onChange={e => setObject(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="form-row">
                <label className="form-label">{t.settings.siteChief}</label>
                <input value={object.siteChief} onChange={e => setObject(p => ({ ...p, siteChief: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header"><h3>{t.settings.schedule}</h3></div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div className="form-row">
                  <label className="form-label">{t.settings.shiftStart}</label>
                  <input type="time" value={object.shiftStart} onChange={e => setObject(p => ({ ...p, shiftStart: e.target.value }))} />
                </div>
                <div className="form-row">
                  <label className="form-label">{t.settings.shiftEnd}</label>
                  <input type="time" value={object.shiftEnd} onChange={e => setObject(p => ({ ...p, shiftEnd: e.target.value }))} />
                </div>
                <div className="form-row">
                  <label className="form-label">{t.settings.workHours}</label>
                  <input type="number" value={object.workHours} onChange={e => setObject(p => ({ ...p, workHours: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

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
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>{t.settings.absenceReasons}</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={newReason}
              onChange={e => setNewReason(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addReason() }}
              placeholder={t.settings.addReason + '...'}
              style={{ flex: 1 }}
            />
            <button className="btn btn--primary" onClick={addReason}><Plus size={14} /></button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {reasons.map(r => (
              <div key={r} className="reason-tag">
                <span>{r}</span>
                <button onClick={() => removeReason(r)} style={{ marginLeft: 8 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
