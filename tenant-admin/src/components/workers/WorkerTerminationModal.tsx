import { useState } from 'react'
import { AlertCircle, Clock3, Trash2, X } from 'lucide-react'
import type { TerminateWorkerPayload, WorkerApi } from '../../api/workers'
import { todayIso } from '../../utils/dateTime'

type WorkerTerminationModalProps = {
  worker: WorkerApi
  onClose: () => void
  onSubmit: (payload: TerminateWorkerPayload) => Promise<void>
}

export function WorkerTerminationModal({ worker, onClose, onSubmit }: WorkerTerminationModalProps) {
  const [terminationDate, setTerminationDate] = useState(todayIso())
  const [reason, setReason] = useState('Kontrakt tamamlandy')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Sebäp hökman')
      return
    }

    setSaving(true)
    setError('')
    try {
      await onSubmit({ terminationDate, reason: reason.trim(), note: note.trim() || undefined })
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ýalňyşlyk')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3>Işden çykarmak</h3>
          <button className="btn btn--ghost btn--sm" type="button" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
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
              <label className="form-label">Soňky iş güni</label>
              <input type="date" value={terminationDate} onChange={event => setTerminationDate(event.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">Sebäp</label>
              <select value={reason} onChange={event => setReason(event.target.value)}>
                <option>Kontrakt tamamlandy</option>
                <option>Obýekt tamamlandy</option>
                <option>Şahsy islegi boýunça</option>
                <option>Düzgün bozma</option>
                <option>Başga obýekte geçirildi</option>
                <option>Başga</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Bellik</label>
            <input value={note} onChange={event => setNote(event.target.value)} placeholder="Gerek bolsa goşmaça maglumat" />
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 8, background: 'var(--warning-light)', color: 'var(--warning)', fontSize: 12 }}>
            <Clock3 size={14} />
            <span>Excel report awtomatiki lifecycle nobatyna goşular.</span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn--secondary btn--sm" type="button" onClick={onClose}>Ýatyr</button>
          <button className="btn btn--primary btn--sm" type="button" style={{ background: 'var(--danger)' }} onClick={handleSubmit} disabled={saving}>
            <Trash2 size={13} /> {saving ? 'Saklanýar...' : 'Işden çykar'}
          </button>
        </div>
      </div>
    </div>
  )
}
