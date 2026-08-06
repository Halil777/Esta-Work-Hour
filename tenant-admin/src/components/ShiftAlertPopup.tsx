import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell, X, ChevronDown, ChevronUp } from 'lucide-react'
import { anomaliesApi } from '../api/anomaliesApi'
import { useTranslation } from '../i18n/useTranslation'

export function ShiftAlertPopup() {
  const { t } = useTranslation()
  const [dismissedDay, setDismissedDay] = useState(false)
  const [dismissedNight, setDismissedNight] = useState(false)
  const [expandedDay, setExpandedDay] = useState(false)
  const [expandedNight, setExpandedNight] = useState(false)

  const { data } = useQuery({
    queryKey: ['anomalies-shift-alerts'],
    queryFn: () => anomaliesApi.getShiftAlerts(),
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60_000,
  })

  if (!data) return null

  const showDay = data.day.graceExpired && data.day.workers.length > 0 && !dismissedDay
  const showNight = data.night.graceExpired && data.night.workers.length > 0 && !dismissedNight

  if (!showDay && !showNight) return null

  const WorkerList = ({ workers }: { workers: { workerId: string; name: string; team: string }[] }) => (
    <div style={{
      marginTop: 8,
      maxHeight: 180,
      overflowY: 'auto',
      borderRadius: 6,
      border: '1px solid rgba(99,102,241,0.2)',
      background: 'rgba(99,102,241,0.04)',
    }}>
      {workers.map(w => (
        <div key={w.workerId} style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '5px 10px',
          borderBottom: '1px solid rgba(99,102,241,0.1)',
          fontSize: 12,
        }}>
          <span style={{ color: '#1e293b', fontWeight: 500 }}>{w.name}</span>
          <span style={{ color: '#64748b', fontSize: 11 }}>{w.team || '—'}</span>
        </div>
      ))}
    </div>
  )

  const Alert = ({
    label,
    count,
    graceEndTime,
    workers,
    expanded,
    onToggle,
    onDismiss,
  }: {
    label: string
    count: number
    graceEndTime: string
    workers: { workerId: string; name: string; team: string }[]
    expanded: boolean
    onToggle: () => void
    onDismiss: () => void
  }) => (
    <div style={{
      background: '#fff',
      border: '1px solid #c7d2fe',
      borderLeft: '4px solid #6366f1',
      borderRadius: 8,
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
      }}>
        <Bell size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#3730a3' }}>{t.anomaly.shiftAlertTitle}</div>
          <div style={{ fontSize: 11, color: '#4f46e5', marginTop: 1 }}>
            {label.replace('{{n}}', String(count))}
          </div>
          <div style={{ fontSize: 10, color: '#818cf8', marginTop: 1 }}>
            {t.anomaly.graceEndedAt} {graceEndTime}
          </div>
        </div>
        <button
          onClick={onToggle}
          style={{
            background: 'rgba(99,102,241,0.1)',
            border: 'none',
            borderRadius: 4,
            padding: '3px 8px',
            fontSize: 11,
            color: '#4f46e5',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#818cf8', padding: 2 }}
        >
          <X size={13} />
        </button>
      </div>
      {expanded && (
        <div style={{ padding: '0 12px 10px' }}>
          <WorkerList workers={workers} />
        </div>
      )}
    </div>
  )

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      width: 300,
      zIndex: 1000,
    }}>
      {showDay && (
        <Alert
          label={t.anomaly.dayShiftMissing}
          count={data.day.workers.length}
          graceEndTime={data.day.graceEndTime}
          workers={data.day.workers}
          expanded={expandedDay}
          onToggle={() => setExpandedDay(e => !e)}
          onDismiss={() => setDismissedDay(true)}
        />
      )}
      {showNight && (
        <Alert
          label={t.anomaly.nightShiftMissing}
          count={data.night.workers.length}
          graceEndTime={data.night.graceEndTime}
          workers={data.night.workers}
          expanded={expandedNight}
          onToggle={() => setExpandedNight(e => !e)}
          onDismiss={() => setDismissedNight(true)}
        />
      )}
    </div>
  )
}
