import { useState } from 'react'
import { Search, Download, Upload, ArrowRightLeft, Ban } from 'lucide-react'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { getTranslation } from '../i18n/translations'
import { workforceRows } from '../data/mock-data'
import type { WorkforceRow } from '../types/admin'

type StatusVariant = 'success' | 'warning' | 'danger' | 'info'

function statusMeta(s: WorkforceRow['status'], t: ReturnType<typeof getTranslation>): { label: string; variant: StatusVariant } {
  const map: Record<WorkforceRow['status'], { label: string; variant: StatusVariant }> = {
    Active: { label: t.workforce.active, variant: 'success' },
    Transferred: { label: t.workforce.transferred, variant: 'info' },
    Suspended: { label: t.workforce.suspended, variant: 'warning' },
    Blocked: { label: t.workforce.blocked, variant: 'danger' },
  }
  return map[s] ?? { label: s, variant: 'info' }
}

const OBJECTS = [...new Set(workforceRows.map(w => w.object))]
const STATUSES: WorkforceRow['status'][] = ['Active', 'Transferred', 'Suspended', 'Blocked']

export function WorkforcePage() {
  const { language } = useUiPreferences()
  const t = getTranslation(language)
  const [search, setSearch] = useState('')
  const [objectFilter, setObjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<WorkforceRow['status'] | 'all'>('all')

  const filtered = workforceRows.filter(w => {
    const matchSearch = w.name.toLowerCase().includes(search.toLowerCase()) || w.workerId.toLowerCase().includes(search.toLowerCase())
    const matchObject = objectFilter === 'all' || w.object === objectFilter
    const matchStatus = statusFilter === 'all' || w.status === statusFilter
    return matchSearch && matchObject && matchStatus
  })

  return (
    <>
      <div className="page-header">
        <h1>{t.workforce.title}</h1>
        <div className="page-actions">
          <button className="btn btn--secondary btn--sm"><Upload size={13} />{t.common.import}</button>
          <button className="btn btn--secondary btn--sm"><Download size={13} />{t.common.export}</button>
          <button className="btn btn--primary btn--sm"><ArrowRightLeft size={13} />{t.workforce.transfer}</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="filters-bar">
            <div className="input-wrap">
              <Search size={14} />
              <input className="search-input" placeholder={t.workforce.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={objectFilter} onChange={e => setObjectFilter(e.target.value)}>
              <option value="all">{t.workforce.filterAll}</option>
              {OBJECTS.map(o => <option key={o}>{o}</option>)}
            </select>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as WorkforceRow['status'] | 'all')}>
              <option value="all">{t.common.all}</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <span className="text-xs text-muted">{filtered.length} {t.workforce.totalCount}</span>
        </div>
        <div className="card-body card-body--p0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.workforce.workerId}</th>
                  <th>{t.workforce.name}</th>
                  <th>{t.workforce.profession}</th>
                  <th>{t.workforce.object}</th>
                  <th>{t.workforce.brigade}</th>
                  <th>{t.workforce.status}</th>
                  <th>{t.workforce.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7}>
                    <div className="empty-state"><Search size={32} /><p>{t.common.noData}</p></div>
                  </td></tr>
                ) : filtered.map(w => {
                  const sm = statusMeta(w.status, t)
                  return (
                    <tr key={w.workerId}>
                      <td className="td-mono">{w.workerId}</td>
                      <td className="fw-600">{w.name}</td>
                      <td className="td-muted">{w.profession}</td>
                      <td className="td-muted">{w.object}</td>
                      <td>
                        <span className="badge badge--neutral">{w.brigade}</span>
                      </td>
                      <td><span className={`badge badge--dot badge--${sm.variant}`}>{sm.label}</span></td>
                      <td>
                        <div className="td-actions">
                          <button className="btn btn--ghost btn--sm" title={t.workforce.transfer}><ArrowRightLeft size={12} /></button>
                          {w.status === 'Active' && (
                            <button className="btn btn--ghost btn--sm" title={t.workforce.block}><Ban size={12} /></button>
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
    </>
  )
}
