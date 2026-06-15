import { useState } from 'react'
import { Save, Sun, Moon, Check } from 'lucide-react'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { getTranslation } from '../i18n/translations'
import { settingsGroups } from '../data/mock-data'
import type { Language } from '../types/admin'

export function SettingsPage() {
  const { language, theme, setLanguage, setTheme, user } = useUiPreferences()
  const t = getTranslation(language)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      SuperAdmin: t.settings.superAdmin,
      CentralHR: t.settings.centralHR,
      RegionalManager: t.settings.regionalManager,
      SystemAdmin: t.settings.systemAdmin,
      Auditor: t.settings.auditorRole,
    }
    return map[role] ?? role
  }

  const LANGS: { code: Language; label: string }[] = [
    { code: 'ru', label: 'Русский' },
    { code: 'en', label: 'English' },
    { code: 'tr', label: 'Türkçe' },
  ]

  return (
    <>
      <div className="page-header">
        <h1>{t.settings.title}</h1>
        <div className="page-actions">
          <button className="btn btn--primary btn--sm" onClick={handleSave}>
            {saved ? <Check size={13} /> : <Save size={13} />}
            {saved ? t.settings.saved : t.settings.saveChanges}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header"><h3>{t.settings.account}</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-sm text-muted">{t.common.name}</span>
                <span className="text-sm fw-600">{user?.name ?? 'Super Admin'}</span>
              </div>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-sm text-muted">{t.settings.role}</span>
                <span className="badge badge--primary">{roleLabel(user?.role ?? 'SuperAdmin')}</span>
              </div>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-sm text-muted">Email</span>
                <span className="text-sm td-mono">{user?.email ?? 'admin@esta.build'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t.settings.preferences}</h3></div>
          <div className="card-body">
            <div style={{ marginBottom: 18 }}>
              <div className="text-sm text-muted" style={{ marginBottom: 8 }}>{t.settings.theme}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn btn--sm ${theme === 'dark' ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={() => setTheme('dark')}
                >
                  <Moon size={13} />{t.settings.darkMode}
                </button>
                <button
                  className={`btn btn--sm ${theme === 'light' ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={() => setTheme('light')}
                >
                  <Sun size={13} />{t.settings.lightMode}
                </button>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted" style={{ marginBottom: 8 }}>{t.settings.language}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {LANGS.map(l => (
                  <button
                    key={l.code}
                    className={`btn btn--sm ${language === l.code ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={() => setLanguage(l.code)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {settingsGroups.map(group => (
          <div key={group.title} className="card">
            <div className="card-header"><h3>{group.title}</h3></div>
            <div className="card-body card-body--p0">
              {group.items.map(item => (
                <div key={item.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderBottom: '1px solid var(--border)',
                }}>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.key}</span>
                  <span className="text-sm fw-600">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
