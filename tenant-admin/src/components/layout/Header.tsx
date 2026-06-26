import { Sun, Moon, Bell, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUiPreferences } from '../../app/providers/useUiPreferences'
import { useTranslation } from '../../i18n/useTranslation'
import type { Language } from '../../types/tenant'

type Props = { title: string }

const LANGS: { key: Language; label: string }[] = [
  { key: 'ru', label: 'RU' },
  { key: 'en', label: 'EN' },
  { key: 'tr', label: 'TR' },
]

export function Header({ title }: Props) {
  const { theme, language, toggleTheme, setLanguage, logout } = useUiPreferences()
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <header className="header">
      <h2 className="header-title">{title}</h2>
      <div className="header-actions">
        <div className="lang-switcher">
          {LANGS.map(l => (
            <button
              key={l.key}
              className={`lang-btn${language === l.key ? ' active' : ''}`}
              onClick={() => setLanguage(l.key)}
              aria-label={l.label}
            >
              {l.label}
            </button>
          ))}
        </div>

        <button className="icon-btn" onClick={toggleTheme} title={theme === 'dark' ? t.settings.lightMode : t.settings.darkMode}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button className="icon-btn" title="Notifications">
          <Bell size={16} />
        </button>

        <button
          className="icon-btn"
          title="Çykış"
          onClick={() => { logout(); navigate('/login', { replace: true }) }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
