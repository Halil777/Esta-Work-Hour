import { Printer, Ban, Shield, CheckCircle, XCircle } from 'lucide-react'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { getTranslation } from '../i18n/translations'
import { qrMetrics, qrLifecycle } from '../data/mock-data'

const lifecycleColors: Record<string, string> = {
  Generated: 'var(--text-secondary)',
  Printed: 'var(--info)',
  Issued: 'var(--primary-text)',
  Active: 'var(--success)',
  Lost: 'var(--warning)',
  Replaced: 'var(--warning)',
  Blocked: 'var(--danger)',
}

export function QrControlPage() {
  const { language } = useUiPreferences()
  const t = getTranslation(language)

  const policies = [
    { key: t.qrControl.expirationPolicy, val: '90 days', status: 'enabled' },
    { key: t.qrControl.lossPolicy, val: 'Supervisor approval', status: 'enabled' },
    { key: t.qrControl.securityLevel, val: t.qrControl.high, status: 'high' },
    { key: t.qrControl.mfaRequired, val: t.qrControl.required, status: 'enabled' },
  ]

  return (
    <>
      <div className="page-header">
        <h1>{t.qrControl.title}</h1>
        <div className="page-actions">
          <button className="btn btn--danger btn--sm"><Ban size={13} />{t.qrControl.blockSelected}</button>
          <button className="btn btn--primary btn--sm"><Printer size={13} />{t.qrControl.batchPrint}</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>{t.qrControl.metrics}</h3></div>
        <div className="card-body">
          <div className="qr-metrics-grid">
            {qrMetrics.map(m => (
              <div key={m.label} className="qr-metric-card">
                <div className="qr-metric-card__val" style={{ color: m.color }}>{m.value}</div>
                <div className="qr-metric-card__lbl">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>{t.qrControl.lifecycle}</h3></div>
        <div className="card-body">
          <div className="qr-lifecycle">
            {qrLifecycle.map(step => (
              <div key={step.label} className="qr-lifecycle-step">
                <div className="qr-lifecycle-step__val" style={{ color: lifecycleColors[step.label] ?? 'var(--text)' }}>
                  {step.count.toLocaleString()}
                </div>
                <div className="qr-lifecycle-step__lbl">{step.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header"><h3>{t.qrControl.policies}</h3></div>
          <div className="card-body card-body--p0">
            {policies.map(p => (
              <div key={p.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 16px', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shield size={13} color={p.status === 'high' ? 'var(--danger)' : 'var(--success)'} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{p.key}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="fw-600 text-sm">{p.val}</span>
                  {p.status === 'enabled' || p.status === 'high' ? (
                    <CheckCircle size={13} color="var(--success)" />
                  ) : (
                    <XCircle size={13} color="var(--danger)" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Recent QR Events</h3></div>
          <div className="card-body card-body--p0">
            {[
              { time: '21:07', event: '4 QR cards blocked (lost)', type: 'danger' },
              { time: '18:30', event: 'Batch of 280 QR codes generated for Amur', type: 'info' },
              { time: '15:45', event: '12 replacement QRs issued at Northern Terminal', type: 'warning' },
              { time: '11:20', event: '48 new worker QR codes created on import', type: 'success' },
              { time: '09:00', event: 'QR expiration policy updated to 90 days', type: 'neutral' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 16px', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: `var(--${item.type})`, flexShrink: 0, marginTop: 4 }} />
                <div style={{ flex: 1 }}>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.event}</div>
                  <div className="text-xs text-muted">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
