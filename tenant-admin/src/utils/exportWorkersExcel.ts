import * as XLSX from 'xlsx'
import type { WorkerApi } from '../api/workers'
import type { Language } from '../types/tenant'

const APP_TZ = 'Europe/Moscow'

// Column headers + duration units — tr / en / ru only, never a fourth
// language. Mirrors the backend's own getExportL() so the client-side and
// server-side worker exports read identically.
const EXPORT_L: Record<Language, {
  colTabNo: string; colName: string; colProfession: string; colCheckIn: string;
  colCheckOut: string; colTotalHours: string; colActualHours: string; colWorkDone: string;
  colTeam: string; colOvertimeSystem: string; hourUnit: string; minUnit: string;
  mesaiHourly: string; mesaiMonthly: string;
}> = {
  en: {
    colTabNo: 'Tab No', colName: 'Worker Name', colProfession: 'Profession',
    colCheckIn: 'Check-in', colCheckOut: 'Check-out', colTotalHours: 'Total Hours',
    colActualHours: 'Actual Hours', colWorkDone: 'Work Done', colTeam: 'Team',
    colOvertimeSystem: 'Overtime System', hourUnit: 'h', minUnit: 'min',
    mesaiHourly: 'Hourly', mesaiMonthly: 'Monthly',
  },
  ru: {
    colTabNo: 'Таб. №', colName: 'Имя работника', colProfession: 'Должность',
    colCheckIn: 'Приход', colCheckOut: 'Уход', colTotalHours: 'Всего часов',
    colActualHours: 'Факт. часов', colWorkDone: 'Выполненная работа', colTeam: 'Бригада',
    colOvertimeSystem: 'Система переработки', hourUnit: 'ч', minUnit: 'мин',
    mesaiHourly: 'Почасово', mesaiMonthly: 'Ежемесячно',
  },
  tr: {
    colTabNo: 'Sicil No', colName: 'İşçi Adı', colProfession: 'Meslek',
    colCheckIn: 'Giriş Saati', colCheckOut: 'Çıkış Saati', colTotalHours: 'Toplam Saat',
    colActualHours: 'Fiili Saat', colWorkDone: 'Yapılan İş', colTeam: 'Ekip',
    colOvertimeSystem: 'Mesai Sistemi', hourUnit: 'sa', minUnit: 'dk',
    mesaiHourly: 'Saatlik', mesaiMonthly: 'Aylık',
  },
}

function fmtTime(ts: number | null | undefined): string {
  if (!ts) return ''
  return new Date(ts).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: APP_TZ,
  })
}

function fmtDuration(ms: number | null | undefined, hourUnit: string, minUnit: string): string {
  if (!ms || ms <= 0) return ''
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} ${minUnit}`
  if (m === 0) return `${h} ${hourUnit}`
  return `${h} ${hourUnit} ${m} ${minUnit}`
}

/**
 * Builds the same "workers-YYYY-MM-DD.xlsx" roster the backend's
 * GET /workers/export used to generate — but entirely in the browser, from
 * the worker rows already loaded on screen (same columns, same formatting).
 *
 * No extra network round-trip and no extra database query: the Workers page
 * already fetched exactly these rows for the table, so exporting them again
 * from the server was pure duplicate work. This is why the Export button
 * felt heavy even after the backend query itself got fast — it was doing
 * the whole fetch a second time, on every click.
 */
export function exportWorkersToExcel(workers: WorkerApi[], lang: Language = 'tr') {
  const L = EXPORT_L[lang] ?? EXPORT_L.tr

  const rows = workers.map(w => ({
    [L.colTabNo]: w.workerId,
    [L.colName]: w.name,
    [L.colProfession]: w.profession || '',
    [L.colCheckIn]: fmtTime(w.lastCheckIn),
    [L.colCheckOut]: fmtTime(w.lastCheckOut),
    [L.colTotalHours]: w.mesaiSistemi === 'Aylık' ? `8 ${L.hourUnit}` : fmtDuration(w.todayHoursMs, L.hourUnit, L.minUnit),
    [L.colActualHours]: fmtDuration(w.todayHoursMs, L.hourUnit, L.minUnit),
    [L.colWorkDone]: '',
    [L.colTeam]: w.brigadeName || '',
    [L.colOvertimeSystem]: w.mesaiSistemi === 'Aylık' ? L.mesaiMonthly : L.mesaiHourly,
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Workers')

  const date = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `workers-${date}.xlsx`)
}
