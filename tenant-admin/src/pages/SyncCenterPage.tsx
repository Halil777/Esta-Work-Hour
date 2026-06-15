import { useState } from 'react'
import { AlertTriangle, Clock, User, Calendar, CheckCircle, RefreshCw } from 'lucide-react'
import { useTranslation } from '../i18n/useTranslation'
import { CONFLICTS } from '../data/mockData'
import type { ConflictRecord, ConflictType } from '../types/tenant'

function conflictMeta(type: ConflictType, t: ReturnType<typeof useTranslation>['t']) {
  const map: Record<ConflictType, { label: string; color: string; bg: string }> = {
    DuplicateScan: { label: t.syncCenter.duplicateScan, color: 'var(--danger)', bg: 'var(--danger-light)' },
    WrongBrigade: { label: t.syncCenter.wrongBrigade, color: 'var(--warning)', bg: 'var(--warning-light)' },
    BlockedQR: { label: t.syncCenter.blockedQr, color: 'var(--danger)', bg: 'var(--danger-light)' },
    MultipleScan: { label: t.syncCenter.multipleScan, color: 'var(--warning)', bg: 'var(--warning-light)' },
    SuspiciousTimestamp: { label: t.syncCenter.suspiciousTimestamp, color: 'var(--info)', bg: 'var(--info-light)' },
  }
  return map[type]
}

function severityMeta(s: ConflictRecord['severity'], t: ReturnType<typeof useTranslation>['t']) {
  return {
    Low: { label: t.syncCenter.low, variant: 'neutral' },
    Medium: { label: t.syncCenter.medium, variant: 'warning' },
    High: { label: t.syncCenter.high, variant: 'danger' },
  }[s]
}

export function SyncCenterPage() {
  const { t } = useTranslation()
  const [conflicts, setConflicts] = useState(CONFLICTS)
  const [typeFilter, setTypeFilter] = useState<ConflictType | 'all'>('all')
  const [showResolved, setShowResolved] = useState(false)

  const filtered = conflicts.filter(c => {
    if (!showResolved && c.resolved) return false
    if (typeFilter !== 'all' && c.type !== typeFilter) return false
    return true
  })

  const pendingCount = conflicts.filter(c => !c.resolved).length

  const resolve = (id: string) => {
    setConflicts(prev => prev.map(c => c.id === id ? { ...c, resolved: true } : c))
  }

  const typeOptions: Array<{ key: ConflictType | 'all'; label: string }> = [
    { key: 'all', label: t.syncCenter.allTypes },
    { key: 'DuplicateScan', label: t.syncCenter.duplicateScan },
    { key: 'WrongBrigade', label: t.syncCenter.wrongBrigade },
    { key: 'BlockedQR', label: t.syncCenter.blockedQr },
    { key: 'MultipleScan', label: t.syncCenter.multipleScan },
    { key: 'SuspiciousTimestamp', label: t.syncCenter.suspiciousTimestamp },
  ]

  return (
    <>
      <div className="page-header">
        <h1>{t.syncCenter.title}</h1>
        {pendingCount > 0 && (
          <span className="badge badge--danger">{pendingCount} {t.syncCenter.conflicts}</span>
        )}
        <div className="page-actions">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--primary)' }} />
            {t.syncCenter.showResolved}
          </label>
        </div>
      </div>

      <div className="filters-bar">
        {typeOptions.map(opt => (
          <button
            key={opt.key}
            className={`btn btn--sm ${typeFilter === opt.key ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setTypeFilter(opt.key as ConflictType | 'all')}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="conflict-list">
        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <CheckCircle size={36} color="var(--success)" />
              <p style={{ color: 'var(--text-secondary)' }}>
                {showResolved ? t.common.noData : 'All conflicts resolved!'}
              </p>
            </div>
          </div>
        ) : filtered.map(c => {
          const cm = conflictMeta(c.type, t)
          const sm = severityMeta(c.severity, t)
          return (
            <div key={c.id} className={`conflict-card${c.resolved ? ' resolved' : ''}`}>
              <div className="conflict-icon" style={{ background: cm.bg }}>
                <AlertTriangle size={16} color={cm.color} />
              </div>
              <div className="conflict-body">
                <div className="conflict-top">
                  <span className="conflict-title">{cm.label}</span>
                  <span className={`badge badge--${sm.variant}`}>{sm.label}</span>
                  {c.resolved && <span className="badge badge--success"><CheckCircle size={10} /> {t.syncCenter.resolved}</span>}
                </div>
                {c.workerName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <User size={12} color="var(--text-muted)" />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{c.workerName}</span>
                  </div>
                )}
                <p className="conflict-details">{c.details}</p>
                <div className="conflict-meta">
                  <span><Calendar size={11} />{c.date}</span>
                  <span><Clock size={11} />{c.time}</span>
                  <span><RefreshCw size={11} />Mobile Sync</span>
                </div>
              </div>
              {!c.resolved && (
                <div className="conflict-actions">
                  <button className="btn btn--success btn--sm" onClick={() => resolve(c.id)}>
                    <CheckCircle size={12} />{t.common.resolve}
                  </button>
                  <button className="btn btn--ghost btn--sm" style={{ fontSize: 11 }} onClick={() => resolve(c.id)}>
                    {t.common.dismiss}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
