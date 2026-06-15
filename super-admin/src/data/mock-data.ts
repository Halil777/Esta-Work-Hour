import type {
  AuditRecord, ObjectSummary, PermissionRow, QrMetric,
  RegionSummary, ReportItem, SettingGroup, StatSummary,
  StatusSegment, TrendPoint, WorkforceRow,
} from '../types/admin'

export const statSummaries: StatSummary[] = [
  { labelKey: 'activeObjects', value: '24', detail: '+3 onboarding this quarter' },
  { labelKey: 'totalWorkforce', value: '18,426', detail: '92% in active rotations' },
  { labelKey: 'checkedInToday', value: '15,982', detail: '1,146 late or under review' },
  { labelKey: 'attendanceConflicts', value: '217', detail: '61 require central validation' },
]

export const attendanceTrend: TrendPoint[] = [
  { label: 'Mon', attendance: 14520, overtime: 360 },
  { label: 'Tue', attendance: 14980, overtime: 402 },
  { label: 'Wed', attendance: 15224, overtime: 388 },
  { label: 'Thu', attendance: 15674, overtime: 470 },
  { label: 'Fri', attendance: 15982, overtime: 442 },
  { label: 'Sat', attendance: 14184, overtime: 294 },
  { label: 'Sun', attendance: 13610, overtime: 228 },
]

export const workforceStatusSegments: StatusSegment[] = [
  { label: 'Active', value: 13892, color: '#22C55E' },
  { label: 'Transferred', value: 2107, color: '#3B82F6' },
  { label: 'Suspended', value: 1004, color: '#F59E0B' },
  { label: 'Blocked', value: 1423, color: '#EF4444' },
]

export const regionSummaries: RegionSummary[] = [
  { region: 'Moscow', objects: 8, presentRate: '91%', overtimeHours: '432h', conflicts: 38, status: 'Healthy' },
  { region: 'Kazan', objects: 5, presentRate: '94%', overtimeHours: '288h', conflicts: 21, status: 'Healthy' },
  { region: 'Saint Petersburg', objects: 4, presentRate: '89%', overtimeHours: '174h', conflicts: 29, status: 'Attention' },
  { region: 'Amur', objects: 7, presentRate: '87%', overtimeHours: '356h', conflicts: 44, status: 'Attention' },
]

export const objectSummaries: ObjectSummary[] = [
  {
    id: 'obj-01', name: 'Northern Terminal Redevelopment', location: 'Moscow',
    structure: '6 zones · 14 brigades', siteChief: 'Oleg Grishin',
    schedule: '8/2 shift template', workforceCapacity: 1840, occupancy: '89%',
    presentToday: 1638, status: 'Healthy',
  },
  {
    id: 'obj-02', name: 'Volga Industrial Block', location: 'Kazan',
    structure: '4 zones · 9 brigades', siteChief: 'Ruslan Kadyrov',
    schedule: 'Night shift enabled', workforceCapacity: 1220, occupancy: '94%',
    presentToday: 1147, status: 'Attention',
  },
  {
    id: 'obj-03', name: 'Baltic Logistics Yard', location: 'Saint Petersburg',
    structure: '3 zones · 8 brigades', siteChief: 'Denis Volkov',
    schedule: 'QR replacement policy active', workforceCapacity: 960, occupancy: '78%',
    presentToday: 749, status: 'Healthy',
  },
  {
    id: 'obj-04', name: 'Amur Concrete Cluster', location: 'Amur',
    structure: '5 zones · 11 brigades', siteChief: 'Maksim Potapov',
    schedule: 'Cold-weather attendance rules', workforceCapacity: 1460, occupancy: '83%',
    presentToday: 1212, status: 'Healthy',
  },
  {
    id: 'obj-05', name: 'Siberian Rail Station Complex', location: 'Novosibirsk',
    structure: '5 zones · 12 brigades', siteChief: 'Andrey Kuznetsov',
    schedule: 'Standard 8/2 template', workforceCapacity: 1280, occupancy: '76%',
    presentToday: 973, status: 'Attention',
  },
  {
    id: 'obj-06', name: 'Ural Mining Support Facility', location: 'Yekaterinburg',
    structure: '3 zones · 7 brigades', siteChief: 'Sergey Novikov',
    schedule: 'Extended shift — 12h', workforceCapacity: 890, occupancy: '91%',
    presentToday: 810, status: 'Healthy',
  },
]

export const workforceRows: WorkforceRow[] = [
  { workerId: 'W-100298', name: 'Nurmuhammet Geldiyev', profession: 'Welder', object: 'Northern Terminal', brigade: 'A-12', status: 'Active' },
  { workerId: 'W-100842', name: 'Aman Myradov', profession: 'Concrete team', object: 'Volga Industrial', brigade: 'C-08', status: 'Transferred' },
  { workerId: 'W-101104', name: 'Begench Atayev', profession: 'Electrician', object: 'Baltic Logistics', brigade: 'E-03', status: 'Suspended' },
  { workerId: 'W-101233', name: 'Meret Orazov', profession: 'Steel fixer', object: 'Northern Terminal', brigade: 'A-05', status: 'Active' },
  { workerId: 'W-101420', name: 'Aydogdy Jorayev', profession: 'Crane operator', object: 'Amur Concrete', brigade: 'D-11', status: 'Blocked' },
  { workerId: 'W-101588', name: 'Serdar Halmyradov', profession: 'Plasterer', object: 'Volga Industrial', brigade: 'B-04', status: 'Active' },
  { workerId: 'W-101720', name: 'Bagtygul Annamuradova', profession: 'Painter', object: 'Baltic Logistics', brigade: 'F-02', status: 'Active' },
  { workerId: 'W-101845', name: 'Gurbanguly Yazov', profession: 'Mason', object: 'Ural Mining', brigade: 'G-01', status: 'Active' },
  { workerId: 'W-101960', name: 'Orazmuhammet Deryaev', profession: 'Carpenter', object: 'Siberian Rail', brigade: 'H-03', status: 'Suspended' },
  { workerId: 'W-102034', name: 'Magtymguly Annayev', profession: 'Electrician', object: 'Northern Terminal', brigade: 'A-08', status: 'Active' },
]

export const permissionRows: PermissionRow[] = [
  { role: 'Super Admin', scope: 'Global', exportLevel: 'Full', approvalFlow: 'Override', auditAccess: 'Full', userCount: 3 },
  { role: 'Central HR', scope: 'All objects', exportLevel: 'Full', approvalFlow: 'View only', auditAccess: 'Read', userCount: 12 },
  { role: 'Regional Manager', scope: 'Assigned region', exportLevel: 'Regional', approvalFlow: 'Escalation', auditAccess: 'Read', userCount: 8 },
  { role: 'System Administrator', scope: 'Global', exportLevel: 'Restricted', approvalFlow: 'QR only', auditAccess: 'Full', userCount: 2 },
  { role: 'Auditor', scope: 'Global read-only', exportLevel: 'Audit packs', approvalFlow: 'None', auditAccess: 'Full', userCount: 4 },
  { role: 'Object Admin', scope: 'Own object', exportLevel: 'Local', approvalFlow: 'Local', auditAccess: 'Local', userCount: 24 },
]

export const qrMetrics: QrMetric[] = [
  { label: 'Issued Tokens', value: '18,004', color: 'var(--success)' },
  { label: 'Blocked Cards', value: '163', color: 'var(--danger)' },
  { label: 'Replacements (month)', value: '428', color: 'var(--warning)' },
  { label: 'Expiring Soon', value: '54', color: 'var(--info)' },
]

export const qrLifecycle = [
  { label: 'Generated', count: 18224 },
  { label: 'Printed', count: 17780 },
  { label: 'Issued', count: 18004 },
  { label: 'Active', count: 17196 },
  { label: 'Lost', count: 109 },
  { label: 'Replaced', count: 428 },
  { label: 'Blocked', count: 163 },
]

export const reportItems: ReportItem[] = [
  { name: 'Daily attendance by object', format: 'XLSX', cadence: 'Daily', owner: 'Central HR', lastRun: '2026-05-08 06:00' },
  { name: 'Monthly payroll-ready work hours', format: 'XLSX', cadence: 'Monthly', owner: 'Payroll', lastRun: '2026-05-01 07:30' },
  { name: 'Conflict and correction pack', format: 'PDF', cadence: 'Weekly', owner: 'Audit', lastRun: '2026-05-05 09:00' },
  { name: 'QR issuance and replacement', format: 'CSV', cadence: 'Weekly', owner: 'Security', lastRun: '2026-05-05 10:15' },
  { name: 'Regional attendance summary', format: 'XLSX', cadence: 'Daily', owner: 'Central HR', lastRun: '2026-05-08 06:30' },
  { name: 'Overtime approval summary', format: 'XLSX', cadence: 'Weekly', owner: 'HR', lastRun: '2026-05-05 08:45' },
]

export const auditRecords: AuditRecord[] = [
  { time: '22:14', event: 'Central HR exported April payroll summary for Moscow region', actor: 'Elena Smirnova', category: 'export' },
  { time: '21:07', event: 'System Administrator blocked four lost QR passes (IDs: W-101560, W-101561, W-101562, W-101563)', actor: 'Igor Petrov', category: 'qr' },
  { time: '18:52', event: 'Regional Manager transferred twelve workers to Volga Industrial Block', actor: 'Andrey Lazarev', category: 'transfer' },
  { time: '17:20', event: 'Auditor reviewed attendance correction batch AC-204 (38 records)', actor: 'Maria Kuznetsova', category: 'attendance' },
  { time: '16:02', event: 'Global import created 48 new worker records for Amur Concrete Cluster', actor: 'Igor Petrov', category: 'import' },
  { time: '14:35', event: 'Super Admin created new object: Ural Mining Support Facility, Yekaterinburg', actor: 'Admin', category: 'system' },
  { time: '12:18', event: 'Central HR exported QR issuance report for all objects (Q2 2026)', actor: 'Elena Smirnova', category: 'export' },
  { time: '10:44', event: 'Regional Manager approved overtime batch OT-512 — 19 requests across 4 brigades', actor: 'Andrey Lazarev', category: 'attendance' },
  { time: '09:30', event: 'System Administrator updated QR expiration policy — 90-day rotation enforced', actor: 'Igor Petrov', category: 'system' },
  { time: '08:15', event: 'Attendance conflict batch resolved: 7 conflicts at Northern Terminal A-12', actor: 'Oleg Grishin', category: 'attendance' },
]

export const dashboardAlerts = [
  '19 overtime approvals waiting for object-level confirmation.',
  '7 objects need QR batch printing before the next shift rotation.',
  '4 duplicate workers detected during import validation.',
  '2 regions have offline sync spikes above the SLA threshold.',
  'Month-end payroll export due in 3 days — 6 objects not yet finalized.',
]

export const settingsGroups: SettingGroup[] = [
  {
    title: 'Attendance rules',
    items: [
      { key: 'Default shift', value: '11 hours (8/2 template)' },
      { key: 'Late threshold', value: '15 minutes' },
      { key: 'Conflict SLA', value: '2 hours' },
      { key: 'Offline sync window', value: '24 hours max' },
    ],
  },
  {
    title: 'Master dictionaries',
    items: [
      { key: 'Professions', value: '48 entries' },
      { key: 'Absence reasons', value: '12 entries' },
      { key: 'Approval statuses', value: '7 entries' },
      { key: 'Regions', value: '6 entries' },
    ],
  },
  {
    title: 'Templates',
    items: [
      { key: 'Payroll Excel export', value: 'v3.2 active' },
      { key: 'Notification messages', value: '9 templates' },
      { key: 'QR print layout', value: 'A4, 4×6 grid' },
      { key: 'Audit report PDF', value: 'v2.1 active' },
    ],
  },
  {
    title: 'Security policy',
    items: [
      { key: 'MFA for central users', value: 'Enabled' },
      { key: 'Role-based export control', value: 'Enforced' },
      { key: 'Audit retention', value: '36 months' },
      { key: 'Session timeout', value: '8 hours' },
    ],
  },
]
