import type {
  Worker, Zone, AttendanceRecord, OvertimeRequest,
  ConflictRecord, AbsenceRecord, DailyStats, AccessLogRecord
} from '../types/tenant'

export const ZONES: Zone[] = [
  {
    id: 'z1', name: 'Zone A — Foundation',
    brigades: [
      { id: 'b1', zoneId: 'z1', name: 'Brigade A-1', foremanName: 'Aleksey Petrov', brigadirName: 'Marat Suleimanov', workerCount: 24, presentToday: 21 },
      { id: 'b2', zoneId: 'z1', name: 'Brigade A-2', foremanName: 'Aleksey Petrov', brigadirName: 'Ruslan Akhmedov', workerCount: 19, presentToday: 17 },
    ],
  },
  {
    id: 'z2', name: 'Zone B — Structure',
    brigades: [
      { id: 'b3', zoneId: 'z2', name: 'Brigade B-1', foremanName: 'Dmitry Kozlov', brigadirName: 'Abdullakh Yusupov', workerCount: 22, presentToday: 20 },
      { id: 'b4', zoneId: 'z2', name: 'Brigade B-2', foremanName: 'Dmitry Kozlov', brigadirName: 'Ilyas Karimov', workerCount: 18, presentToday: 15 },
    ],
  },
  {
    id: 'z3', name: 'Zone C — Finishing',
    brigades: [
      { id: 'b5', zoneId: 'z3', name: 'Brigade C-1', foremanName: 'Sergey Volkov', brigadirName: 'Timur Nazarov', workerCount: 20, presentToday: 18 },
      { id: 'b6', zoneId: 'z3', name: 'Brigade C-2', foremanName: 'Sergey Volkov', brigadirName: '', workerCount: 15, presentToday: 12 },
    ],
  },
]

export const WORKERS: Worker[] = [
  { id: 'w001', workerId: 'EST-001', name: 'Иванов Алексей', profession: 'Каменщик', brigadeId: 'b1', brigadeName: 'Brigade A-1', zoneId: 'z1', zoneName: 'Zone A', status: 'Active', phone: '+7 900 111 22 33', hireDate: '2024-03-01', qrStatus: 'Active' },
  { id: 'w002', workerId: 'EST-002', name: 'Петров Дмитрий', profession: 'Сварщик', brigadeId: 'b1', brigadeName: 'Brigade A-1', zoneId: 'z1', zoneName: 'Zone A', status: 'Active', phone: '+7 900 222 33 44', hireDate: '2024-03-01', qrStatus: 'Active' },
  { id: 'w003', workerId: 'EST-003', name: 'Каримов Мухаммад', profession: 'Электрик', brigadeId: 'b1', brigadeName: 'Brigade A-1', zoneId: 'z1', zoneName: 'Zone A', status: 'Active', hireDate: '2024-04-15', qrStatus: 'Active' },
  { id: 'w004', workerId: 'EST-004', name: 'Козлов Анатолий', profession: 'Плотник', brigadeId: 'b2', brigadeName: 'Brigade A-2', zoneId: 'z1', zoneName: 'Zone A', status: 'Active', hireDate: '2024-03-20', qrStatus: 'Active' },
  { id: 'w005', workerId: 'EST-005', name: 'Юсупов Рустам', profession: 'Разнорабочий', brigadeId: 'b2', brigadeName: 'Brigade A-2', zoneId: 'z1', zoneName: 'Zone A', status: 'Active', hireDate: '2024-05-01', qrStatus: 'Active' },
  { id: 'w006', workerId: 'EST-006', name: 'Сидоров Михаил', profession: 'Арматурщик', brigadeId: 'b3', brigadeName: 'Brigade B-1', zoneId: 'z2', zoneName: 'Zone B', status: 'Active', hireDate: '2024-02-14', qrStatus: 'Active' },
  { id: 'w007', workerId: 'EST-007', name: 'Ахмедов Нодир', profession: 'Бетонщик', brigadeId: 'b3', brigadeName: 'Brigade B-1', zoneId: 'z2', zoneName: 'Zone B', status: 'Active', hireDate: '2024-03-10', qrStatus: 'Active' },
  { id: 'w008', workerId: 'EST-008', name: 'Смирнов Павел', profession: 'Крановщик', brigadeId: 'b3', brigadeName: 'Brigade B-1', zoneId: 'z2', zoneName: 'Zone B', status: 'Suspended', hireDate: '2024-01-20', qrStatus: 'Blocked' },
  { id: 'w009', workerId: 'EST-009', name: 'Назаров Тимур', profession: 'Маляр', brigadeId: 'b4', brigadeName: 'Brigade B-2', zoneId: 'z2', zoneName: 'Zone B', status: 'Active', hireDate: '2024-04-01', qrStatus: 'Active' },
  { id: 'w010', workerId: 'EST-010', name: 'Волков Игорь', profession: 'Штукатур', brigadeId: 'b4', brigadeName: 'Brigade B-2', zoneId: 'z2', zoneName: 'Zone B', status: 'Active', hireDate: '2024-04-01', qrStatus: 'Active' },
  { id: 'w011', workerId: 'EST-011', name: 'Орлов Сергей', profession: 'Сантехник', brigadeId: 'b5', brigadeName: 'Brigade C-1', zoneId: 'z3', zoneName: 'Zone C', status: 'Active', hireDate: '2024-02-28', qrStatus: 'Active' },
  { id: 'w012', workerId: 'EST-012', name: 'Федоров Андрей', profession: 'Плиточник', brigadeId: 'b5', brigadeName: 'Brigade C-1', zoneId: 'z3', zoneName: 'Zone C', status: 'Active', hireDate: '2024-05-15', qrStatus: 'Active' },
  { id: 'w013', workerId: 'EST-013', name: 'Захаров Виктор', profession: 'Разнорабочий', brigadeId: 'b5', brigadeName: 'Brigade C-1', zoneId: 'z3', zoneName: 'Zone C', status: 'Inactive', hireDate: '2024-03-01', qrStatus: 'Replaced' },
  { id: 'w014', workerId: 'EST-014', name: 'Соколов Алексей', profession: 'Электрик', brigadeId: 'b6', brigadeName: 'Brigade C-2', zoneId: 'z3', zoneName: 'Zone C', status: 'Active', hireDate: '2024-06-01', qrStatus: 'Active' },
  { id: 'w015', workerId: 'EST-015', name: 'Михайлов Роман', profession: 'Каменщик', brigadeId: 'b6', brigadeName: 'Brigade C-2', zoneId: 'z3', zoneName: 'Zone C', status: 'Active', hireDate: '2024-06-01', qrStatus: 'Active' },
  { id: 'w016', workerId: 'EST-016', name: 'Якубов Бахром', profession: 'Сварщик', brigadeId: 'b2', brigadeName: 'Brigade A-2', zoneId: 'z1', zoneName: 'Zone A', status: 'Active', hireDate: '2024-07-01', qrStatus: 'Active' },
  { id: 'w017', workerId: 'EST-017', name: 'Рашидов Улугбек', profession: 'Арматурщик', brigadeId: 'b3', brigadeName: 'Brigade B-1', zoneId: 'z2', zoneName: 'Zone B', status: 'Active', hireDate: '2024-07-10', qrStatus: 'Active' },
  { id: 'w018', workerId: 'EST-018', name: 'Ким Александр', profession: 'Бетонщик', brigadeId: 'b4', brigadeName: 'Brigade B-2', zoneId: 'z2', zoneName: 'Zone B', status: 'Transferred', hireDate: '2024-02-01', qrStatus: 'Active' },
]

const today = new Date().toISOString().split('T')[0]

export const ATTENDANCE: AttendanceRecord[] = [
  { id: 'a001', workerId: 'w001', workerName: 'Иванов Алексей', brigadeId: 'b1', brigadeName: 'Brigade A-1', date: today, status: 'Present', scanTime: '07:52', scanMethod: 'QR' },
  { id: 'a002', workerId: 'w002', workerName: 'Петров Дмитрий', brigadeId: 'b1', brigadeName: 'Brigade A-1', date: today, status: 'Late', scanTime: '08:34', scanMethod: 'QR' },
  { id: 'a003', workerId: 'w003', workerName: 'Каримов Мухаммад', brigadeId: 'b1', brigadeName: 'Brigade A-1', date: today, status: 'Present', scanTime: '07:45', scanMethod: 'QR' },
  { id: 'a004', workerId: 'w004', workerName: 'Козлов Анатолий', brigadeId: 'b2', brigadeName: 'Brigade A-2', date: today, status: 'Absent', note: 'No information' },
  { id: 'a005', workerId: 'w005', workerName: 'Юсупов Рустам', brigadeId: 'b2', brigadeName: 'Brigade A-2', date: today, status: 'Present', scanTime: '07:50', scanMethod: 'QR' },
  { id: 'a006', workerId: 'w006', workerName: 'Сидоров Михаил', brigadeId: 'b3', brigadeName: 'Brigade B-1', date: today, status: 'Medical', note: 'Medical leave approved' },
  { id: 'a007', workerId: 'w007', workerName: 'Ахмедов Нодир', brigadeId: 'b3', brigadeName: 'Brigade B-1', date: today, status: 'Present', scanTime: '07:48', scanMethod: 'QR' },
  { id: 'a008', workerId: 'w009', workerName: 'Назаров Тимур', brigadeId: 'b4', brigadeName: 'Brigade B-2', date: today, status: 'Present', scanTime: '07:55', scanMethod: 'Manual' },
  { id: 'a009', workerId: 'w010', workerName: 'Волков Игорь', brigadeId: 'b4', brigadeName: 'Brigade B-2', date: today, status: 'Late', scanTime: '09:12', scanMethod: 'QR' },
  { id: 'a010', workerId: 'w011', workerName: 'Орлов Сергей', brigadeId: 'b5', brigadeName: 'Brigade C-1', date: today, status: 'Present', scanTime: '07:44', scanMethod: 'QR' },
  { id: 'a011', workerId: 'w012', workerName: 'Федоров Андрей', brigadeId: 'b5', brigadeName: 'Brigade C-1', date: today, status: 'Vacation', note: 'Annual leave' },
  { id: 'a012', workerId: 'w014', workerName: 'Соколов Алексей', brigadeId: 'b6', brigadeName: 'Brigade C-2', date: today, status: 'Present', scanTime: '07:51', scanMethod: 'QR' },
  { id: 'a013', workerId: 'w015', workerName: 'Михайлов Роман', brigadeId: 'b6', brigadeName: 'Brigade C-2', date: today, status: 'Absent', note: 'Unauthorized' },
  { id: 'a014', workerId: 'w016', workerName: 'Якубов Бахром', brigadeId: 'b2', brigadeName: 'Brigade A-2', date: today, status: 'Present', scanTime: '07:49', scanMethod: 'QR' },
  { id: 'a015', workerId: 'w017', workerName: 'Рашидов Улугбек', brigadeId: 'b3', brigadeName: 'Brigade B-1', date: today, status: 'OfflinePending', scanTime: '07:53', scanMethod: 'QR' },
]

export const OVERTIME: OvertimeRequest[] = [
  { id: 'ot001', requestDate: '2026-05-07', workDate: '2026-05-08', foremanName: 'Aleksey Petrov', brigadeId: 'b1', brigadeName: 'Brigade A-1', workerCount: 12, hours: 3, reason: 'Foundation deadline – concrete pour must be completed tonight', status: 'Pending', createdAt: '2026-05-07T16:30:00' },
  { id: 'ot002', requestDate: '2026-05-06', workDate: '2026-05-07', foremanName: 'Dmitry Kozlov', brigadeId: 'b3', brigadeName: 'Brigade B-1', workerCount: 8, hours: 2, reason: 'Steel frame installation – schedule recovery', status: 'Approved', siteChiefNote: 'Approved. Follow safety protocol.', createdAt: '2026-05-06T14:00:00' },
  { id: 'ot003', requestDate: '2026-05-05', workDate: '2026-05-06', foremanName: 'Aleksey Petrov', brigadeId: 'b2', brigadeName: 'Brigade A-2', workerCount: 6, hours: 4, reason: 'Waterproofing works – weather window closing', status: 'Rejected', siteChiefNote: 'Not approved – safety concern with night work.', createdAt: '2026-05-05T17:00:00' },
  { id: 'ot004', requestDate: '2026-05-07', workDate: '2026-05-09', foremanName: 'Sergey Volkov', brigadeId: 'b5', brigadeName: 'Brigade C-1', workerCount: 10, hours: 2, reason: 'Interior finishing – client inspection on Monday', status: 'Pending', createdAt: '2026-05-07T18:00:00' },
  { id: 'ot005', requestDate: '2026-05-04', workDate: '2026-05-05', foremanName: 'Dmitry Kozlov', brigadeId: 'b4', brigadeName: 'Brigade B-2', workerCount: 5, hours: 3, reason: 'Column formwork – crane schedule constraint', status: 'Approved', createdAt: '2026-05-04T15:30:00' },
  { id: 'ot006', requestDate: '2026-05-03', workDate: '2026-05-04', foremanName: 'Sergey Volkov', brigadeId: 'b6', brigadeName: 'Brigade C-2', workerCount: 7, hours: 2, reason: 'Electrical wiring – contractor coordination', status: 'Finalized', createdAt: '2026-05-03T16:00:00' },
]

export const CONFLICTS: ConflictRecord[] = [
  { id: 'c001', type: 'DuplicateScan', workerName: 'Петров Дмитрий', date: today, time: '08:34', details: 'Worker scanned at Brigade A-1 and Brigade B-1 within 5 minutes', severity: 'High', resolved: false },
  { id: 'c002', type: 'WrongBrigade', workerName: 'Волков Игорь', date: today, time: '09:12', details: 'Worker scanned in Brigade A-1 but registered in Brigade B-2', severity: 'Medium', resolved: false },
  { id: 'c003', type: 'BlockedQR', workerName: 'Смирнов Павел', date: today, time: '07:55', details: 'Attempt to scan QR code that has been blocked by admin', severity: 'High', resolved: false },
  { id: 'c004', type: 'SuspiciousTimestamp', workerName: 'Ахмедов Нодир', date: '2026-05-07', time: '23:47', details: 'Scan recorded at 23:47 — outside normal working hours (07:00-20:00)', severity: 'Medium', resolved: true },
  { id: 'c005', type: 'MultipleScan', workerName: 'Иванов Алексей', date: '2026-05-07', time: '07:52', details: 'Same QR scanned 3 times in 2-minute window', severity: 'Low', resolved: true },
]

export const ABSENCES: AbsenceRecord[] = [
  { id: 'ab001', workerId: 'w004', workerName: 'Козлов Анатолий', brigadeId: 'b2', brigadeName: 'Brigade A-2', date: today, reason: 'Sick Leave', note: 'Fever', hasDocument: true },
  { id: 'ab002', workerId: 'w011', workerName: 'Орлов Сергей (Medical)', brigadeId: 'b5', brigadeName: 'Brigade C-1', date: today, reason: 'Medical Point', note: 'Sent to medical station at 10:00', hasDocument: false },
  { id: 'ab003', workerId: 'w012', workerName: 'Федоров Андрей', brigadeId: 'b5', brigadeName: 'Brigade C-1', date: today, reason: 'Vacation', note: 'Annual leave approved by HR', hasDocument: true },
  { id: 'ab004', workerId: 'w015', workerName: 'Михайлов Роман', brigadeId: 'b6', brigadeName: 'Brigade C-2', date: today, reason: 'Unauthorized', note: '', hasDocument: false },
  { id: 'ab005', workerId: 'w018', workerName: 'Ким Александр', brigadeId: 'b4', brigadeName: 'Brigade B-2', date: '2026-05-07', reason: 'Business Trip', note: 'Regional office – document handover', hasDocument: true },
  { id: 'ab006', workerId: 'w008', workerName: 'Смирнов Павел', brigadeId: 'b3', brigadeName: 'Brigade B-1', date: '2026-05-07', reason: 'Suspended', note: 'Suspended pending safety investigation', hasDocument: false },
]

export const DAILY_STATS: DailyStats[] = [
  { date: '05/02', present: 108, absent: 22, late: 8, medical: 5 },
  { date: '05/03', present: 112, absent: 18, late: 6, medical: 7 },
  { date: '05/04', present: 105, absent: 25, late: 9, medical: 4 },
  { date: '05/05', present: 115, absent: 16, late: 5, medical: 7 },
  { date: '05/06', present: 110, absent: 20, late: 7, medical: 6 },
  { date: '05/07', present: 108, absent: 22, late: 9, medical: 5 },
  { date: '05/08', present: 103, absent: 24, late: 8, medical: 6 },
]

export const ACCESS_LOG: AccessLogRecord[] = [
  { id: 'al001', tabNo: '0001003387', surname: 'GOK', firstName: 'CAGRI', dolznost: 'Менеджер', date: '2026-05-09 07:35:23', zone: 'OFIS', cardNo: '1024688367' },
  { id: 'al002', tabNo: '0001004726', surname: 'ASLAN', firstName: 'VEDAT', dolznost: 'Инженер', date: '2026-05-09 08:42:37', zone: 'OFIS', cardNo: '844425009032989' },
  { id: 'al003', tabNo: '0001004726', surname: 'ASLAN', firstName: 'VEDAT', dolznost: 'Инженер', date: '2026-05-09 18:16:25', zone: 'Неконтролируемая территория', cardNo: '844425009032989' },
  { id: 'al004', tabNo: '0001005060', surname: 'SERDAR', firstName: 'TANER', dolznost: 'Техник', date: '2026-05-09 07:04:33', zone: 'OFIS', cardNo: '687812228' },
  { id: 'al005', tabNo: '0001005060', surname: 'SERDAR', firstName: 'TANER', dolznost: 'Техник', date: '2026-05-09 18:43:51', zone: 'Неконтролируемая территория', cardNo: '687812228' },
  { id: 'al006', tabNo: '0001005681', surname: 'TECIRLI', firstName: 'ILKER', dolznost: 'Специалист', date: '2026-05-09 07:06:29', zone: 'OFIS', cardNo: '2196882650' },
  { id: 'al007', tabNo: '0001005681', surname: 'TECIRLI', firstName: 'ILKER', dolznost: 'Специалист', date: '2026-05-09 18:21:33', zone: 'Неконтролируемая территория', cardNo: '2196882650' },
  { id: 'al008', tabNo: '0001005682', surname: 'SONMEZ', firstName: 'TOLGA', dolznost: 'Прораб', date: '2026-05-09 06:05:32', zone: 'Неконтролируемая территория', cardNo: '844424989981725' },
  { id: 'al009', tabNo: '0001005682', surname: 'SONMEZ', firstName: 'TOLGA', dolznost: 'Прораб', date: '2026-05-09 18:13:20', zone: 'OFIS', cardNo: '844424989981725' },
  { id: 'al010', tabNo: '0001005688', surname: 'KIRAC', firstName: 'MUSTAFA', dolznost: 'Бригадир', date: '2026-05-09 07:13:38', zone: 'OFIS', cardNo: '844424972791069' },
  { id: 'al011', tabNo: '0001005688', surname: 'KIRAC', firstName: 'MUSTAFA', dolznost: 'Бригадир', date: '2026-05-09 18:55:47', zone: 'Неконтролируемая территория', cardNo: '844424972791069' },
  { id: 'al012', tabNo: '0001005691', surname: 'YILMAZ', firstName: 'SERKAN', dolznost: 'Инженер', date: '2026-05-09 10:26:23', zone: 'OFIS', cardNo: '69952399' },
  { id: 'al013', tabNo: '0001005691', surname: 'YILMAZ', firstName: 'SERKAN', dolznost: 'Инженер', date: '2026-05-09 18:21:18', zone: 'Неконтролируемая территория', cardNo: '69952399' },
  { id: 'al014', tabNo: '0001005700', surname: 'TASKIN', firstName: 'MURAT', dolznost: 'Техник', date: '2026-05-09 08:00:14', zone: 'OFIS', cardNo: '844424957331229' },
  { id: 'al015', tabNo: '0001005700', surname: 'TASKIN', firstName: 'MURAT', dolznost: 'Техник', date: '2026-05-09 18:23:40', zone: 'Неконтролируемая территория', cardNo: '844424957331229' },
  { id: 'al016', tabNo: '0001005711', surname: 'KARANFIL', firstName: 'MURAT', dolznost: 'Специалист', date: '2026-05-09 07:45:10', zone: 'OFIS', cardNo: '687559876' },
  { id: 'al017', tabNo: '0001005711', surname: 'KARANFIL', firstName: 'MURAT', dolznost: 'Специалист', date: '2026-05-09 18:21:00', zone: 'Неконтролируемая территория', cardNo: '687559876' },
  { id: 'al018', tabNo: '0001005741', surname: 'YUK', firstName: 'SADETTIN', dolznost: 'Разнорабочий', date: '2026-05-09 07:30:22', zone: 'OFIS', cardNo: '2194918858' },
  { id: 'al019', tabNo: '0001005741', surname: 'YUK', firstName: 'SADETTIN', dolznost: 'Разнорабочий', date: '2026-05-09 18:50:49', zone: 'Неконтролируемая территория', cardNo: '2194918858' },
  { id: 'al020', tabNo: '0001005750', surname: 'CIFTCI', firstName: 'GOKHAN', dolznost: 'Инженер', date: '2026-05-09 07:55:08', zone: 'OFIS', cardNo: '844424973299741' },
  { id: 'al021', tabNo: '0001005750', surname: 'CIFTCI', firstName: 'GOKHAN', dolznost: 'Инженер', date: '2026-05-09 18:16:40', zone: 'Неконтролируемая территория', cardNo: '844424973299741' },
  { id: 'al022', tabNo: '0001005767', surname: 'SOYLA', firstName: 'SINAN', dolznost: 'Техник', date: '2026-05-09 07:10:55', zone: 'OFIS', cardNo: '35585615' },
  { id: 'al023', tabNo: '0001005767', surname: 'SOYLA', firstName: 'SINAN', dolznost: 'Техник', date: '2026-05-09 18:21:35', zone: 'Неконтролируемая территория', cardNo: '35585615' },
  { id: 'al024', tabNo: '0001005768', surname: 'ATAN', firstName: 'TANER', dolznost: 'Менеджер', date: '2026-05-09 07:58:44', zone: 'OFIS', cardNo: '844424960969245' },
  { id: 'al025', tabNo: '0001005768', surname: 'ATAN', firstName: 'TANER', dolznost: 'Менеджер', date: '2026-05-09 18:13:27', zone: 'OFIS', cardNo: '844424960969245' },
  { id: 'al026', tabNo: '0001005978', surname: 'ARSLAN', firstName: 'HASRET', dolznost: 'Специалист', date: '2026-05-09 07:42:19', zone: 'OFIS', cardNo: '2623222905' },
  { id: 'al027', tabNo: '0001005978', surname: 'ARSLAN', firstName: 'HASRET', dolznost: 'Специалист', date: '2026-05-09 18:16:16', zone: 'Неконтролируемая территория', cardNo: '2623222905' },
  { id: 'al028', tabNo: '0001006132', surname: 'KARAKOC', firstName: 'FIKRET', dolznost: 'Инженер', date: '2026-05-09 07:22:08', zone: 'OFIS', cardNo: '844424979707421' },
  { id: 'al029', tabNo: '0001006132', surname: 'KARAKOC', firstName: 'FIKRET', dolznost: 'Инженер', date: '2026-05-09 18:29:35', zone: 'Неконтролируемая территория', cardNo: '844424979707421' },
  { id: 'al030', tabNo: '0001006144', surname: 'ARI', firstName: 'MUSTAFA', dolznost: 'Бригадир', date: '2026-05-09 07:50:31', zone: 'OFIS', cardNo: '2185431530' },
  { id: 'al031', tabNo: '0001006144', surname: 'ARI', firstName: 'MUSTAFA', dolznost: 'Бригадир', date: '2026-05-09 18:49:28', zone: 'Неконтролируемая территория', cardNo: '2185431530' },
  { id: 'al032', tabNo: '0001006434', surname: 'BINICI', firstName: 'HAYDAR', dolznost: 'Менеджер', date: '2026-05-09 07:49:51', zone: 'OFIS', cardNo: '153950607' },
  { id: 'al033', tabNo: '0001006488', surname: 'SALMAN', firstName: 'POLAT', dolznost: 'Техник', date: '2026-05-09 08:05:17', zone: 'OFIS', cardNo: '844424953195037' },
  { id: 'al034', tabNo: '0001006488', surname: 'SALMAN', firstName: 'POLAT', dolznost: 'Техник', date: '2026-05-09 18:30:36', zone: 'Неконтролируемая территория', cardNo: '844424953195037' },
  { id: 'al035', tabNo: '0001006622', surname: 'DJANBULAT', firstName: 'ERDJAN', dolznost: 'Специалист', date: '2026-05-09 07:38:44', zone: 'OFIS', cardNo: '844425002870045' },
  { id: 'al036', tabNo: '0001006622', surname: 'DJANBULAT', firstName: 'ERDJAN', dolznost: 'Специалист', date: '2026-05-09 18:51:03', zone: 'Неконтролируемая территория', cardNo: '844425002870045' },
  { id: 'al037', tabNo: '0001006663', surname: 'CINDIZ', firstName: 'UTKU', dolznost: 'Инженер', date: '2026-05-09 08:38:57', zone: 'OFIS', cardNo: '4042273775' },
  { id: 'al038', tabNo: '0001006671', surname: 'BUZDAG', firstName: 'MEHMET', dolznost: 'Разнорабочий', date: '2026-05-09 07:14:02', zone: 'OFIS', cardNo: '4038932079' },
  { id: 'al039', tabNo: '0001006671', surname: 'BUZDAG', firstName: 'MEHMET', dolznost: 'Разнорабочий', date: '2026-05-09 18:51:25', zone: 'Неконтролируемая территория', cardNo: '4038932079' },
  { id: 'al040', tabNo: '0007014091', surname: 'KHAYDAROV', firstName: 'NURALI', dolznost: 'Специалист', date: '2026-05-09 07:25:19', zone: 'OFIS', cardNo: '844424961943069' },
  { id: 'al041', tabNo: '0007014091', surname: 'KHAYDAROV', firstName: 'NURALI', dolznost: 'Специалист', date: '2026-05-09 18:10:06', zone: 'Неконтролируемая территория', cardNo: '844424961943069' },
  { id: 'al042', tabNo: '0007014493', surname: 'BERDIBAEV', firstName: 'OTABEK', dolznost: 'Техник', date: '2026-05-09 08:11:44', zone: 'OFIS', cardNo: '844424968685085' },
  { id: 'al043', tabNo: '0007014493', surname: 'BERDIBAEV', firstName: 'OTABEK', dolznost: 'Техник', date: '2026-05-09 18:51:35', zone: 'Неконтролируемая территория', cardNo: '844424968685085' },
  { id: 'al044', tabNo: '0007015021', surname: 'NAFASOV', firstName: 'ISLOMBEK', dolznost: 'Разнорабочий', date: '2026-05-09 07:33:55', zone: 'OFIS', cardNo: '2640368921' },
  { id: 'al045', tabNo: '0007015021', surname: 'NAFASOV', firstName: 'ISLOMBEK', dolznost: 'Разнорабочий', date: '2026-05-09 18:51:05', zone: 'Неконтролируемая территория', cardNo: '2640368921' },
  { id: 'al046', tabNo: '0007015203', surname: 'SHUKURLAEV', firstName: 'ILKHOM', dolznost: 'Инженер', date: '2026-05-09 07:47:33', zone: 'OFIS', cardNo: '844424999042077' },
  { id: 'al047', tabNo: '0007015203', surname: 'SHUKURLAEV', firstName: 'ILKHOM', dolznost: 'Инженер', date: '2026-05-09 20:18:25', zone: 'Неконтролируемая территория', cardNo: '844424999042077' },
]

export const ACTIVITY_FEED = [
  { id: '1', time: '09:14', text: 'Conflict resolved: Duplicate scan — Петров Дмитрий', type: 'conflict' },
  { id: '2', time: '08:55', text: 'Overtime approved: Brigade B-1 — 2h on May 7', type: 'approved' },
  { id: '3', time: '08:30', text: 'Attendance sync complete: 15 records from Brigade A-1', type: 'sync' },
  { id: '4', time: '08:12', text: 'QR blocked: EST-008 (Смирнов Павел)', type: 'qr' },
  { id: '5', time: '07:50', text: 'Manual correction: Absence marked for Козлов Анатолий', type: 'correction' },
]
