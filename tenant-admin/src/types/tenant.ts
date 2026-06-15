export type ThemeMode = 'dark' | 'light'
export type Language = 'en' | 'ru' | 'tr'

export type WorkerStatus = 'Active' | 'Inactive' | 'Suspended' | 'Transferred' | 'Terminated'
export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Medical' | 'Vacation' | 'BusinessTrip' | 'Unauthorized' | 'Transferred' | 'OfflinePending' | 'Conflict'
export type OvertimeStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected' | 'Canceled' | 'Returned' | 'Finalized'
export type ConflictType = 'DuplicateScan' | 'WrongBrigade' | 'BlockedQR' | 'MultipleScan' | 'SuspiciousTimestamp'
export type ScanMethod = 'QR' | 'Manual'
export type QrStatus = 'Active' | 'Lost' | 'Blocked' | 'Replaced'

export type Worker = {
  id: string
  workerId: string
  name: string
  profession: string
  brigadeId: string
  brigadeName: string
  zoneId: string
  zoneName: string
  status: WorkerStatus
  phone?: string
  hireDate: string
  qrStatus: QrStatus
}

export type Zone = {
  id: string
  name: string
  brigades: Brigade[]
}

export type Brigade = {
  id: string
  zoneId: string
  name: string
  foremanName?: string
  brigadirName?: string
  workerCount: number
  presentToday: number
}

export type AttendanceRecord = {
  id: string
  workerId: string
  workerName: string
  brigadeId: string
  brigadeName: string
  date: string
  status: AttendanceStatus
  scanTime?: string
  scanMethod?: ScanMethod
  note?: string
}

export type OvertimeRequest = {
  id: string
  requestDate: string
  workDate: string
  foremanName: string
  brigadeId: string
  brigadeName: string
  workerCount: number
  hours: number
  reason: string
  status: OvertimeStatus
  siteChiefNote?: string
  createdAt: string
}

export type ConflictRecord = {
  id: string
  type: ConflictType
  workerName?: string
  date: string
  time: string
  details: string
  severity: 'Low' | 'Medium' | 'High'
  resolved: boolean
}

export type AbsenceRecord = {
  id: string
  workerId: string
  workerName: string
  brigadeId: string
  brigadeName: string
  date: string
  reason: string
  note?: string
  hasDocument: boolean
}

export type DailyStats = {
  date: string
  present: number
  absent: number
  late: number
  medical: number
}

export type AccessLogRecord = {
  id: string
  tabNo: string
  surname: string
  firstName: string
  dolznost: string
  date: string
  zone: string
  cardNo: string
}

export type AuthUser = {
  id: string
  name: string
  role: 'ObjectAdmin' | 'SiteChief' | 'HR' | 'Foreman' | 'Timekeeper'
  objectName: string
  objectId: string
}
