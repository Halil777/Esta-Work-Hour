import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Check, X, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
import { cardReportsApi, type CardReport, type CardReportStatus } from '../api/cardReports'
import { useTranslation } from '../i18n/useTranslation'

const STATUS_COLORS: Record<CardReportStatus, string> = {
  pending: '#F59E0B',
  resolved: '#10B981',
  dismissed: '#94A3B8',
}

export function CardReportsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('pending')

  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ['card-reports', statusFilter],
    queryFn: () => cardReportsApi.list(statusFilter || undefined),
    refetchInterval: 30_000,
  })

  const resolveMut = useMutation({
    mutationFn: (id: string) => cardReportsApi.resolve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['card-reports'] }),
  })

  const dismissMut = useMutation({
    mutationFn: (id: string) => cardReportsApi.dismiss(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['card-reports'] }),
  })

  const handleResolve = (report: CardReport) => {
    if (!confirm(t.cardReports.confirmResolve)) return
    resolveMut.mutate(report.id)
  }

  const statusTabs: { key: string; label: string }[] = [
    { key: 'pending', label: t.cardReports.pending },
    { key: 'resolved', label: t.cardReports.resolved },
    { key: 'dismissed', label: t.cardReports.dismissed },
    { key: '', label: t.common.all },
  ]

  return (
    <>
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
                      onClick={() => handleResolve(report)}
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
