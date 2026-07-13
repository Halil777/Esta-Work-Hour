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
    '/attendance': t.nav.attendance,
    '/overtime': t.nav.overtime,
    '/absence': t.nav.absence,
    '/reports': 'İş Sagat Hasabaty',
    '/sync-center': t.nav.syncCenter,
    '/settings': t.nav.settings,
  }
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
