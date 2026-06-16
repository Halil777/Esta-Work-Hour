import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { LoginPage } from '../pages/LoginPage'
import { DashboardPage } from '../pages/DashboardPage'
import { WorkersPage } from '../pages/WorkersPage'
import { BrigadesPage } from '../pages/BrigadesPage'
import { AttendancePage } from '../pages/AttendancePage'
import { OvertimePage } from '../pages/OvertimePage'
import { AbsencePage } from '../pages/AbsencePage'
import { ReportsPage } from '../pages/ReportsPage'
import { SyncCenterPage } from '../pages/SyncCenterPage'
import { SettingsPage } from '../pages/SettingsPage'
import { AccessReportPage } from '../pages/AccessReportPage'
import { NfcEventsPage } from '../pages/NfcEventsPage'
import { HistoryPage } from '../pages/HistoryPage'
import { AbsentTodayPage } from '../pages/AbsentTodayPage'
import { SiteChiefsPage } from '../pages/SiteChiefsPage'
import { SectionChiefsPage } from '../pages/SectionChiefsPage'
import { TerminatedWorkersPage } from '../pages/TerminatedWorkersPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'workers', element: <WorkersPage /> },
      { path: 'brigades', element: <BrigadesPage /> },
      { path: 'attendance', element: <AttendancePage /> },
      { path: 'overtime', element: <OvertimePage /> },
      { path: 'absence', element: <AbsencePage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'access-report', element: <AccessReportPage /> },
      { path: 'nfc-events', element: <NfcEventsPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'absent-today', element: <AbsentTodayPage /> },
      { path: 'site-chiefs', element: <SiteChiefsPage /> },
      { path: 'section-chiefs', element: <SectionChiefsPage /> },
      { path: 'terminated-workers', element: <TerminatedWorkersPage /> },
      { path: 'sync-center', element: <SyncCenterPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
