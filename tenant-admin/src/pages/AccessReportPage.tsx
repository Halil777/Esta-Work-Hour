import { useState } from 'react'
import { Search, Download } from 'lucide-react'
import { useTranslation } from '../i18n/useTranslation'
import { ACCESS_LOG } from '../data/mockData'

export function AccessReportPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')

  const filtered = ACCESS_LOG.filter(r => {
    const matchSearch =
      r.surname.toLowerCase().includes(search.toLowerCase()) ||
      r.firstName.toLowerCase().includes(search.toLowerCase()) ||
      r.tabNo.includes(search) ||
      r.dolznost.toLowerCase().includes(search.toLowerCase())
    const matchZone = zoneFilter === 'all' || r.zone === zoneFilter
    const matchDate = !dateFilter || r.date.startsWith(dateFilter)
    return matchSearch && matchZone && matchDate
  })

  return (
    <>
      <div className="page-header">
        <h1>{t.accessReport.title}</h1>
        <div className="page-actions">
          <button className="btn btn--secondary btn--sm">
            <Download size={13} />{t.reports.exportExcel}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="filters-bar">
            <div className="input-wrap">
              <Search size={14} />
              <input
                className="search-input"
                placeholder={`${t.common.search}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <input
              type="date"
              className="date-input"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
            />
            <select
              className="filter-select"
              value={zoneFilter}
              onChange={e => setZoneFilter(e.target.value)}
            >
              <option value="all">{t.accessReport.filterByZone}</option>
              <option value="OFIS">{t.accessReport.zoneOfis}</option>
              <option value="Неконтролируемая территория">{t.accessReport.zoneUncontrolled}</option>
            </select>
          </div>
          <span className="text-xs text-muted">{filtered.length} {t.accessReport.totalRecords}</span>
        </div>

        <div className="card-body card-body--p0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.accessReport.tabNo}</th>
                  <th>{t.accessReport.surname}</th>
                  <th>{t.accessReport.firstName}</th>
                  <th>{t.accessReport.dolznost}</th>
                  <th>{t.accessReport.date}</th>
                  <th>{t.accessReport.zone}</th>
                  <th>{t.accessReport.cardNo}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <Search size={32} />
                        <p>{t.common.noData}</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(r => (
                  <tr key={r.id}>
                    <td className="td-mono">{r.tabNo}</td>
                    <td className="fw-600">{r.surname}</td>
                    <td>{r.firstName}</td>
                    <td>
                      <span className="badge badge--neutral">{r.dolznost}</span>
                    </td>
                    <td className="td-muted">{r.date}</td>
                    <td>
                      <span className={`badge badge--dot badge--${r.zone === 'OFIS' ? 'success' : 'warning'}`}>
                        {r.zone === 'OFIS' ? t.accessReport.zoneOfis : t.accessReport.zoneUncontrolled}
                      </span>
                    </td>
                    <td className="td-mono td-muted" style={{ fontSize: 11 }}>{r.cardNo}</td>
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
