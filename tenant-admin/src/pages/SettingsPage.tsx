import { Sun, Moon } from 'lucide-react'
import { useTranslation } from '../i18n/useTranslation'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import type { Language } from '../types/tenant'

const LANGS: Array<{ key: Language; label: string }> = [
  { key: 'ru', label: 'Русский' },
  { key: 'en', label: 'English' },
  { key: 'tr', label: 'Türkçe' },
]

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
      </div>
    </>
  )
}
