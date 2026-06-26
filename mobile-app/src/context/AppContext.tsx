import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AuthUser, Language, Theme, AttendanceRecord, OvertimeRequest, SyncQueueItem } from '../types'
import { dark, light } from '../theme/colors'
import { getT } from '../i18n/translations'
import { setToken, foremanApi, type MobileWorker } from '../api'
import { registerPushToken, savePushTokenToServer } from '../notifications'

interface AppState {
  user: AuthUser | null
  token: string | null
  language: Language
  theme: Theme
  isOnline: boolean
  syncQueue: SyncQueueItem[]
  attendance: AttendanceRecord[]
  overtimeRequests: OvertimeRequest[]
  cachedWorkers: MobileWorker[]
  colors: typeof dark
  t: ReturnType<typeof getT>
  login: (user: AuthUser, token: string) => void
  logout: () => void
  setLanguage: (lang: Language) => void
  toggleTheme: () => void
  addAttendance: (record: AttendanceRecord) => void
  updateAttendance: (id: string, status: AttendanceRecord['status'], reason?: string) => void
  addOvertimeRequest: (req: OvertimeRequest) => void
  updateOvertimeStatus: (id: string, status: OvertimeRequest['status'], comment?: string, reviewer?: string) => void
  syncNow: () => Promise<void>
  refreshWorkers: () => Promise<void>
}

const AppContext = createContext<AppState | null>(null)

const KEYS = { user: 'app_user', token: 'app_token', lang: 'app_lang', theme: 'app_theme', queue: 'app_sync_queue', attendance: 'app_attendance', workers: 'app_workers_cache' }

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setTokenState] = useState<string | null>(null)
  const [language, setLangState] = useState<Language>('ru')
  const [theme, setThemeState] = useState<Theme>('dark')
  const [isOnline, setIsOnline] = useState(true)
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([])
  const [cachedWorkers, setCachedWorkers] = useState<MobileWorker[]>([])

  useEffect(() => {
    const load = async () => {
      const [u, tk, l, th, wc] = await Promise.all([
        AsyncStorage.getItem(KEYS.user),
        AsyncStorage.getItem(KEYS.token),
        AsyncStorage.getItem(KEYS.lang),
        AsyncStorage.getItem(KEYS.theme),
        AsyncStorage.getItem(KEYS.workers),
      ])
      if (u) setUser(JSON.parse(u))
      if (tk) { setTokenState(tk); setToken(tk) }
      if (l) setLangState(l as Language)
      if (th) setThemeState(th as Theme)
      if (wc) setCachedWorkers(JSON.parse(wc))
    }
    load()
  }, [])

  const login = useCallback((u: AuthUser, tk: string) => {
    setUser(u)
    setTokenState(tk)
    setToken(tk)
    AsyncStorage.setItem(KEYS.user, JSON.stringify(u))
    AsyncStorage.setItem(KEYS.token, tk)
    // Register push notifications after login
    registerPushToken().then(pushToken => {
      if (pushToken) savePushTokenToServer(pushToken)
    })
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setTokenState(null)
    setToken(null)
    setCachedWorkers([])
    AsyncStorage.removeItem(KEYS.user)
    AsyncStorage.removeItem(KEYS.token)
    AsyncStorage.removeItem(KEYS.workers)
  }, [])

  const refreshWorkers = useCallback(async () => {
    try {
      const data = await foremanApi.myWorkers()
      setCachedWorkers(data)
      AsyncStorage.setItem(KEYS.workers, JSON.stringify(data))
    } catch {
      // silently fail — use cached
    }
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLangState(lang)
    AsyncStorage.setItem(KEYS.lang, lang)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      AsyncStorage.setItem(KEYS.theme, next)
      return next
    })
  }, [])

  const addAttendance = useCallback((record: AttendanceRecord) => {
    setAttendance(prev => {
      const filtered = prev.filter(r => r.workerId !== record.workerId || r.date !== record.date)
      return [...filtered, record]
    })
    if (!isOnline) {
      setSyncQueue(prev => [...prev, {
        id: record.id, type: 'attendance', data: record,
        timestamp: Date.now(), status: 'pending',
      }])
    }
  }, [isOnline])

  const updateAttendance = useCallback((id: string, status: AttendanceRecord['status'], reason?: string) => {
    setAttendance(prev => prev.map(r =>
      r.id === id ? { ...r, status, reason: reason ?? r.reason } : r
    ))
  }, [])

  const addOvertimeRequest = useCallback((req: OvertimeRequest) => {
    setOvertimeRequests(prev => [req, ...prev])
  }, [])

  const updateOvertimeStatus = useCallback((id: string, status: OvertimeRequest['status'], comment?: string, reviewer?: string) => {
    setOvertimeRequests(prev => prev.map(r =>
      r.id === id ? { ...r, status, reviewComment: comment ?? r.reviewComment, reviewedBy: reviewer ?? r.reviewedBy } : r
    ))
  }, [])

  const syncNow = useCallback(async () => {
    setSyncQueue(prev => prev.map(i => ({ ...i, status: 'syncing' as const })))
    await new Promise(r => setTimeout(r, 1500))
    setSyncQueue(prev => prev.map(i => ({ ...i, status: 'synced' as const })))
    setAttendance(prev => prev.map(r =>
      r.syncStatus === 'local' || r.syncStatus === 'pending' ? { ...r, syncStatus: 'synced' } : r
    ))
  }, [])

  const colors = theme === 'dark' ? dark : light
  const t = getT(language)

  return (
    <AppContext.Provider value={{
      user, token, language, theme, isOnline, syncQueue, attendance, overtimeRequests,
      cachedWorkers, colors, t, login, logout, setLanguage, toggleTheme,
      addAttendance, updateAttendance, addOvertimeRequest, updateOvertimeStatus, syncNow,
      refreshWorkers,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
