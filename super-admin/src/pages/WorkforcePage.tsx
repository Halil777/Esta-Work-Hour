import { useEffect, useState } from 'react'
import { Search, RefreshCw, Users } from 'lucide-react'
import { superAdminApi, type SuperAdminWorker } from '../api/superAdminApi'

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  Active:      { label: 'Aktif',       color: 'var(--success)', bg: 'var(--success-light)' },
  Terminated:  { label: 'Çykarylan',   color: 'var(--danger)',  bg: 'var(--danger-light)'  },
  Inactive:    { label: 'Deaktif',     color: 'var(--neutral)', bg: 'var(--neutral-light)' },
  Suspended:   { label: 'Togtatylan',  color: 'var(--warning)', bg: 'var(--warning-light)' },
  Transferred: { label: 'Geçirilen',   color: 'var(--info)',    bg: 'var(--info-light)'    },
}

const SHIFT_LABEL: Record<string, string> = { day: 'Gündiz', night: 'Gije' }

export function WorkforcePage() {
  const [workers, setWorkers] = useState<SuperAdminWorker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [search, setSearch] = useState('')
  const [tenantFilter, setTenantFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const load = async () => {
    setLoading(true); setError('')
    try { setWorkers(await superAdminApi.workforce()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const tenants = [...new Set(workers.map(w => w.tenantName))].sort()
  const statuses = [...new Set(workers.map(w => w.status))]

  const filtered = workers.filter(w => {
    const q = search.toLowerCase()
    const matchSearch = !q || w.name.toLowerCase().includes(q) || w.workerId.toLowerCase().includes(q) || w.profession.toLowerCase().includes(q)
    const matchTenant = tenantFilter === 'all' || w.tenantName === tenantFilter
    const matchStatus = statusFilter === 'all' || w.status === statusFilter
    return matchSearch && matchTenant && matchStatus
  })

  const activeCount   = filtered.filter(w => w.status === 'Active').length
  const tenantCount   = new Set(filtered.map(w => w.tenantId)).size

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0 }}>İşçi Genel Sanawy</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {filtered.length} işçi · {tenantCount} tenant · {activeCount} aktif
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn--secondary btn--sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Täzele
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        {/* Filters */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              placeholder="Ady, Sicil No, Görev..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 7, paddingBottom: 7, fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text)', outline: 'none' }}
            />
          </div>
          <select
            value={tenantFilter} onChange={e => setTenantFilter(e.target.value)}
            style={{ fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text)' }}
          >
            <option value="all">Ähli tenantlar</option>
            {tenants.map(t => <option key={t}>{t}</option>)}
          </select>
          <select
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text)' }}
          >
            <option value="all">Ähli statuslar</option>
            {statuses.map(s => <option key={s} value={s}>{STATUS_BADGE[s]?.label ?? s}</option>)}
          </select>
        </div>

        {/* Table */}
        {loading && !workers.length ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, gap: 8, color: 'var(--text-muted)' }}>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Ýüklenýär…
          </div>
        ) : error ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: 'var(--danger)', gap: 8 }}>
            {error} <button className="btn btn--sm btn--secondary" onClick={load}>Retry</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-2)' }}>
                  {['#', 'Sicil No', 'Ad Soyad', 'Görev', 'Ekip', 'Shift', 'Tenant', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Users size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.3 }} />
                    Maglumat tapylmady
                  </td></tr>
                ) : filtered.map((w, i) => {
                  const sm = STATUS_BADGE[w.status] ?? { label: w.status, color: 'var(--text-muted)', bg: 'var(--bg-surface-2)' }
                  return (
                    <tr key={`${w.tenantId}-${w.workerId}`} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-hover)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11 }}>{i + 1}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{w.workerId}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{w.name}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{w.profession || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {w.brigadeName ? (
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: 'var(--neutral-light)', color: 'var(--text-secondary)' }}>
                            {w.brigadeName}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: w.shift === 'night' ? 'var(--primary-text)' : w.shift === 'day' ? 'var(--warning)' : 'var(--text-muted)' }}>
                        {SHIFT_LABEL[w.shift ?? ''] ?? '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: 'var(--primary-light)', color: 'var(--primary-text)', fontWeight: 600 }}>
                          {w.tenantName}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: sm.bg, color: sm.color }}>
                          {sm.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
