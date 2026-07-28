import { Clock3 } from 'lucide-react'
import type { WorkerApi, WorkerLifecyclePendingSummary } from '../../api/workers'
import { fmtSendAt } from '../../utils/dateTime'
import { useTranslation } from '../../i18n/useTranslation'

type WorkerMetricsStripProps = {
  workers: WorkerApi[]
  lifecycleSummary?: WorkerLifecyclePendingSummary
}

export function WorkerMetricsStrip({ workers, lifecycleSummary }: WorkerMetricsStripProps) {
  const { t } = useTranslation()
  const activeCount = workers.filter(worker => worker.status === 'Active').length
  const scannedCount = workers.filter(worker => worker.lastCheckIn).length
  const noScanCount = workers.filter(worker => !worker.lastCheckIn).length
  const staffCount = workers.filter(worker => worker.isStaff).length
  const pendingReportCount = lifecycleSummary?.total ?? 0
  const pendingCreated = lifecycleSummary?.counts.created ?? 0
  const pendingTerminated = lifecycleSummary?.counts.terminated ?? 0
  const pendingRestored = lifecycleSummary?.counts.restored ?? 0
  const reportChipTitle = pendingReportCount > 0
    ? `${pendingCreated} ${t.workers.metricsNew}, ${pendingTerminated} ${t.workers.metricsTerminatedCount}, ${pendingRestored} ${t.workers.metricsRestoredCount}`
    : `Lifecycle report ${lifecycleSummary?.delayMinutes ?? 10} ${t.workers.metricsBatchInfo}`

  return (
    <div className="metric-strip">
      <div className="metric-chip">
        <span className="metric-chip__value">{workers.length}</span>
        <span className="metric-chip__label">{t.workers.metricsShown}</span>
      </div>
      <div className="metric-chip">
        <span className="metric-chip__value">{activeCount}</span>
        <span className="metric-chip__label">{t.common.active}</span>
      </div>
      <div className="metric-chip">
        <span className="metric-chip__value">{scannedCount}</span>
        <span className="metric-chip__label">{t.workers.metricsScanned}</span>
      </div>
      <div className="metric-chip">
        <span className="metric-chip__value">{noScanCount}</span>
        <span className="metric-chip__label">{t.workers.metricsNoScan}</span>
      </div>
      <div className="metric-chip">
        <span className="metric-chip__value">{staffCount}</span>
        <span className="metric-chip__label">{t.workers.metricsStaff}</span>
      </div>
      <div className={`metric-chip${pendingReportCount > 0 ? ' metric-chip--alert' : ''}`} title={reportChipTitle}>
        <span className="metric-chip__value">
          <Clock3 size={15} /> {pendingReportCount}
        </span>
        <span className="metric-chip__label">{t.workers.metricsReportQueue} · {fmtSendAt(lifecycleSummary?.nextSendAt)}</span>
      </div>
    </div>
  )
}
