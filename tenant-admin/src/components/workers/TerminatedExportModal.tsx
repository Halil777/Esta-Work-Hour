import { useState } from 'react'
import { Calendar, Download, RefreshCw } from 'lucide-react'
import type { WorkerApi } from '../../api/workers'
import { reportsApi } from '../../api/reportConfig'
import { todayIso } from '../../utils/dateTime'
import { useTranslation } from '../../i18n/useTranslation'
import { AppModal } from '../ui/AppModal'

type TerminatedExportModalProps = {
  workers: WorkerApi[]
  language: string
  onClose: () => void
}

// Fallback span when none of the selected workers have a hire date on file —
// wide enough to catch older scan history without querying the whole
// attendance table for a truly unbounded "all time" range.
const FALLBACK_YEARS_BACK = 3

function isoYearsAgo(years: number): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  return d.toISOString().split('T')[0]
}

// The actual window a worker could have scanned in: from their hire date to
// their termination date (or today, if that's somehow in the future). Used
// both as the "All worked days" one-click range and as the initial value of
// the custom range inputs, so the date pickers never open on an arbitrary
// default.
function employmentRange(workers: WorkerApi[], today: string): { start: string; end: string } {
  const hireDates = workers.map(w => w.hireDate).filter((d): d is string => Boolean(d))
  const endDates = workers
    .map(w => w.terminationDate ?? (w.terminatedAt ? w.terminatedAt.split('T')[0] : null))
    .filter((d): d is string => Boolean(d))
  const start = hireDates.length > 0 ? [...hireDates].sort()[0] : isoYearsAgo(FALLBACK_YEARS_BACK)
  const rawEnd = endDates.length > 0 ? [...endDates].sort().slice(-1)[0] : today
  const end = rawEnd > today ? today : rawEnd
  return { start, end }
}

export function TerminatedExportModal({ workers, language, onClose }: TerminatedExportModalProps) {
  const { t } = useTranslation()
  const today = todayIso()
  const initial = employmentRange(workers, today)

  const [startDate, setStartDate] = useState(initial.start)
  const [endDate, setEndDate] = useState(initial.end)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const workerIds = workers.map(w => w.workerId)

  const download = async (sd: string, ed: string) => {
    setError('')
    setDownloading(true)
    try {
      await reportsApi.downloadRangeXlsx(sd, ed, workerIds, language)
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.error)
    } finally {
      setDownloading(false)
    }
  }

  const handleAllWorked = () => {
    const { start, end } = employmentRange(workers, today)
    setStartDate(start)
    setEndDate(end)
    download(start, end)
  }

  const handleRangeDownload = () => download(startDate, endDate)

  return (
    <AppModal
      title={t.terminatedPage.exportModalTitle}
      onClose={onClose}
      maxWidth={440}
      footer={
        <button className="btn btn--secondary btn--sm" type="button" onClick={onClose}>{t.common.cancel}</button>
      }
    >
      <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 14, fontSize: 12.5, color: 'var(--text-secondary)' }}>
        {t.terminatedPage.exportModalDesc.replace('{{n}}', String(workers.length))}
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: 'var(--danger-light)', borderRadius: 6, marginBottom: 12, color: 'var(--danger)', fontSize: 12.5 }}>
          {error}
        </div>
      )}

      <button
        className="btn btn--primary btn--sm"
        type="button"
        onClick={handleAllWorked}
        disabled={downloading}
        style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}
      >
        {downloading ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Calendar size={13} />}
        {t.terminatedPage.exportAllWorked}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 14px', color: 'var(--text-muted)', fontSize: 11.5 }}>
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        {t.terminatedPage.exportOrRange}
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="form-row">
          <label className="form-label">{t.reports.fromDate}</label>
          <input type="date" value={startDate} max={endDate} onChange={event => setStartDate(event.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">{t.reports.toDate}</label>
          <input type="date" value={endDate} min={startDate} onChange={event => setEndDate(event.target.value)} />
        </div>
      </div>

      <button
        className="btn btn--secondary btn--sm"
        type="button"
        onClick={handleRangeDownload}
        disabled={downloading}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {downloading ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />}
        {t.reports.downloadExcel}
      </button>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </AppModal>
  )
}
