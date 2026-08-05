import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Building2, LayoutDashboard, Users, Layers, Clock,
  Settings, LogOut,
  ScanLine, History, WifiOff, ShieldCheck, HardHat, UserMinus, AlarmClock,
  FileSpreadsheet, Smartphone,
} from 'lucide-react'
import { useUiPreferences } from '../../app/providers/useUiPreferences'
import { useTranslation } from '../../i18n/useTranslation'

export function Sidebar() {
  const { user, logout } = useUiPreferences()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const navItems: { path: string; icon: React.ElementType; label: string; section: string; badge?: number }[] = [
    { path: '/dashboard', icon: LayoutDashboard, label: t.nav.dashboard, section: t.sidebar.overview },
    { path: '/workers', icon: Users, label: t.nav.workers, section: t.sidebar.workforce },
    { path: '/brigades', icon: Layers, label: t.nav.brigades, section: t.sidebar.workforce },
    { path: '/site-chiefs', icon: ShieldCheck, label: t.nav.siteChiefs, section: t.sidebar.workforce },
    { path: '/section-chiefs', icon: HardHat, label: t.nav.sectionChiefs, section: t.sidebar.workforce },
    { path: '/terminated-workers', icon: UserMinus, label: t.nav.terminatedWorkers, section: t.sidebar.workforce },
    { path: '/absent-today', icon: WifiOff, label: t.nav.absent, section: t.sidebar.attendance },
    { path: '/late-arrivals', icon: AlarmClock, label: t.nav.lateArrivals, section: t.sidebar.attendance },
    { path: '/nfc-events', icon: ScanLine, label: t.nav.nfcEvents, section: t.sidebar.attendance },
    { path: '/overtime', icon: Clock, label: t.nav.overtime, section: t.sidebar.approvals },
    { path: '/reports', icon: FileSpreadsheet, label: t.nav.workHoursReport, section: t.sidebar.reports },
    { path: '/history', icon: History, label: t.nav.history, section: t.sidebar.system },
    { path: '/scanner-devices', icon: Smartphone, label: 'NFC Enjamlar', section: t.sidebar.system },
    { path: '/settings', icon: Settings, label: t.nav.settings, section: t.sidebar.system },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.name.split(' ').map(n => n[0]).join('').slice(0, 2) ?? 'UA'

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        {user?.logoUrl ? (
          <img
            src={user.logoUrl}
            alt={user.name}
            style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', background: '#fff', flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="sidebar-logo-icon">
            <Building2 size={14} color="#fff" />
          </div>
        )}
        <div className="sidebar-logo-text">
          <div className="company">{user?.name ?? 'Tenant Admin'}</div>
          <div className="object-name">{user?.objectName ?? 'Admin Panel'}</div>
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
          <LogOut size={14} className="sidebar-logout-icon" />
        </div>
      </div>
    </aside>
  )
}
