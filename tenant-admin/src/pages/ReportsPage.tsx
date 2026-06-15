import { useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { useTranslation } from '../i18n/useTranslation'
import { WORKERS, ATTENDANCE } from '../data/mockData'

type ReportType = 'daily' | 'brigade' | 'absent' | 'overtime' | 'monthly' | 'payroll' | 'qr' | 'conflict'

const today = new Date().toISOString().split('T')[0]
const lastMonth = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

function getPreviewData(type: ReportType) {
  if (type === 'daily') return ATTENDANCE.slice(0, 8).map(a => ({
    worker: a.workerName, brigade: a.brigadeName, status: a.status, time: a.scanTime ?? '—'
  }))
  if (type === 'payroll') return WORKERS.slice(0, 8).map(w => ({
    worker: w.name, workerId: w.workerId, profession: w.profession, hours: Math.floor(Math.random() * 40 + 160)
  }))
  return []
}

export function ReportsPage() {
  const { t } = useTranslation()
  const [selectedType, setSelectedType] = useState<ReportType>('daily')
  const [dateFrom, setDateFrom] = useState(lastMonth)
  const [dateTo, setDateTo] = useState(today)

  const types: Array<{ key: ReportType; name: string; desc: string; icon: React.ReactNode }> = [
    { key: 'daily', name: t.reports.daily, desc: t.reports.dailyDesc, icon: <FileText size={14} /> },
    { key: 'brigade', name: t.reports.brigade, desc: t.reports.brigadeDesc, icon: <FileSpreadsheet size={14} /> },
    { key: 'absent', name: t.reports.absent, desc: t.reports.absentDesc, icon: <FileText size={14} /> },
    { key: 'overtime', name: t.reports.overtime, desc: t.reports.overtimeDesc, icon: <FileSpreadsheet size={14} /> },
    { key: 'monthly', name: t.reports.monthly, desc: t.reports.monthlyDesc, icon: <FileSpreadsheet size={14} /> },
    { key: 'payroll', name: t.reports.payroll, desc: t.reports.payrollDesc, icon: <FileSpreadsheet size={14} /> },
    { key: 'qr', name: t.reports.qr, desc: t.reports.qrDesc, icon: <FileText size={14} /> },
    { key: 'conflict', name: t.reports.conflict, desc: t.reports.conflictDesc, icon: <FileText size={14} /> },
  ]

  const previewData = getPreviewData(selectedType)

  return (
    <>
      <div className="page-header">
        <h1>{t.reports.title}</h1>
        <div className="page-actions">
          <button className="btn btn--secondary btn--sm"><Download size={13} />{t.reports.exportExcel}</button>
          <button className="btn btn--secondary btn--sm"><Download size={13} />{t.reports.exportPdf}</button>
        </div>
      </div>

      <div className="reports-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="card">
            <div className="card-body" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                <div className="form-row">
                  <label className="form-label">{t.reports.dateRange}</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ flex: 1 }} />
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>
              </div>
              <button className="btn btn--primary w-full" style={{ justifyContent: 'center' }}>
                <FileSpreadsheet size={14} />{t.reports.generateReport}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {types.map(type => (
              <button
                key={type.key}
                className={`report-type-btn${selectedType === type.key ? ' active' : ''}`}
                onClick={() => setSelectedType(type.key)}
              >
                <span className="rt-name">{type.name}</span>
                <span className="rt-desc">{type.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>{t.reports.preview}</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn--secondary btn--sm"><Download size={12} />{t.reports.exportExcel}</button>
              <button className="btn btn--ghost btn--sm"><Download size={12} />{t.reports.exportPdf}</button>
            </div>
          </div>
          <div className="card-body card-body--p0">
            {previewData.length === 0 ? (
              <div className="empty-state"><FileSpreadsheet size={36} /><p>{t.reports.noPreview}</p></div>
            ) : selectedType === 'daily' ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>{t.reports.worker}</th><th>Brigade</th><th>{t.reports.status}</th><th>Time</th></tr></thead>
                  <tbody>
                    {(previewData as Array<{ worker: string; brigade: string; status: string; time: string }>).map((row, i) => (
                      <tr key={i}>
                        <td className="fw-600">{row.worker}</td>
                        <td className="td-muted">{row.brigade}</td>
                        <td>
                          <span className={`badge badge--dot badge--${row.status === 'Present' ? 'success' : row.status === 'Late' ? 'warning' : row.status === 'Medical' || row.status === 'Vacation' ? 'info' : 'neutral'}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="td-muted">{row.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>ID</th><th>{t.reports.worker}</th><th>Profession</th><th>{t.reports.hours}</th></tr></thead>
                  <tbody>
                    {(previewData as Array<{ worker: string; workerId: string; profession: string; hours: number }>).map((row, i) => (
                      <tr key={i}>
                        <td className="td-mono">{row.workerId}</td>
                        <td className="fw-600">{row.worker}</td>
                        <td className="td-muted">{row.profession}</td>
                        <td><span className="fw-600">{row.hours}h</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
