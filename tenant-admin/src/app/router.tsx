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
import { WorkerDetailPage } from '../pages/WorkerDetailPage'
import { LateArrivalsPage } from '../pages/LateArrivalsPage'
import { ReportsPage } from '../pages/ReportsPage'
import { ScannerDevicesPage } from '../pages/ScannerDevicesPage'
import { CardReportsPage } from '../pages/CardReportsPage'
import { WorkTimePage } from '../pages/WorkTimePage'
import { WorkTimesheetPage } from '../pages/WorkTimesheetPage'
import { AdjustmentReasonsPage } from '../pages/AdjustmentReasonsPage'
import { WorkTimeDayPage } from '../pages/WorkTimeDayPage'
import { AdjustmentsAnalyticsPage } from '../pages/AdjustmentsAnalyticsPage'
import { InboxPage } from '../pages/InboxPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/inbox" replace /> },
      { path: 'inbox', element: <InboxPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'workers', element: <WorkersPage /> },
      { path: 'workers/:id', element: <WorkerDetailPage /> },
      { path: 'brigades', element: <BrigadesPage /> },
      { path: 'overtime', element: <OvertimePage /> },
      { path: 'nfc-events', element: <NfcEventsPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'absent-today', element: <AbsentTodayPage /> },
      { path: 'site-chiefs', element: <SiteChiefsPage /> },
      { path: 'section-chiefs', element: <SectionChiefsPage /> },
      { path: 'terminated-workers', element: <TerminatedWorkersPage /> },
      { path: 'late-arrivals', element: <LateArrivalsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'scanner-devices', element: <ScannerDevicesPage /> },
      { path: 'card-reports', element: <CardReportsPage /> },
      { path: 'work-time', element: <WorkTimePage /> },
      { path: 'work-time/reasons', element: <AdjustmentReasonsPage /> },
      { path: 'work-time/day', element: <WorkTimeDayPage /> },
      { path: 'work-time/analytics', element: <AdjustmentsAnalyticsPage /> },
      { path: 'work-time/:workerEntityId', element: <WorkTimesheetPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/inbox" replace /> },
])
