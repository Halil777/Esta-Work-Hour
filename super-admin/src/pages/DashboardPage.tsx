import { Building2, Users, UserCheck, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { getTranslation } from '../i18n/translations'
import { statSummaries, attendanceTrend, regionSummaries, dashboardAlerts } from '../data/mock-data'

const statIcons = [Building2, Users, UserCheck, AlertTriangle]
const statColors = [
  { color: 'var(--primary-text)', bg: 'var(--primary-light)' },
  { color: 'var(--success)', bg: 'var(--success-light)' },
  { color: 'var(--success)', bg: 'var(--success-light)' },
  { color: 'var(--danger)', bg: 'var(--danger-light)' },
]

export function DashboardPage() {
  const { language, theme } = useUiPreferences()
  const t = getTranslation(language)

  return (
    <>
      <div className="page-header">
        <h1>{t.dashboard.title}</h1>
        <div className="page-actions">
          <button className="btn btn--secondary btn--sm">{t.common.export}</button>
          <button className="btn btn--primary btn--sm"><Building2 size={13} />{t.objects.createObject}</button>
        </div>
      </div>

      <div className="stats-grid">
        {statSummaries.map((stat, i) => {
          const Icon = statIcons[i]
          const col = statColors[i]
          return (
            <div key={stat.labelKey} className="stat-card">
              <div className="stat-card__header">
                <div className="stat-card__icon" style={{ background: col.bg }}>
                  <Icon size={16} color={col.color} />
                </div>
              </div>
              <div className="stat-card__value">{stat.value}</div>
              <div className="stat-card__label">{t.dashboard[stat.labelKey as keyof typeof t.dashboard] ?? stat.labelKey}</div>
              <div className="stat-card__sub">{stat.detail}</div>
            </div>
          )
        })}
      </div>

      <div className="dash-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header"><h3>{t.dashboard.attendanceTrend}</h3></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={attendanceTrend} barSize={14} barCategoryGap="30%">
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={42}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)' }}
                    cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                  />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="attendance" name={t.dashboard.present} fill="#6366F1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="overtime" name={t.dashboard.overtime} fill="#F59E0B" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>{t.dashboard.regionalControl}</h3></div>
            <div className="card-body card-body--p0">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.dashboard.region}</th>
                      <th>{t.dashboard.objects}</th>
                      <th>{t.dashboard.presentRate}</th>
                      <th>{t.dashboard.overtimeH}</th>
                      <th>{t.dashboard.conflictsCol}</th>
                      <th>{t.common.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionSummaries.map(r => (
                      <tr key={r.region}>
                        <td className="fw-600">{r.region}</td>
                        <td className="td-muted">{r.objects}</td>
                        <td>{r.presentRate}</td>
                        <td className="td-muted">{r.overtimeHours}</td>
                        <td>
                          <span className={`badge badge--${r.conflicts > 30 ? 'danger' : r.conflicts > 20 ? 'warning' : 'neutral'}`}>
                            {r.conflicts}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge--dot badge--${r.status === 'Healthy' ? 'success' : 'warning'}`}>
                            {r.status === 'Healthy' ? t.dashboard.healthy : t.dashboard.attention}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-header"><h3>{t.dashboard.actionQueue}</h3></div>
          <div className="alert-list">
            {dashboardAlerts.map((alert, i) => (
              <div key={i} className="alert-item">
                <div className="alert-dot" style={{
                  background: i === 0 ? 'var(--danger)' : i < 3 ? 'var(--warning)' : 'var(--info)'
                }} />
                <span className="alert-text">{alert}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
