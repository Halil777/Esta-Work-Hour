import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Check, X, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
import { cardReportsApi, type CardReport, type CardReportStatus } from '../api/cardReports'
import { workersApi, type WorkerApi } from '../api/workers'
import { useTranslation } from '../i18n/useTranslation'

const STATUS_COLORS: Record<CardReportStatus, string> = {
  pending: '#F59E0B',
  resolved: '#10B981',
  dismissed: '#94A3B8',
}

// Lets the admin pick which worker a mis-scanned card actually belongs to,
// instead of blindly "resolving" a report that has no suggestedWorkerId —
// which used to just flip the report's status without ever fixing the card.
// Mirrors NfcEventsPage's LinkCardModal so the pattern stays consistent.
function AssignWorkerModal({
  report,
  onClose,
  onAssign,
  assigning,
}: {
  report: CardReport
  onClose: () => void
  onAssign: (worker: WorkerApi) => void
  assigning: boolean
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const { data: workers = [] } = useQuery({
    queryKey: ['workers-for-card-report'],
    queryFn: () => workersApi.list(),
    staleTime: 30_000,
  })

  const filtered = workers.filter(w =>
    !search ||
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.workerId.toLowerCase().includes(search.toLowerCase()),
  )
  const suggested = report.suggestedWorkerId
    ? workers.find(w => w.workerId === report.suggestedWorkerId)
    : undefined

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={event => event.target === event.currentTarget && onClose()}
    >
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 460, maxWidth: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>{t.cardReports.assignModalTitle}</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{report.cardUid}</p>
          </div>
          <button className="btn btn--secondary btn--sm" type="button" onClick={onClose}>✕</button>
        </div>

        {suggested && (
          <button
            type="button"
            className="btn btn--primary"
            style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '8px 12px' }}
            onClick={() => onAssign(suggested)}
            disabled={assigning}
          >
            <AlertTriangle size={13} style={{ marginRight: 6 }} />
            <span style={{ fontWeight: 600 }}>{suggested.name}</span>
            <span style={{ opacity: 0.85, fontSize: 12, marginLeft: 8 }}>{suggested.workerId}</span>
            <span style={{ fontSize: 11, marginLeft: 'auto', opacity: 0.85 }}>{t.cardReports.suggestedPick}</span>
          </button>
        )}

        <input
          className="input"
          placeholder={t.nfcPage.workerSearchPlaceholder}
          value={search}
          onChange={event => setSearch(event.target.value)}
          autoFocus
        />
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map(w => (
            <button
              key={w.id}
              type="button"
              className="btn btn--secondary"
              style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '8px 12px' }}
              onClick={() => onAssign(w)}
              disabled={assigning}
            >
              <span style={{ fontWeight: 600 }}>{w.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>{w.workerId}</span>
              {w.nfcCardUid && w.nfcCardUid !== report.cardUid && (
                <span style={{ color: '#F59E0B', fontSize: 11, marginLeft: 8 }}>⚠ {t.nfcPage.anotherCard}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CardReportsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [assignTarget, setAssignTarget] = useState<CardReport | null>(null)

  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ['card-reports', statusFilter],
    queryFn: () => cardReportsApi.list(statusFilter || undefined),
    refetchInterval: 30_000,
  })

  // A report's "fix" changes a Worker row's nfcCardUid, which other pages
  // (Workers list, worker detail, NFC journal) already have cached — without
  // this those pages kept showing the old/wrong card assignment until a full
  // reload, i.e. the exact "static, not dynamic" symptom that was reported.
  const invalidateWorkerCaches = () =>
    qc.invalidateQueries({
      predicate: query => typeof query.queryKey[0] === 'string' && query.queryKey[0].toLowerCase().startsWith('worker'),
    })

  const resolveMut = useMutation({
    mutationFn: ({ id, workerId }: { id: string; workerId?: string }) => cardReportsApi.resolve(id, workerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card-reports'] })
      invalidateWorkerCaches()
      setAssignTarget(null)
    },
  })

  const dismissMut = useMutation({
    mutationFn: (id: string) => cardReportsApi.dismiss(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['card-reports'] }),
  })

  const handleAssign = (worker: WorkerApi) => {
    if (!assignTarget) return
    resolveMut.mutate({ id: assignTarget.id, workerId: worker.workerId })
  }

  const statusTabs: { key: string; label: string }[] = [
    { key: 'pending', label: t.cardReports.pending },
    { key: 'resolved', label: t.cardReports.resolved },
    { key: 'dismissed', label: t.cardReports.dismissed },
    { key: '', label: t.common.all },
  ]

  return (
    <>
      {assignTarget && (
        <AssignWorkerModal
          report={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssign={handleAssign}
          assigning={resolveMut.isPending}
        />
      )}

      <div className="page-header">
        <div style={{ flex: 1 }}>
          <h1>{t.cardReports.title}</h1>
          <span className="page-kicker">{t.cardReports.pageDesc}</span>
        </div>
        <button className="btn btn--secondary btn--sm" type="button" onClick={() => refetch()}>
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="card">
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 0 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {statusTabs.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`btn btn--sm ${statusFilter === tab.key ? 'btn--primary' : 'btn--secondary'}`}
                style={{ fontSize: 12 }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <div>{t.common.loading}</div>
          </div>
        ) : reports.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <CreditCard size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
            <div>{t.cardReports.noData}</div>
          </div>
        ) : (
          <div style={{ padding: '0 0 8px' }}>
            {reports.map(report => (
              <div
                key={report.id}
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                }}
              >
                {/* Status indicator */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                  background: STATUS_COLORS[report.status],
                }} />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                      background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: 4,
                      border: '1px solid var(--border)', color: 'var(--text-primary)',
                    }}>
                      {report.cardUid}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(report.createdAt).toLocaleString()}
                    </span>
                    {report.deviceLabel && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        📟 {report.deviceLabel}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
                    {report.currentWorkerName && (
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{t.cardReports.currentWorker}: </span>
                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{report.currentWorkerName}</span>
                      </div>
                    )}
                    {(report.suggestedWorkerId || report.suggestedWorkerName) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={12} color="#F59E0B" />
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{t.cardReports.suggestedWorker}: </span>
                        <span style={{ color: '#10B981', fontWeight: 600 }}>
                          {report.suggestedWorkerName || report.suggestedWorkerId}
                          {report.suggestedWorkerId && report.suggestedWorkerName && ` (${report.suggestedWorkerId})`}
                        </span>
                      </div>
                    )}
                    {report.note && (
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{t.cardReports.note}: </span>
                        <span style={{ color: 'var(--text-secondary)' }}>{report.note}</span>
                      </div>
                    )}
                  </div>

                  {report.status === 'resolved' && report.resolvedBy && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                      ✓ {t.cardReports.resolvedBy}: {report.resolvedBy}
                      {report.resolvedAt && ` · ${new Date(report.resolvedAt).toLocaleString()}`}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {report.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      className="btn btn--primary btn--sm"
                      type="button"
                      style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => setAssignTarget(report)}
                      disabled={resolveMut.isPending}
                    >
                      <Check size={12} /> {t.cardReports.resolveBtn}
                    </button>
                    <button
                      className="btn btn--secondary btn--sm"
                      type="button"
                      style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => dismissMut.mutate(report.id)}
                      disabled={dismissMut.isPending}
                    >
                      <X size={12} /> {t.cardReports.dismissBtn}
                    </button>
                  </div>
                )}
                {report.status !== 'pending' && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
                    background: report.status === 'resolved' ? 'var(--success-light, #F0FDF4)' : 'var(--bg-surface)',
                    color: STATUS_COLORS[report.status],
                    border: `1px solid ${STATUS_COLORS[report.status]}40`,
                    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  }}>
                    {report.status === 'resolved' ? <Check size={11} /> : <Clock size={11} />}
                    {t.cardReports[report.status]}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
