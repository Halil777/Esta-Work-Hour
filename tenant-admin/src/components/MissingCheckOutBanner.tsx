import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LogOut, X, ChevronDown, ChevronUp } from 'lucide-react'
import { anomaliesApi } from '../api/anomaliesApi'
import { useTranslation } from '../i18n/useTranslation'

export function MissingCheckOutBanner() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const { data } = useQuery({
    queryKey: ['anomalies-missing-checkout'],
    queryFn: () => anomaliesApi.getMissingCheckOut(),
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60_000,
  })

  if (!data || data.count === 0 || dismissed) return null

  const fmtTime = (ms: number) =>
    ms ? new Date(ms).toLocaleTimeString([], { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div style={{
      background: 'linear-gradient(90deg, #fef2f2, #fff5f5)',
      border: '1px solid #ef4444',
      borderLeft: '4px solid #ef4444',
      borderRadius: 8,
      margin: '0 0 16px 0',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
      }}>
        <LogOut size={16} style={{ color: '#dc2626', flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700, color: '#991b1b', fontSize: 13 }}>
            {t.anomaly.missingCheckoutBannerText.replace('{{n}}', String(data.count))}
          </span>
          <span style={{ color: '#b91c1c', fontSize: 12, marginLeft: 8 }}>
            {t.anomaly.missingCheckoutBannerSub}
          </span>
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid #ef4444',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: '#991b1b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
          }}
        >
          {t.anomaly.viewList}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#b91c1c',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
          title={t.anomaly.dismiss}
        >
          <X size={14} />
        </button>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #fecaca', padding: '0 14px 12px' }}>
          <div style={{
            marginTop: 10,
            maxHeight: 240,
            overflowY: 'auto',
            borderRadius: 6,
            border: '1px solid #fecaca',
            background: '#fff5f5',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#fef2f2' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', color: '#991b1b', fontWeight: 600 }}>
                    {t.anomaly.colWorker}
                  </th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', color: '#991b1b', fontWeight: 600 }}>
                    {t.anomaly.colTeam}
                  </th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', color: '#991b1b', fontWeight: 600 }}>
                    {t.anomaly.colCheckin}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.workers.map(w => (
                  <tr key={w.workerId} style={{ borderTop: '1px solid #fecaca' }}>
                    <td style={{ padding: '6px 10px', color: '#1e293b', fontWeight: 500 }}>{w.name}</td>
                    <td style={{ padding: '6px 10px', color: '#64748b' }}>{w.team || '—'}</td>
                    <td style={{ padding: '6px 10px', color: '#dc2626', fontWeight: 600 }}>
                      {fmtTime(w.checkInTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
