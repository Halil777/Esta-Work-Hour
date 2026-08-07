import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, Users, ShieldCheck, FileSpreadsheet, Settings2, Globe, LogOut } from 'lucide-react'
import { useUiPreferences } from '../../app/providers/useUiPreferences'
import { getTranslation } from '../../i18n/translations'

export function Sidebar() {
  const { user, logout, language } = useUiPreferences()
  const t = getTranslation(language)
  const navigate = useNavigate()

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t.nav.dashboard },
    { path: '/tenants', icon: Building2, label: 'Tenantlar' },
    { path: '/workforce', icon: Users, label: t.nav.workforce },
    { path: '/roles', icon: ShieldCheck, label: t.nav.roles },
    { path: '/reports', icon: FileSpreadsheet, label: t.nav.reports },
    { path: '/settings', icon: Settings2, label: t.nav.settings },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.name.split(' ').map(n => n[0]).join('').slice(0, 2) ?? 'SA'

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Globe size={14} color="#fff" />
        </div>
        <div className="sidebar-logo-text">
          <div className="company">WorkHour</div>
          <div className="portal-name">Super Admin Portal</div>
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
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card" onClick={handleLogout} title={t.common.logout}>
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.name ?? 'Super Admin'}</div>
            <div className="user-role">{user?.role ?? 'SuperAdmin'}</div>
          </div>
          <LogOut size={14} color="rgba(255,255,255,0.25)" />
        </div>
      </div>
    </aside>
  )
}
