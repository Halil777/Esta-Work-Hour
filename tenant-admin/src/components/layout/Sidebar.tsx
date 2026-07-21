import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Building2, LayoutDashboard, Users, Layers, Clock,
  Settings, LogOut,
  ScanLine, History, WifiOff, ShieldCheck, HardHat, UserMinus, AlarmClock,
  FileSpreadsheet,
} from 'lucide-react'
import { useUiPreferences } from '../../app/providers/useUiPreferences'
import { useTranslation } from '../../i18n/useTranslation'

export function Sidebar() {
  const { user, logout } = useUiPreferences()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const navItems: { path: string; icon: React.ElementType; label: string; section: string; badge?: number }[] = [
    { path: '/dashboard', icon: LayoutDashboard, label: t.nav.dashboard, section: 'Overview' },
    { path: '/workers', icon: Users, label: t.nav.workers, section: 'Workforce' },
    { path: '/brigades', icon: Layers, label: t.nav.brigades, section: 'Workforce' },
    { path: '/site-chiefs', icon: ShieldCheck, label: 'Site Chiefs', section: 'Workforce' },
    { path: '/section-chiefs', icon: HardHat, label: 'Bölüm Başlyklary', section: 'Workforce' },
    { path: '/terminated-workers', icon: UserMinus, label: 'İşden Bosadylanlar', section: 'Workforce' },
    { path: '/absent-today', icon: WifiOff, label: 'Skan etmedikler', section: 'Attendance' },
    { path: '/late-arrivals', icon: AlarmClock, label: 'Gijä galan işçiler', section: 'Attendance' },
    { path: '/nfc-events', icon: ScanLine, label: t.nav.nfcEvents, section: 'Attendance' },
    { path: '/overtime', icon: Clock, label: t.nav.overtime, section: 'Approvals' },
    { path: '/reports', icon: FileSpreadsheet, label: 'İş Sagat Hasabaty', section: 'Reports' },
    { path: '/history', icon: History, label: t.nav.history, section: 'System' },
    { path: '/settings', icon: Settings, label: t.nav.settings, section: 'System' },
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
        {navItems.map((item, index) => {
          const showSection = index === 0 || navItems[index - 1].section !== item.section
          return (
            <React.Fragment key={item.path}>
              {showSection && <div className="sidebar-section-label">{item.section}</div>}
              <NavLink
                to={item.path}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <item.icon size={16} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </NavLink>
            </React.Fragment>
          )
        })}
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
