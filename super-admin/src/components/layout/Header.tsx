import { Sun, Moon, Bell, Search } from 'lucide-react'
import { useUiPreferences } from '../../app/providers/useUiPreferences'
import { getTranslation } from '../../i18n/translations'
import type { Language } from '../../types/admin'

type Props = { title: string }

const LANGS: { key: Language; label: string }[] = [
  { key: 'ru', label: 'RU' },
  { key: 'en', label: 'EN' },
  { key: 'tr', label: 'TR' },
]

export function Header({ title }: Props) {
  const { theme, language, toggleTheme, setLanguage } = useUiPreferences()
  const t = getTranslation(language)

  return (
    <header className="header">
      <h2 className="header-title">{title}</h2>

      <div className="header-search" style={{ flex: 1, maxWidth: 320 }}>
        <Search size={14} />
        <input placeholder={t.common.search + '...'} />
      </div>

      <div className="header-actions">
        <div className="lang-switcher">
          {LANGS.map(l => (
            <button
              key={l.key}
              className={`lang-btn${language === l.key ? ' active' : ''}`}
              onClick={() => setLanguage(l.key)}
            >
              {l.label}
            </button>
          ))}
        </div>

        <button className="icon-btn" onClick={toggleTheme} title={theme === 'dark' ? t.settings.lightMode : t.settings.darkMode}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button className="icon-btn">
          <Bell size={16} />
        </button>
      </div>
    </header>
  )
}
