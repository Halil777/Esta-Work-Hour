import { useState } from 'react'
import { Search, Download } from 'lucide-react'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { getTranslation } from '../i18n/translations'
import { auditRecords } from '../data/mock-data'

type Category = 'all' | 'export' | 'qr' | 'transfer' | 'attendance' | 'system' | 'import'

const categoryVariant: Record<string, string> = {
  export: 'info',
  qr: 'primary',
  transfer: 'warning',
  attendance: 'success',
  system: 'neutral',
  import: 'neutral',
}

export function AuditPage() {
  const { language } = useUiPreferences()
  const t = getTranslation(language)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category>('all')

  const filtered = auditRecords.filter(r => {
    const matchSearch = r.event.toLowerCase().includes(search.toLowerCase()) || r.actor.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'all' || r.category === category
    return matchSearch && matchCat
  })

  const categoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      export: t.audit.exportCat,
      qr: t.audit.qr,
      transfer: t.audit.transfer,
      attendance: t.audit.attendance,
      system: t.audit.system,
      import: t.audit.importCat,
    }
    return map[cat] ?? cat
  }

  const CATS: Category[] = ['all', 'export', 'qr', 'transfer', 'attendance', 'system', 'import']

  return (
    <>
      <div className="page-header">
        <h1>{t.audit.title}</h1>
        <div className="page-actions">
          <button className="btn btn--secondary btn--sm"><Download size={13} />{t.audit.export}</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="filters-bar" style={{ flex: 1 }}>
            <div className="input-wrap">
              <Search size={14} />
              <input
                className="search-input"
                placeholder={t.audit.searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {CATS.map(cat => (
                <button
                  key={cat}
                  className={`btn btn--sm ${category === cat ? 'btn--primary' : 'btn--ghost'}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat === 'all' ? t.audit.filterAll : categoryLabel(cat)}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-muted">{filtered.length} events</span>
        </div>
        <div className="card-body card-body--p0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>{t.audit.time}</th>
                  <th style={{ width: 120 }}>{t.audit.actor}</th>
                  <th>{t.audit.event}</th>
                  <th style={{ width: 110 }}>{t.audit.category}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4}>
                    <div className="empty-state"><Search size={32} /><p>{t.common.noData}</p></div>
                  </td></tr>
                ) : filtered.map((r, i) => (
                  <tr key={i}>
                    <td className="td-mono" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{r.time}</td>
                    <td className="fw-600" style={{ fontSize: 13 }}>{r.actor}</td>
                    <td className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r.event}</td>
                    <td>
                      <span className={`badge badge--${categoryVariant[r.category] ?? 'neutral'}`}>
                        {categoryLabel(r.category)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header"><h3>Risk Indicators</h3></div>
          <div className="card-body card-body--p0">
            {[
              { text: 'Export volume increased 18% week-over-week in Moscow region.', type: 'warning' },
              { text: '3 object admins requested after-hours conflict overrides.', type: 'warning' },
              { text: '1 regional account attempted access outside assigned scope.', type: 'danger' },
              { text: 'QR replacements crossed baseline on Volga Industrial.', type: 'info' },
              { text: 'Monthly payroll export cycle due in 3 days — 6 objects pending.', type: 'neutral' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 16px', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: `var(--${item.type})`, flexShrink: 0, marginTop: 4 }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Activity by Category</h3></div>
          <div className="card-body">
            {(['export', 'attendance', 'qr', 'transfer', 'system', 'import'] as const).map(cat => {
              const count = auditRecords.filter(r => r.category === cat).length
              const pct = Math.round((count / auditRecords.length) * 100)
              return (
                <div key={cat} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="text-sm">{categoryLabel(cat)}</span>
                    <span className="text-xs text-muted fw-600">{count} events</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
                    <div style={{
                      height: 4, borderRadius: 2,
                      width: `${pct}%`,
                      background: `var(--${categoryVariant[cat] ?? 'neutral'})`,
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
