import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { LoginPage } from '../pages/LoginPage'
import { DashboardPage } from '../pages/DashboardPage'
import { WorkersPage } from '../pages/WorkersPage'
import { BrigadesPage } from '../pages/BrigadesPage'
import { OvertimePage } from '../pages/OvertimePage'
import { SettingsPage } from '../pages/SettingsPage'
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
      { path: 'overtime', element: <OvertimePage /> },
      { path: 'nfc-events', element: <NfcEventsPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'absent-today', element: <AbsentTodayPage /> },
      { path: 'site-chiefs', element: <SiteChiefsPage /> },
      { path: 'section-chiefs', element: <SectionChiefsPage /> },
      { path: 'terminated-workers', element: <TerminatedWorkersPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
