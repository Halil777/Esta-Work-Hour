import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Building2, LayoutDashboard, Users, Layers, Clock,
  Settings, LogOut, Inbox as InboxIcon,
  ScanLine, History, WifiOff, ShieldCheck, HardHat, UserMinus, AlarmClock,
  FileSpreadsheet, Smartphone, CreditCard, Timer, ListChecks, CalendarDays, BarChart3,
} from 'lucide-react'
import { useUiPreferences } from '../../app/providers/useUiPreferences'
import { useTranslation } from '../../i18n/useTranslation'
import { adminInboxApi } from '../../api/adminInbox'

export function Sidebar() {
  const { user, logout } = useUiPreferences()
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Same poll cadence as the Inbox page itself, so the badge is never far
  // behind what the page would show if opened right now.
  const { data: inbox } = useQuery({
    queryKey: ['admin-inbox'],
    queryFn: () => adminInboxApi.get(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const navItems: { path: string; icon: React.ElementType; label: string; section: string; badge?: number }[] = [
    { path: '/inbox', icon: InboxIcon, label: t.nav.inbox, section: t.sidebar.overview, badge: inbox?.counts.total ? inbox.counts.total : undefined },
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
    { path: '/work-time', icon: Timer, label: t.nav.workTime, section: t.sidebar.workTime },
    { path: '/work-time/day', icon: CalendarDays, label: t.nav.workTimeDay, section: t.sidebar.workTime },
    { path: '/work-time/analytics', icon: BarChart3, label: t.nav.adjustmentsAnalytics, section: t.sidebar.workTime },
    { path: '/work-time/reasons', icon: ListChecks, label: t.nav.adjustmentReasons, section: t.sidebar.workTime },
    { path: '/card-reports', icon: CreditCard, label: t.nav.cardReports, section: t.sidebar.system },
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
