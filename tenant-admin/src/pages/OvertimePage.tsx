import { useState } from 'react'
import { Check, X, AlertCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { extraHoursApi, type ExtraHoursRequest } from '../api/extraHours'

type StatusFilter = 'all' | 'pending' | 'seen' | 'approved' | 'rejected'

type StatusMeta = { label: string; variant: string }

function getStatusMeta(s: ExtraHoursRequest['status']): StatusMeta {
  const map: Record<ExtraHoursRequest['status'], StatusMeta> = {
    pending: { label: 'Garaşylýar', variant: 'warning' },
    seen:    { label: 'Görüldi', variant: 'info' },
    approved: { label: 'Tassyklandy', variant: 'success' },
    rejected: { label: 'Ret edildi', variant: 'danger' },
  }
  return map[s] ?? { label: s, variant: 'neutral' }
}

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('tr-TR') } catch { return d }
}

const sumHours = (items: ExtraHoursRequest['items']) =>
  items.reduce((acc, i) => acc + Number(i.extraHours), 0)

const STATUS_FILTERS: StatusFilter[] = ['all', 'pending', 'seen', 'approved', 'rejected']
const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Ählisi',
  pending: 'Garaşylýar',
  seen: 'Görüldi',
  approved: 'Tassyklandy',
  rejected: 'Ret edildi',
}

export function OvertimePage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ['extra-hours', statusFilter],
    queryFn: () => extraHoursApi.list(statusFilter !== 'all' ? { status: statusFilter } : {}),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approved' | 'rejected' }) =>
      extraHoursApi.action(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['extra-hours'] }),
  })

  const selected = selectedId ? requests.find(r => r.id === selectedId) : null

  return (
    <>
      <div className="page-header">
        <h1>{t.overtime.title}</h1>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(sf => (
          <button
            key={sf}
            className={`btn btn--sm ${statusFilter === sf ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setStatusFilter(sf)}
          >
            {STATUS_LABELS[sf]}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>{t.overtime.title}</h3>
          <span className="text-xs text-muted">{requests.length} sorag</span>
        </div>
        <div className="card-body card-body--p0">
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', color: 'var(--danger)', fontSize: 13 }}>
              <AlertCircle size={14} /> {String(error)} — Backend işleýärmi? (port 3002)
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.overtime.workDate}</th>
                  <th>{t.overtime.foreman}</th>
                  <th>Site Chief</th>
                  <th>{t.overtime.workers}</th>
                  <th>{t.overtime.hours}</th>
                  <th>{t.overtime.reason}</th>
                  <th>{t.overtime.status}</th>
                  <th>{t.overtime.actions}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8}><div className="empty-state"><p>{t.common.loading}</p></div></td></tr>
                ) : requests.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div className="empty-state"><p>{t.common.noData}</p></div>
                  </td></tr>
                ) : requests.map(r => {
                  const meta = getStatusMeta(r.status)
                  const hours = sumHours(r.items)
                  return (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}>
                      <td className="fw-600">{r.workDate}</td>
                      <td className="td-muted">{r.foremanName}</td>
                      <td className="td-muted">{r.siteChiefName}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{r.items.length}</span>
                          <span className="text-xs text-muted">işçi</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{hours}h</span>
                      </td>
                      <td style={{ maxWidth: 180 }}>
                        <span className="truncate text-sm text-muted" style={{ display: 'block' }}>{r.note || '—'}</span>
                      </td>
                      <td><span className={`badge badge--dot badge--${meta.variant}`}>{meta.label}</span></td>
                      <td>
                        <div className="td-actions" onClick={e => e.stopPropagation()}>
                          {(r.status === 'pending' || r.status === 'seen') && (
                            <>
                              <button
                                className="btn btn--success btn--sm"
                                title={t.overtime.approve}
                                disabled={actionMutation.isPending}
                                onClick={() => actionMutation.mutate({ id: r.id, action: 'approved' })}
                              >
                                <Check size={12} />
                              </button>
                              <button
                                className="btn btn--danger btn--sm"
                                title={t.overtime.reject}
                                disabled={actionMutation.isPending}
                                onClick={() => actionMutation.mutate({ id: r.id, action: 'rejected' })}
                              >
                                <X size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && (
        <div className="card" style={{ borderLeft: '3px solid var(--primary)' }}>
          <div className="card-header">
            <h3>Sorag — {selected.foremanName}</h3>
            <button className="btn btn--ghost btn--sm" onClick={() => setSelectedId(null)}><X size={13} /></button>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
              {[
                { label: t.overtime.workDate, value: selected.workDate },
                { label: t.overtime.requestDate, value: fmtDate(selected.sentAt) },
                { label: t.overtime.foreman, value: selected.foremanName },
                { label: 'Site Chief', value: selected.siteChiefName },
                { label: t.overtime.workers, value: `${selected.items.length} işçi` },
                { label: t.overtime.hours, value: `${sumHours(selected.items)} saat` },
              ].map(item => (
                <div key={item.label} style={{ background: 'var(--bg-surface-2)', borderRadius: 8, padding: '10px 12px' }}>
                  <div className="text-xs text-muted" style={{ marginBottom: 3 }}>{item.label}</div>
                  <div className="fw-600" style={{ fontSize: 13 }}>{item.value}</div>
                </div>
              ))}
            </div>

            {selected.note && (
              <div style={{ marginBottom: 12, background: 'var(--bg-surface-2)', borderRadius: 8, padding: '10px 12px' }}>
                <div className="text-xs text-muted" style={{ marginBottom: 4 }}>{t.overtime.reason}</div>
                <div style={{ fontSize: 13 }}>{selected.note}</div>
              </div>
            )}

            {selected.items.length > 0 && (
              <div>
                <div className="text-xs text-muted fw-600" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Işçiler ({selected.items.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {selected.items.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{item.workerName}</span>
                      <span className="td-muted" style={{ fontSize: 11 }}>{item.workerId}</span>
                      <span style={{ fontWeight: 600, color: 'var(--primary-text)', fontSize: 13 }}>{item.extraHours}h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
