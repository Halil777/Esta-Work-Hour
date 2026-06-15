import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { LoginPage } from '../pages/LoginPage'

const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
)
const ObjectsPage = lazy(() =>
  import('../pages/ObjectsPage').then((module) => ({ default: module.ObjectsPage })),
)
const WorkforcePage = lazy(() =>
  import('../pages/WorkforcePage').then((module) => ({ default: module.WorkforcePage })),
)
const RolesPage = lazy(() =>
  import('../pages/RolesPage').then((module) => ({ default: module.RolesPage })),
)
const QrControlPage = lazy(() =>
  import('../pages/QrControlPage').then((module) => ({ default: module.QrControlPage })),
)
const ReportsPage = lazy(() =>
  import('../pages/ReportsPage').then((module) => ({ default: module.ReportsPage })),
)
const AuditPage = lazy(() =>
  import('../pages/AuditPage').then((module) => ({ default: module.AuditPage })),
)
const SettingsPage = lazy(() =>
  import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)

function withSuspense(page: ReactNode) {
  return <Suspense fallback={<div className="route-loader">Loading...</div>}>{page}</Suspense>
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: withSuspense(<DashboardPage />) },
      { path: 'objects', element: withSuspense(<ObjectsPage />) },
      { path: 'workforce', element: withSuspense(<WorkforcePage />) },
      { path: 'roles', element: withSuspense(<RolesPage />) },
      { path: 'qr-control', element: withSuspense(<QrControlPage />) },
      { path: 'reports', element: withSuspense(<ReportsPage />) },
      { path: 'audit', element: withSuspense(<AuditPage />) },
      { path: 'settings', element: withSuspense(<SettingsPage />) },
    ],
  },
])
