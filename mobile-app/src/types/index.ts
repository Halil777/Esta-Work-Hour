export type Role = 'Foreman' | 'SiteChief'
export type Language = 'ru' | 'en' | 'tk'
export type Theme = 'dark' | 'light'
export type SyncStatus = 'local' | 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict'

export type AttendanceStatus =
  | 'Present'
  | 'Absent'
  | 'Late'
  | 'Medical'
  | 'SickLeave'
  | 'Vacation'
  | 'Unauthorized'
  | 'Transferred'
  | 'NoInfo'
  | 'NotMarked'

export type OvertimeStatus =
  | 'Draft'
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Returned'
  | 'Canceled'

export type AttendanceSubmitStatus = 'Draft' | 'Submitted' | 'Reviewed' | 'Returned'

export interface AuthUser {
  id: string
  name: string
  role: Role
  objectId: string
  objectName: string
  brigadeId?: string
  brigadeName?: string
  email: string
}

export interface Worker {
  id: string
  name: string
  workerId: string
  profession: string
  brigadeId: string
  brigadeName: string
  qrToken: string
  status: 'Active' | 'Blocked' | 'Transferred'
  photo?: string
}

export interface Brigade {
  id: string
  name: string
  foremanId: string
  brigadirId: string
  brigadirName: string
  workerCount: number
  zone: string
}

export interface AttendanceRecord {
  id: string
  workerId: string
  workerName: string
  brigadeId: string
  date: string
  status: AttendanceStatus
  method: 'QR' | 'Manual'
  reason?: string
  syncStatus: SyncStatus
  timestamp: number
  scannedBy: string
}

export interface OvertimeRequest {
  id: string
  brigadeId: string
  brigadeName: string
  date: string
  workers: { id: string; name: string; hours: number }[]
  reason: string
  comment: string
  status: OvertimeStatus
  createdBy: string
  createdAt: string
  reviewedBy?: string
  reviewComment?: string
}

export interface SyncQueueItem {
  id: string
  type: 'attendance' | 'overtime' | 'correction'
  data: unknown
  timestamp: number
  status: SyncStatus
}

export interface Notification {
  id: string
  title: string
  body: string
  type: 'attendance' | 'overtime' | 'sync' | 'conflict' | 'info'
  read: boolean
  timestamp: number
}
