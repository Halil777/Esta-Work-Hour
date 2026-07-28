import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Download, History, Mail, RefreshCw, Send, X } from 'lucide-react'
import { workersApi, type WorkerLifecycleReport } from '../../api/workers'
import { fmtDateTime } from '../../utils/dateTime'
import { Badge } from '../ui/Badge'
import { useTranslation } from '../../i18n/useTranslation'

type WorkerLifecycleReportHistoryModalProps = {
  onClose: () => void
  onChanged: () => void
}

export function WorkerLifecycleReportHistoryModal({ onClose, onChanged }: WorkerLifecycleReportHistoryModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['worker-lifecycle-reports'],
    queryFn: () => workersApi.lifecycleReports(40),
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['worker-lifecycle-reports'] })
    onChanged()
  }

  const resendMutation = useMutation({
    mutationFn: (batchId: string) => workersApi.resendLifecycleReport(batchId),
    onSuccess: refresh,
    onError: (error: Error) => setError(error.message || t.lifecycleHistory.errorSend),
  })

  const sendPendingMutation = useMutation({
    mutationFn: workersApi.sendPendingLifecycleReports,
    onSuccess: refresh,
    onError: (error: Error) => setError(error.message || t.lifecycleHistory.errorSendPending),
  })

  const handleDownload = async (report: WorkerLifecycleReport) => {
    setError('')
    try {
      await workersApi.downloadLifecycleReport(report.batchId)
    } catch (error) {
      setError(error instanceof Error ? error.message : t.lifecycleHistory.errorDownload)
    }
  }

  return (
    <div className="modal-overlay" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: 920 }}>
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <History size={17} /> {t.lifecycleHistory.title}
          </h3>
          <button className="btn btn--ghost btn--sm" type="button" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t.lifecycleHistory.description}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn--secondary btn--sm" type="button" onClick={refresh}>
                <RefreshCw size={13} /> {t.lifecycleHistory.refresh}
              </button>
              <button
                className="btn btn--primary btn--sm"
                type="button"
                onClick={() => { setError(''); sendPendingMutation.mutate() }}
                disabled={sendPendingMutation.isPending}
              >
                <Send size={13} /> {sendPendingMutation.isPending ? t.lifecycleHistory.sending : t.lifecycleHistory.sendPending}
              </button>
            </div>
          </div>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--danger-light)', borderRadius: 6, marginBottom: 10, color: 'var(--danger)', fontSize: 13 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div className="table-wrap" style={{ maxHeight: 460 }}>
            <table>
              <thead>
                <tr>
                  <th>{t.lifecycleHistory.colStatus}</th>
                  <th>{t.lifecycleHistory.colBatch}</th>
                  <th>{t.lifecycleHistory.colEvent}</th>
                  <th>{t.lifecycleHistory.colRecipients}</th>
                  <th>{t.lifecycleHistory.colTime}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6}><div className="empty-state"><p>{t.common.loading}</p></div></td></tr>
                ) : reports.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state"><Mail size={32} /><p>{t.lifecycleHistory.noReports}</p></div></td></tr>
                ) : reports.map(report => (
                  <tr key={report.id}>
                    <td>
                      <Badge dot variant={report.status === 'sent' ? 'success' : 'danger'}>
                        {report.status === 'sent' ? t.lifecycleHistory.statusSent : t.lifecycleHistory.statusFailed}
                      </Badge>
                      {report.resendCount > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                          {t.lifecycleHistory.resendLabel}: {report.resendCount}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="td-mono" style={{ fontSize: 11 }}>{report.batchId}</div>
                      {report.error && (
                        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {report.error}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{report.eventCount}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        +{report.counts.created} / -{report.counts.terminated} / R{report.counts.restored}
                      </div>
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {report.recipients.length ? report.recipients.join(', ') : '-'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{fmtDateTime(report.sentAt ?? report.createdAt)}</div>
                      {report.resentAt && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                          {t.lifecycleHistory.resendLabel}: {fmtDateTime(report.resentAt)}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="td-actions">
                        <button className="btn btn--ghost btn--sm" type="button" title="Excel download" onClick={() => handleDownload(report)}>
                          <Download size={13} />
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          type="button"
                          title={report.status === 'failed' ? 'Retry' : 'Resend'}
                          onClick={() => { setError(''); resendMutation.mutate(report.batchId) }}
                          disabled={resendMutation.isPending}
                        >
                          <RefreshCw size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn--secondary btn--sm" type="button" onClick={onClose}>{t.common.close}</button>
        </div>
      </div>
    </div>
  )
}
