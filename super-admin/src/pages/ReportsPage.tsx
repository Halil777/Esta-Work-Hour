import { useState } from 'react'
import { Download, FileText, FileSpreadsheet } from 'lucide-react'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { getTranslation } from '../i18n/translations'
import { reportItems } from '../data/mock-data'

const REPORT_TYPES = [
  { key: 'dailyAttendance', descKey: 'dailyDesc', icon: '📊' },
  { key: 'monthlyPayroll', descKey: 'monthlyDesc', icon: '💰' },
  { key: 'conflictPack', descKey: 'conflictDesc', icon: '⚠️' },
  { key: 'qrIssuance', descKey: 'qrDesc', icon: '📱' },
  { key: 'absentWorkers', descKey: 'absentDesc', icon: '🔴' },
  { key: 'overtime', descKey: 'overtimeDesc', icon: '⏱️' },
  { key: 'auditPack', descKey: 'auditDesc', icon: '🔒' },
  { key: 'regionalSummary', descKey: 'regionalDesc', icon: '🗺️' },
] as const

const previewRows = [
  { worker: 'Nurmuhammet Geldiyev', object: 'Northern Terminal', hours: '11.0', status: 'Present' },
  { worker: 'Aman Myradov', object: 'Volga Industrial', hours: '11.0', status: 'Present' },
  { worker: 'Begench Atayev', object: 'Baltic Logistics', hours: '0', status: 'Absent' },
  { worker: 'Meret Orazov', object: 'Northern Terminal', hours: '13.5', status: 'Overtime' },
  { worker: 'Aydogdy Jorayev', object: 'Amur Concrete', hours: '0', status: 'Blocked' },
]

export function ReportsPage() {
  const { language } = useUiPreferences()
  const t = getTranslation(language)
  const [selected, setSelected] = useState<string>('dailyAttendance')
  const [dateFrom, setDateFrom] = useState('2026-05-01')
  const [dateTo, setDateTo] = useState('2026-05-08')

  const rt = t.reports.reportTypes

  return (
    <>
      <div className="page-header">
        <h1>{t.reports.title}</h1>
        <div className="page-actions">
          <button className="btn btn--secondary btn--sm"><FileSpreadsheet size={13} />{t.reports.exportExcel}</button>
          <button className="btn btn--primary btn--sm"><Download size={13} />{t.reports.exportPdf}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <div className="card-header"><h3>{t.reports.generateReport}</h3></div>
          <div className="card-body card-body--p0">
            {REPORT_TYPES.map(rt2 => (
              <button
                key={rt2.key}
                onClick={() => setSelected(rt2.key)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  width: '100%', padding: '10px 14px',
                  background: selected === rt2.key ? 'var(--primary-light)' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>{rt2.icon}</span>
                <div>
                  <div className="text-sm fw-600" style={{ color: selected === rt2.key ? 'var(--primary)' : 'var(--text)' }}>
                    {rt[rt2.key]}
                  </div>
                  <div className="text-xs text-muted">{rt[rt2.descKey]}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <h3>{t.reports.dateRange}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text)' }}
                />
                <span className="text-xs text-muted">—</span>
                <input
                  type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text)' }}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>{t.reports.preview}</h3>
              <span className="text-xs text-muted">{rt[selected as keyof typeof rt]}</span>
            </div>
            <div className="card-body card-body--p0">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.reports.worker}</th>
                      <th>{t.reports.object}</th>
                      <th>{t.reports.hours}</th>
                      <th>{t.reports.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map(row => (
                      <tr key={row.worker}>
                        <td className="fw-600">{row.worker}</td>
                        <td className="td-muted">{row.object}</td>
                        <td className="td-mono">{row.hours}h</td>
                        <td>
                          <span className={`badge badge--${row.status === 'Present' ? 'success' : row.status === 'Overtime' ? 'warning' : row.status === 'Absent' ? 'neutral' : 'danger'}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>{t.common.actions}</h3></div>
            <div className="card-body card-body--p0">
              {reportItems.map(item => (
                <div key={item.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FileText size={13} color="var(--text-secondary)" />
                    <div>
                      <div className="text-sm fw-600">{item.name}</div>
                      <div className="text-xs text-muted">{t.reports.cadence}: {item.cadence} · {t.reports.owner}: {item.owner}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="badge badge--neutral">{item.format}</span>
                    <button className="btn btn--ghost btn--sm"><Download size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
