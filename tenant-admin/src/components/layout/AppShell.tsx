import { Outlet, useLocation, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useUiPreferences } from '../../app/providers/useUiPreferences'
import { useTranslation } from '../../i18n/useTranslation'

function getPageTitle(pathname: string, t: ReturnType<typeof import('../../i18n/useTranslation').useTranslation>['t']) {
  const map: Record<string, string> = {
    '/dashboard': t.nav.dashboard,
    '/workers': t.nav.workers,
    '/brigades': t.nav.brigades,
    '/overtime': t.nav.overtime,
    '/nfc-events': t.nav.nfcEvents,
    '/history': t.nav.history,
    '/absent-today': 'Skan etmedikler',
    '/late-arrivals': 'Gijä galan işçiler',
    '/site-chiefs': 'Site Chiefs',
    '/section-chiefs': 'Bölüm Başlyklary',
    '/terminated-workers': 'İşden Bosadylanlar',
    '/reports': 'İş Sagat Hasabaty',
    '/settings': t.nav.settings,
  }
  if (pathname.startsWith('/workers/')) return 'İşçi profili'
  return map[pathname] ?? 'Tenant Admin'
}

export function AppShell() {
  const { user } = useUiPreferences()
  const location = useLocation()
  const { t } = useTranslation()

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="app-root">
      <Sidebar />
      <div className="main-area">
        <Header title={getPageTitle(location.pathname, t)} />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
