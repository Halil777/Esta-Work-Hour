import { useState } from 'react'
import { AlertCircle, Clock3, Trash2 } from 'lucide-react'
import type { TerminateWorkerPayload, WorkerApi } from '../../api/workers'
import { todayIso } from '../../utils/dateTime'
import { useTranslation } from '../../i18n/useTranslation'
import { AppModal } from '../ui/AppModal'

type WorkerTerminationModalProps = {
  worker: WorkerApi
  onClose: () => void
  onSubmit: (payload: TerminateWorkerPayload) => Promise<void>
}

export function WorkerTerminationModal({ worker, onClose, onSubmit }: WorkerTerminationModalProps) {
  const { t } = useTranslation()
  const [terminationDate, setTerminationDate] = useState(todayIso())
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError(t.termination.reasonRequired)
      return
    }

    setSaving(true)
    setError('')
    try {
      await onSubmit({ terminationDate, reason: reason.trim(), note: note.trim() || undefined })
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : t.common.error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal
      title={t.termination.title}
      onClose={onClose}
      maxWidth={460}
      footer={
        <>
          <button className="btn btn--secondary btn--sm" type="button" onClick={onClose}>{t.common.cancel}</button>
          <button className="btn btn--primary btn--sm" type="button" style={{ background: 'var(--danger)' }} onClick={handleSubmit} disabled={saving}>
            <Trash2 size={13} /> {saving ? t.common.saving : t.termination.terminateBtn}
          </button>
        </>
      }
    >
      <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{worker.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {worker.workerId} · {worker.profession || '-'} · {worker.brigadeName || '-'}
        </div>
      </div>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--danger-light)', borderRadius: 6, marginBottom: 10, color: 'var(--danger)', fontSize: 13 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}
      <div className="form-grid">
        <div className="form-row">
          <label className="form-label">{t.termination.lastDayLabel}</label>
          <input type="date" value={terminationDate} onChange={event => setTerminationDate(event.target.value)} />
        </div>
        <div className="form-row">
          <label className="form-label">{t.termination.reasonLabel}</label>
          <select value={reason} onChange={event => setReason(event.target.value)}>
            <option value="">{t.common.all}</option>
            <option value={t.termination.reason1}>{t.termination.reason1}</option>
            <option value={t.termination.reason2}>{t.termination.reason2}</option>
            <option value={t.termination.reason3}>{t.termination.reason3}</option>
            <option value={t.termination.reason4}>{t.termination.reason4}</option>
            <option value={t.termination.reason5}>{t.termination.reason5}</option>
            <option value={t.termination.reason6}>{t.termination.reason6}</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <label className="form-label">{t.termination.noteLabel}</label>
        <input value={note} onChange={event => setNote(event.target.value)} placeholder={t.termination.notePlaceholder} />
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 8, background: 'var(--warning-light)', color: 'var(--warning)', fontSize: 12 }}>
        <Clock3 size={14} />
        <span>{t.termination.lifecycleNote}</span>
      </div>
    </AppModal>
  )
}
