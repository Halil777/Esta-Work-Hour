import { Outlet, useLocation, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useUiPreferences } from '../../app/providers/useUiPreferences'
import { getTranslation } from '../../i18n/translations'

function getTitle(pathname: string, t: ReturnType<typeof getTranslation>) {
  const map: Record<string, string> = {
    '/dashboard': t.nav.dashboard,
    '/objects': t.nav.objects,
    '/workforce': t.nav.workforce,
    '/roles': t.nav.roles,
    '/qr-control': t.nav.qrControl,
    '/reports': t.nav.reports,
    '/audit': t.nav.audit,
    '/settings': t.nav.settings,
  }
  return map[pathname] ?? 'Super Admin'
}

export function AppShell() {
  const { user, language } = useUiPreferences()
  const location = useLocation()
  const t = getTranslation(language)

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="app-root">
      <Sidebar />
      <div className="main-area">
        <Header title={getTitle(location.pathname, t)} />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
