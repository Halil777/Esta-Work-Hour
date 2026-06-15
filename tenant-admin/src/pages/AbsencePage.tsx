import { useState } from 'react'
import { Plus, FileCheck, FileX, Search } from 'lucide-react'
import { useTranslation } from '../i18n/useTranslation'
import { ABSENCES, ZONES } from '../data/mockData'

const REASON_KEYS = ['Sick Leave', 'Medical Point', 'Vacation', 'Business Trip', 'Unauthorized', 'No Information', 'Suspended', 'Custom']

const reasonVariant: Record<string, string> = {
  'Sick Leave': 'info',
  'Medical Point': 'info',
  'Vacation': 'primary',
  'Business Trip': 'primary',
  'Unauthorized': 'danger',
  'No Information': 'neutral',
  'Suspended': 'warning',
  'Custom': 'neutral',
}

const allBrigades = ZONES.flatMap(z => z.brigades)

export function AbsencePage() {
  const { t } = useTranslation()
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [search, setSearch] = useState('')
  const [reasonFilter, setReasonFilter] = useState('all')
  const [brigadeFilter, setBrigadeFilter] = useState('all')

  const filtered = ABSENCES.filter(a => {
    const matchDate = !date || a.date === date
    const matchSearch = a.workerName.toLowerCase().includes(search.toLowerCase())
    const matchReason = reasonFilter === 'all' || a.reason === reasonFilter
    const matchBrigade = brigadeFilter === 'all' || a.brigadeId === brigadeFilter
    return matchDate && matchSearch && matchReason && matchBrigade
  })

  return (
    <>
      <div className="page-header">
        <h1>{t.absence.title}</h1>
        <div className="page-actions">
          <button className="btn btn--primary btn--sm"><Plus size={13} />{t.absence.addRecord}</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="filters-bar">
            <input type="date" className="date-input" value={date} onChange={e => setDate(e.target.value)} />
            <div className="input-wrap">
              <Search size={14} />
              <input className="search-input" placeholder={t.common.search + '...'} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={brigadeFilter} onChange={e => setBrigadeFilter(e.target.value)}>
              <option value="all">{t.common.all}</option>
              {allBrigades.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select className="filter-select" value={reasonFilter} onChange={e => setReasonFilter(e.target.value)}>
              <option value="all">{t.absence.filterAll}</option>
              {REASON_KEYS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <span className="text-xs text-muted">{filtered.length} records</span>
        </div>
        <div className="card-body card-body--p0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.absence.worker}</th>
                  <th>{t.absence.brigade}</th>
                  <th>{t.absence.date}</th>
                  <th>{t.absence.reason}</th>
                  <th>{t.absence.document}</th>
                  <th>{t.absence.note}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6}>
                    <div className="empty-state"><Search size={32} /><p>{t.common.noData}</p></div>
                  </td></tr>
                ) : filtered.map(a => (
                  <tr key={a.id}>
                    <td className="fw-600">{a.workerName}</td>
                    <td className="td-muted">{a.brigadeName}</td>
                    <td className="td-muted">{a.date}</td>
                    <td>
                      <span className={`badge badge--${reasonVariant[a.reason] ?? 'neutral'}`}>{a.reason}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {a.hasDocument ? (
                          <><FileCheck size={14} color="var(--success)" /><span className="text-xs" style={{ color: 'var(--success)' }}>{t.absence.hasDoc}</span></>
                        ) : (
                          <><FileX size={14} color="var(--text-muted)" /><span className="text-xs text-muted">{t.absence.noDoc}</span></>
                        )}
                      </div>
                    </td>
                    <td className="td-muted text-sm">
                      <span className="truncate" style={{ display: 'block', maxWidth: 200 }}>{a.note || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
