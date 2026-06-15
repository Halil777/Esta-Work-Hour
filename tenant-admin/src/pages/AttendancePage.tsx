import { useState } from 'react'
import { Search, AlertCircle, LogIn, LogOut } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { workersApi, type WorkerApi } from '../api/workers'

const fmtTime = (ts: number | null | undefined) => {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

const fmtHours = (ms: number | null | undefined) => {
  if (!ms || ms <= 0) return null
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} sag`
  return `${h} sag ${m} min`
}

type ScanStatus = 'present' | 'absent'

function getWorkerStatus(w: WorkerApi): ScanStatus {
  return w.lastCheckIn ? 'present' : 'absent'
}

export function AttendancePage() {
  const { t } = useTranslation()
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ScanStatus | 'all'>('all')

  const { data: workers = [], isLoading, error } = useQuery({
    queryKey: ['workers-attendance', date],
    queryFn: () => workersApi.list({ startDate: date, endDate: date }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const filtered = workers.filter(w => {
    const matchSearch = !search || w.name.toLowerCase().includes(search.toLowerCase()) || w.workerId.includes(search)
    const wStatus = getWorkerStatus(w)
    const matchStatus = statusFilter === 'all' || wStatus === statusFilter
    return matchSearch && matchStatus
  })

  const presentCount = workers.filter(w => w.lastCheckIn).length
  const absentCount = workers.filter(w => !w.lastCheckIn).length

  return (
    <>
      <div className="page-header">
        <h1>{t.attendance.title}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        {[
          { label: 'Işde bar', value: presentCount, color: 'var(--success)', bg: 'var(--success-light)' },
          { label: 'Ýok', value: absentCount, color: 'var(--danger)', bg: 'var(--danger-light)' },
          { label: 'Jemi işçi', value: workers.length, color: 'var(--primary-text)', bg: 'var(--primary-light)' },
        ].map(item => (
          <div key={item.label} className="stat-card">
            <div className="stat-card__value" style={{ color: item.color }}>{item.value}</div>
            <div className="stat-card__label">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="filters-bar">
            <input type="date" className="date-input" value={date} onChange={e => setDate(e.target.value)} />
            <div className="input-wrap">
              <Search size={14} />
              <input className="search-input" placeholder={t.common.search + '...'} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as ScanStatus | 'all')}>
              <option value="all">{t.common.all}</option>
              <option value="present">Işde bar</option>
              <option value="absent">Ýok</option>
            </select>
          </div>
          <span className="text-xs text-muted">{filtered.length} işçi</span>
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
                  <th>Sicil No</th>
                  <th>{t.attendance.worker}</th>
                  <th>Görev</th>
                  <th>Ekip</th>
                  <th style={{ color: '#10B981' }}>↑ Giriş</th>
                  <th style={{ color: '#F59E0B' }}>↓ Çykyş</th>
                  <th>Işlän saat</th>
                  <th>{t.attendance.status}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8}><div className="empty-state"><p>{t.common.loading}</p></div></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><Search size={32} /><p>{t.common.noData}</p></div></td></tr>
                ) : filtered.map(w => {
                  const present = !!w.lastCheckIn
                  return (
                    <tr key={w.id}>
                      <td className="td-mono">{w.workerId}</td>
                      <td className="fw-600">{w.name}</td>
                      <td className="td-muted" style={{ fontSize: 12 }}>{w.profession || '—'}</td>
                      <td className="td-muted" style={{ fontSize: 12 }}>{w.brigadeName || '—'}</td>
                      <td>
                        {w.lastCheckIn ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#10B981', fontSize: 12 }}>
                            <LogIn size={11} /> {fmtTime(w.lastCheckIn)}
                          </span>
                        ) : <span className="td-muted">—</span>}
                      </td>
                      <td>
                        {w.lastCheckOut ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#F59E0B', fontSize: 12 }}>
                            <LogOut size={11} /> {fmtTime(w.lastCheckOut)}
                          </span>
                        ) : <span className="td-muted">—</span>}
                      </td>
                      <td>
                        {fmtHours(w.todayHoursMs) ? (
                          <span style={{ fontWeight: 600, color: '#6366F1', fontSize: 13 }}>{fmtHours(w.todayHoursMs)}</span>
                        ) : <span className="td-muted">—</span>}
                      </td>
                      <td>
                        <span className={`badge badge--dot badge--${present ? 'success' : 'danger'}`}>
                          {present ? 'Işde bar' : 'Ýok'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
