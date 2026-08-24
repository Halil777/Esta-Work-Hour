import type { ElementType, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Inbox as InboxIcon, CreditCard, Clock, WifiOff, Check, X,
  AlertTriangle, ArrowRight, PartyPopper, RefreshCw,
} from 'lucide-react'
import { adminInboxApi } from '../api/adminInbox'
import { cardReportsApi } from '../api/cardReports'
import { extraHoursApi } from '../api/extraHours'
import { useTranslation } from '../i18n/useTranslation'

function fmtLastSeen(t: ReturnType<typeof useTranslation>['t'], ts: string | null) {
  if (!ts) return t.inbox.neverSeen
  return new Date(ts).toLocaleString()
}

const sumHours = (items: { extraHours: number }[]) =>
  items.reduce((acc, i) => acc + Number(i.extraHours), 0)

// ─── Section shell ────────────────────────────────────────────────────────

function InboxSection({
  icon: Icon, title, count, emptyLabel, children,
}: {
  icon: ElementType
  title: string
  count: number
  emptyLabel: string
  children: ReactNode
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={15} />
        <h3 style={{ margin: 0, flex: 1 }}>{title}</h3>
        {count > 0 && (
          <span className="badge badge--dot badge--warning" style={{ fontSize: 11 }}>{count}</span>
        )}
      </div>
      <div className="card-body card-body--p0">
        {count === 0 ? (
          <div style={{ padding: '20px 20px', color: 'var(--text-muted)', fontSize: 13 }}>{emptyLabel}</div>
        ) : children}
      </div>
    </div>
  )
}

export function InboxPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-inbox'],
    queryFn: () => adminInboxApi.get(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const invalidateWorkerCaches = () =>
    qc.invalidateQueries({
      predicate: query => typeof query.queryKey[0] === 'string' && query.queryKey[0].toLowerCase().startsWith('worker'),
    })

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['admin-inbox'] })
    qc.invalidateQueries({ queryKey: ['card-reports'] })
    qc.invalidateQueries({ queryKey: ['extra-hours'] })
    invalidateWorkerCaches()
  }

  const resolveMut = useMutation({
    mutationFn: ({ id, workerId }: { id: string; workerId?: string }) => cardReportsApi.resolve(id, workerId),
    onSuccess: refreshAll,
  })

  const dismissMut = useMutation({
    mutationFn: (id: string) => cardReportsApi.dismiss(id),
    onSuccess: refreshAll,
  })

  const extraHoursMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approved' | 'rejected' }) => extraHoursApi.action(id, action),
    onSuccess: refreshAll,
  })

  const counts = data?.counts ?? { cardReports: 0, extraHours: 0, staleDevices: 0, total: 0 }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <InboxIcon size={20} /> {t.inbox.title}
          </h1>
          <span className="page-kicker">{t.inbox.subtitle}</span>
        </div>
        <button className="btn btn--secondary btn--sm" type="button" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={13} style={isFetching ? { animation: 'spin 1s linear infinite' } : undefined} />
        </button>
      </div>

      {isLoading ? (
        <div className="card"><div className="card-body" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>{t.common.loading}</div></div>
      ) : counts.total === 0 ? (
        <div className="card">
          <div className="card-body" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <PartyPopper size={32} style={{ marginBottom: 10, opacity: 0.5 }} />
            <div>{t.inbox.allClear}</div>
          </div>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8, marginBottom: 18 }}>
            {t.inbox.totalPending.replace('{{n}}', String(counts.total))}
          </p>

          {/* ── Card reports ── */}
          <InboxSection
            icon={CreditCard}
            title={t.inbox.sectionCardReports}
            count={counts.cardReports}
            emptyLabel={t.cardReports.noData}
          >
            {data!.cardReports.map(report => (
              <div key={report.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>
                      {report.cardUid}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(report.createdAt).toLocaleString()}</span>
                    {report.deviceLabel && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>📟 {report.deviceLabel}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
                    {report.currentWorkerName && (
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{t.cardReports.currentWorker}: </span>
                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{report.currentWorkerName}</span>
                      </div>
                    )}
                    {(report.suggestedWorkerId || report.suggestedWorkerName) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={12} color="#F59E0B" />
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{t.cardReports.suggestedWorker}: </span>
                        <span style={{ color: '#10B981', fontWeight: 600 }}>
                          {report.suggestedWorkerName || report.suggestedWorkerId}
                          {report.suggestedWorkerId && report.suggestedWorkerName && ` (${report.suggestedWorkerId})`}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t.inbox.noSuggestion}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {report.suggestedWorkerId ? (
                    <button
                      className="btn btn--primary btn--sm"
                      type="button"
                      style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => resolveMut.mutate({ id: report.id, workerId: report.suggestedWorkerId! })}
                      disabled={resolveMut.isPending}
                    >
                      <Check size={12} /> {t.inbox.approveSuggested}
                    </button>
                  ) : (
                    <Link to="/card-reports" className="btn btn--secondary btn--sm" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {t.inbox.openCardReports} <ArrowRight size={11} />
                    </Link>
                  )}
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
              </div>
            ))}
          </InboxSection>

          {/* ── Extra hours ── */}
          <InboxSection
            icon={Clock}
            title={t.inbox.sectionExtraHours}
            count={counts.extraHours}
            emptyLabel={t.common.noData}
          >
            {data!.extraHours.map(r => (
              <div key={r.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{r.workDate}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.foremanName} → {r.siteChiefName}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {r.items.length} {t.overtime.workerCount} · <span style={{ fontWeight: 600, color: 'var(--text)' }}>{sumHours(r.items)}h</span>
                    {r.note && <span> · {r.note}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn btn--success btn--sm"
                    type="button"
                    title={t.overtime.approve}
                    disabled={extraHoursMut.isPending}
                    onClick={() => extraHoursMut.mutate({ id: r.id, action: 'approved' })}
                  >
                    <Check size={12} />
                  </button>
                  <button
                    className="btn btn--danger btn--sm"
                    type="button"
                    title={t.overtime.reject}
                    disabled={extraHoursMut.isPending}
                    onClick={() => extraHoursMut.mutate({ id: r.id, action: 'rejected' })}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </InboxSection>

          {/* ── Stale devices ── */}
          <InboxSection
            icon={WifiOff}
            title={t.inbox.sectionStaleDevices}
            count={counts.staleDevices}
            emptyLabel={t.common.noData}
          >
            {data!.staleDevices.map(d => (
              <div key={d.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{d.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {d.location && <span>📍 {d.location}</span>}
                    {d.operatorName && <span>👤 {d.operatorName}</span>}
                    <span style={{ color: 'var(--warning)' }}>🕐 {t.inbox.lastSeen}: {fmtLastSeen(t, d.lastSeenAt)}</span>
                  </div>
                </div>
                <Link to="/scanner-devices" className="btn btn--secondary btn--sm" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {t.inbox.openDevices} <ArrowRight size={11} />
                </Link>
              </div>
            ))}
          </InboxSection>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
