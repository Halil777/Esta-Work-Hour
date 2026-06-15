export type ThemeMode = 'dark' | 'light'
export type Language = 'en' | 'ru' | 'tr'

export type AuthUser = {
  name: string
  role: 'SuperAdmin' | 'CentralHR' | 'RegionalManager' | 'SystemAdmin' | 'Auditor'
  email?: string
}

export type StatSummary = {
  labelKey: 'activeObjects' | 'totalWorkforce' | 'checkedInToday' | 'attendanceConflicts'
  value: string
  detail: string
}

export type TrendPoint = {
  label: string
  attendance: number
  overtime: number
}

export type StatusSegment = {
  label: string
  value: number
  color: string
}

export type RegionSummary = {
  region: string
  objects: number
  presentRate: string
  overtimeHours: string
  conflicts: number
  status: 'Healthy' | 'Attention'
}

export type ObjectSummary = {
  id: string
  name: string
  location: string
  structure: string
  siteChief: string
  schedule: string
  workforceCapacity: number
  occupancy: string
  presentToday: number
  status: 'Healthy' | 'Attention'
}

export type WorkforceRow = {
  workerId: string
  name: string
  profession: string
  object: string
  brigade: string
  status: 'Active' | 'Transferred' | 'Suspended' | 'Blocked'
}

export type PermissionRow = {
  role: string
  scope: string
  exportLevel: string
  approvalFlow: string
  auditAccess: string
  userCount: number
}

export type QrMetric = {
  label: string
  value: string
  color?: string
}

export type ReportItem = {
  name: string
  format: string
  cadence: string
  owner: string
  lastRun: string
}

export type AuditRecord = {
  time: string
  event: string
  actor: string
  category: 'export' | 'qr' | 'transfer' | 'attendance' | 'system' | 'import'
}

export type SettingGroup = {
  title: string
  items: Array<{ key: string; value: string }>
}
