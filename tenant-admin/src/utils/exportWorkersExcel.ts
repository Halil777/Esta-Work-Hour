import * as XLSX from 'xlsx'
import type { WorkerApi } from '../api/workers'

const APP_TZ = 'Europe/Moscow'

function fmtTime(ts: number | null | undefined): string {
  if (!ts) return ''
  return new Date(ts).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: APP_TZ,
  })
}

function fmtDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return ''
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} sag`
  return `${h} sag ${m} min`
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
export function exportWorkersToExcel(workers: WorkerApi[]) {
  const rows = workers.map(w => ({
    'Sicil No': w.workerId,
    'İnsan Adı': w.name,
    'Görev': w.profession || '',
    'GIRIS SAATI': fmtTime(w.lastCheckIn),
    'CIKIS SAATI': fmtTime(w.lastCheckOut),
    'TOPLAM SAATI': w.mesaiSistemi === 'Aylık' ? '8 sag' : fmtDuration(w.todayHoursMs),
    'HAKYKY SAAT': fmtDuration(w.todayHoursMs),
    'YAPILAN IS': '',
    'EKIP': w.brigadeName || '',
    'Mesai Sistemi': w.mesaiSistemi || 'Saatlik',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Workers')

  const date = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `workers-${date}.xlsx`)
}
