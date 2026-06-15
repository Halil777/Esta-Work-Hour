import { Users, UserCheck, UserX, Clock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { workersApi } from '../api/workers'
import { extraHoursApi } from '../api/extraHours'
import { auditLogApi } from '../api/auditLog'

function StatCard({ value, label, sub, icon, color, bg }: {
  value: string | number; label: string; sub?: string
  icon: React.ReactNode; color: string; bg: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-card__header">
        <div className="stat-card__icon" style={{ background: bg }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </div>
  )
}

const actionLabels: Record<string, string> = {
  CREATE: 'goşuldy',
  UPDATE: 'üýtgedildi',
  DELETE: 'pozuldy',
}

const entityLabels: Record<string, string> = {
  Worker: 'Işçi',
  Foreman: 'Foremen',
}

export function DashboardPage() {
  const { t } = useTranslation()
  const today = new Date().toISOString().split('T')[0]

  const { data: workers = [] } = useQuery({
    queryKey: ['workers-dash', today],
    queryFn: () => workersApi.list({ startDate: today, endDate: today }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const { data: pendingOT = [] } = useQuery({
    queryKey: ['extra-hours', 'pending'],
    queryFn: () => extraHoursApi.list({ status: 'pending' }),
    staleTime: 30_000,
  })

  const { data: seenOT = [] } = useQuery({
    queryKey: ['extra-hours', 'seen'],
    queryFn: () => extraHoursApi.list({ status: 'seen' }),
    staleTime: 30_000,
  })

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs-dash'],
    queryFn: () => auditLogApi.list(15),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const presentToday = workers.filter(w => w.lastCheckIn).length
  const absentToday = workers.filter(w => !w.lastCheckIn).length
  const totalWorkers = workers.length
  const pendingOTCount = pendingOT.length + seenOT.length

  // Brigade breakdown from workers
  const brigadeMap = new Map<string, { name: string; total: number; present: number }>()
  for (const w of workers) {
    const key = w.brigadeName || '—'
    const b = brigadeMap.get(key) ?? { name: key, total: 0, present: 0 }
    b.total++
    if (w.lastCheckIn) b.present++
    brigadeMap.set(key, b)
  }
  const brigadeRows = Array.from(brigadeMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  return (
    <>
      <div className="stats-grid">
        <StatCard value={totalWorkers} label={t.dashboard.totalWorkers}
          icon={<Users size={16} />} color="var(--primary-text)" bg="var(--primary-light)" />
        <StatCard
          value={presentToday}
          label={t.dashboard.presentToday}
          sub={totalWorkers > 0 ? `${Math.round((presentToday / totalWorkers) * 100)}% gatnaşyk` : undefined}
          icon={<UserCheck size={16} />} color="var(--success)" bg="var(--success-light)"
        />
        <StatCard value={absentToday} label={t.dashboard.absentToday}
          icon={<UserX size={16} />} color="var(--danger)" bg="var(--danger-light)" />
        <StatCard value={pendingOTCount} label={t.dashboard.pendingOvertime}
          icon={<Clock size={16} />} color="var(--warning)" bg="var(--warning-light)" />
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-header"><h3>{t.dashboard.brigadeStatus}</h3></div>
          <div className="card-body card-body--p0">
            {brigadeRows.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <p style={{ fontSize: 13 }}>Şu gün scan ýok</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.dashboard.brigade}</th>
                      <th>{t.dashboard.workers}</th>
                      <th>{t.dashboard.presentToday}</th>
                      <th>{t.dashboard.attendance}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brigadeRows.map(b => {
                      const rate = b.total > 0 ? Math.round((b.present / b.total) * 100) : 0
                      return (
                        <tr key={b.name}>
                          <td className="fw-600">{b.name}</td>
                          <td className="td-muted">{b.total}</td>
                          <td>{b.present}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{
                                  width: `${rate}%`, height: '100%',
                                  background: rate >= 90 ? 'var(--success)' : rate >= 70 ? 'var(--warning)' : 'var(--danger)',
                                  borderRadius: 99,
                                }} />
                              </div>
                              <span className="text-xs text-muted">{rate}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-header"><h3>{t.dashboard.recentActivity}</h3></div>
          <div className="activity-list">
            {auditLogs.length === 0 ? (
              <div style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                Hereket ýok
              </div>
            ) : auditLogs.slice(0, 12).map(log => {
              const entity = entityLabels[log.entityType] ?? log.entityType
              const action = actionLabels[log.action] ?? log.action
              const name = log.after?.name ?? log.before?.name ?? ''
              const time = new Date(log.changedAt).toLocaleString('tr-TR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              })
              return (
                <div key={log.id} className="activity-item">
                  <span className="activity-time">{time}</span>
                  <div className="activity-dot" style={{
                    background: log.action === 'DELETE' ? 'var(--danger)' : log.action === 'CREATE' ? 'var(--success)' : 'var(--info)',
                  }} />
                  <span className="activity-text">
                    {entity} {name ? `"${name}" ` : ''}{action} — {log.changedBy}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
