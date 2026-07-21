import { Clock3 } from 'lucide-react'
import type { WorkerApi, WorkerLifecyclePendingSummary } from '../../api/workers'
import { fmtSendAt } from '../../utils/dateTime'

type WorkerMetricsStripProps = {
  workers: WorkerApi[]
  lifecycleSummary?: WorkerLifecyclePendingSummary
}

export function WorkerMetricsStrip({ workers, lifecycleSummary }: WorkerMetricsStripProps) {
  const activeCount = workers.filter(worker => worker.status === 'Active').length
  const scannedCount = workers.filter(worker => worker.lastCheckIn).length
  const noScanCount = workers.filter(worker => !worker.lastCheckIn).length
  const staffCount = workers.filter(worker => worker.isStaff).length
  const pendingReportCount = lifecycleSummary?.total ?? 0
  const pendingCreated = lifecycleSummary?.counts.created ?? 0
  const pendingTerminated = lifecycleSummary?.counts.terminated ?? 0
  const pendingRestored = lifecycleSummary?.counts.restored ?? 0
  const reportChipTitle = pendingReportCount > 0
    ? `${pendingCreated} täze, ${pendingTerminated} işden çykan, ${pendingRestored} gaýtadan aktiw`
    : `Manual lifecycle report ${lifecycleSummary?.delayMinutes ?? 10} minut batch bilen ugradylýar`

  return (
    <div className="metric-strip">
      <div className="metric-chip">
        <span className="metric-chip__value">{workers.length}</span>
        <span className="metric-chip__label">Görkezilen işçi</span>
      </div>
      <div className="metric-chip">
        <span className="metric-chip__value">{activeCount}</span>
        <span className="metric-chip__label">Aktiw</span>
      </div>
      <div className="metric-chip">
        <span className="metric-chip__value">{scannedCount}</span>
        <span className="metric-chip__label">Şu döwürde skan bar</span>
      </div>
      <div className="metric-chip">
        <span className="metric-chip__value">{noScanCount}</span>
        <span className="metric-chip__label">Skan ýok</span>
      </div>
      <div className="metric-chip">
        <span className="metric-chip__value">{staffCount}</span>
        <span className="metric-chip__label">Staff</span>
      </div>
      <div className={`metric-chip${pendingReportCount > 0 ? ' metric-chip--alert' : ''}`} title={reportChipTitle}>
        <span className="metric-chip__value">
          <Clock3 size={15} /> {pendingReportCount}
        </span>
        <span className="metric-chip__label">Report nobaty · {fmtSendAt(lifecycleSummary?.nextSendAt)}</span>
      </div>
    </div>
  )
}
