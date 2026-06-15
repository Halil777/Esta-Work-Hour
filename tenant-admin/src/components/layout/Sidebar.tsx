import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Building2, LayoutDashboard, Users, Layers, ClipboardCheck, Clock,
  UserX, FileSpreadsheet, RefreshCw, Settings, LogOut, KeyRound,
  ScanLine, History, WifiOff, ShieldCheck, HardHat,
} from 'lucide-react'
import { useUiPreferences } from '../../app/providers/useUiPreferences'
import { useTranslation } from '../../i18n/useTranslation'

export function Sidebar() {
  const { user, logout } = useUiPreferences()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const navItems: { path: string; icon: React.ElementType; label: string; badge?: number }[] = [
    { path: '/dashboard', icon: LayoutDashboard, label: t.nav.dashboard },
    { path: '/workers', icon: Users, label: t.nav.workers },
    { path: '/brigades', icon: Layers, label: t.nav.brigades },
    { path: '/attendance', icon: ClipboardCheck, label: t.nav.attendance },
    { path: '/overtime', icon: Clock, label: t.nav.overtime },
    { path: '/site-chiefs', icon: ShieldCheck, label: 'Site Chiefs' },
    { path: '/section-chiefs', icon: HardHat, label: 'Bölüm Başlyklary' },
    { path: '/absence', icon: UserX, label: t.nav.absence },
    { path: '/reports', icon: FileSpreadsheet, label: t.nav.reports },
    { path: '/access-report', icon: KeyRound, label: t.nav.accessReport },
    { path: '/absent-today', icon: WifiOff, label: 'Skan etmedikler' },
    { path: '/nfc-events', icon: ScanLine, label: t.nav.nfcEvents },
    { path: '/history', icon: History, label: t.nav.history },
    { path: '/sync-center', icon: RefreshCw, label: t.nav.syncCenter },
    { path: '/settings', icon: Settings, label: t.nav.settings },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.name.split(' ').map(n => n[0]).join('').slice(0, 2) ?? 'UA'

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Building2 size={14} color="#fff" />
        </div>
        <div className="sidebar-logo-text">
          <div className="company">Esta Construction</div>
          <div className="object-name">{user?.objectName ?? 'Kazan Object'}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <item.icon size={16} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge !== undefined && (
              <span className="nav-badge">{item.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card" onClick={handleLogout} title={t.common.logout}>
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.name ?? 'Object Admin'}</div>
            <div className="user-role">{user?.role ?? 'Admin'}</div>
          </div>
          <LogOut size={14} color="rgba(255,255,255,0.25)" />
        </div>
      </div>
    </aside>
  )
}
