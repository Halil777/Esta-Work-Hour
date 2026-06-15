import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  Building2,
  ChartColumnBig,
  FileSpreadsheet,
  Fingerprint,
  ScanLine,
  Settings2,
  ShieldCheck,
} from 'lucide-react'

export type NavItemKey =
  | 'dashboard'
  | 'objects'
  | 'workforce'
  | 'roles'
  | 'qrControl'
  | 'reports'
  | 'audit'
  | 'settings'

export type NavigationItem = {
  key: NavItemKey
  path: string
  icon: LucideIcon
}

export const navigationItems: NavigationItem[] = [
  { key: 'dashboard', path: '/dashboard', icon: ChartColumnBig },
  { key: 'objects', path: '/objects', icon: Building2 },
  { key: 'workforce', path: '/workforce', icon: BadgeCheck },
  { key: 'roles', path: '/roles', icon: ShieldCheck },
  { key: 'qrControl', path: '/qr-control', icon: ScanLine },
  { key: 'reports', path: '/reports', icon: FileSpreadsheet },
  { key: 'audit', path: '/audit', icon: Fingerprint },
  { key: 'settings', path: '/settings', icon: Settings2 },
]
