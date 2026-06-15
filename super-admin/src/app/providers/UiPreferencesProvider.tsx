import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { Language, ThemeMode, AuthUser } from '../../types/admin'

type UiPreferencesValue = {
  language: Language
  theme: ThemeMode
  user: AuthUser | null
  setLanguage: (language: Language) => void
  toggleTheme: () => void
  setTheme: (theme: ThemeMode) => void
  login: (user: AuthUser) => void
  logout: () => void
}

const defaultValue: UiPreferencesValue = {
  language: 'ru',
  theme: 'dark',
  user: null,
  setLanguage: () => undefined,
  toggleTheme: () => undefined,
  setTheme: () => undefined,
  login: () => undefined,
  logout: () => undefined,
}

export const UiPreferencesContext = createContext<UiPreferencesValue>(defaultValue)

const THEME_KEY = 'super-admin-theme'
const LANG_KEY = 'super-admin-language'
const USER_KEY = 'super-admin-user'

function getStored<T>(key: string, fallback: T): T {
  try {
    const val = window.localStorage.getItem(key)
    return val ? JSON.parse(val) : fallback
  } catch {
    return fallback
  }
}

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => getStored(THEME_KEY, 'dark'))
  const [language, setLanguageState] = useState<Language>(() => getStored(LANG_KEY, 'ru'))
  const [user, setUser] = useState<AuthUser | null>(() => getStored(USER_KEY, null))

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_KEY, JSON.stringify(theme))
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem(LANG_KEY, JSON.stringify(language))
  }, [language])

  const login = (u: AuthUser) => {
    setUser(u)
    window.localStorage.setItem(USER_KEY, JSON.stringify(u))
  }

  const logout = () => {
    setUser(null)
    window.localStorage.removeItem(USER_KEY)
  }

  return (
    <UiPreferencesContext.Provider
      value={{
        language,
        theme,
        user,
        setLanguage: setLanguageState,
        toggleTheme: () => setThemeState(t => t === 'dark' ? 'light' : 'dark'),
        setTheme: setThemeState,
        login,
        logout,
      }}
    >
      {children}
    </UiPreferencesContext.Provider>
  )
}
