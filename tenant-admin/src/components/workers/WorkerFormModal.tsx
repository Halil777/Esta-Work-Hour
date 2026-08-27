import { useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import type { WorkerStatus } from '../../types/tenant'
import { workersApi, type MobileRole, type WorkerApi } from '../../api/workers'
import { useTranslation } from '../../i18n/useTranslation'
import { MESAI_SISTEMLERI, MOBILE_ROLES, WORKER_STATUSES } from '../../domain/workerMeta'
import { todayIso } from '../../utils/dateTime'
import { AppModal } from '../ui/AppModal'

export type WorkerShift = 'day' | 'night' | ''

export type WorkerForm = {
  name: string
  workerId: string
  profession: string
  brigadeId: string
  brigadeName: string
  zoneId: string
  zoneName: string
  status: WorkerStatus
  phone: string
  hireDate: string
  mesaiSistemi: string
  mobileRole: MobileRole
  shift: WorkerShift
  isStaff: boolean
}

const emptyForm: WorkerForm = {
  name: '',
  workerId: '',
  profession: '',
  brigadeId: '',
  brigadeName: '',
  zoneId: '',
  zoneName: '',
  status: 'Active',
  phone: '',
  hireDate: todayIso(),
  mesaiSistemi: 'Saatlik',
  mobileRole: 'worker',
  shift: '',
  isStaff: false,
}

type WorkerFormModalProps = {
  initial?: WorkerApi | null
  onClose: () => void
  onSave: (form: WorkerForm) => Promise<void>
}

export function WorkerFormModal({ initial, onClose, onSave }: WorkerFormModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<WorkerForm>(
    initial ? {
      name: initial.name,
      workerId: initial.workerId,
      profession: initial.profession,
      brigadeId: initial.brigadeId,
      brigadeName: initial.brigadeName,
      zoneId: initial.zoneId,
      zoneName: initial.zoneName,
      status: initial.status,
      phone: initial.phone ?? '',
      hireDate: initial.hireDate ?? '',
      mesaiSistemi: initial.mesaiSistemi ?? 'Saatlik',
      mobileRole: (initial.mobileRole ?? 'worker') as MobileRole,
      shift: (initial.shift ?? '') as WorkerShift,
      isStaff: initial.isStaff ?? false,
    } : emptyForm,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial?.photoUrl ?? null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const set = (key: keyof WorkerForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(previous => ({ ...previous, [key]: event.target.value }))

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !initial) return

    setPhotoUploading(true)
    try {
      const result = await workersApi.uploadPhoto(initial.id, file)
      setPhotoUrl(result.photoUrl)
    } catch {
      // Photo upload is optional; keep the form usable if the upload fails.
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError(t.workers.requiredName)
      return
    }

    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : t.common.error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal
      title={initial ? t.workers.editWorkerTitle : t.workers.addWorkerTitle}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--secondary btn--sm" type="button" onClick={onClose}>{t.common.cancel}</button>
          <button className="btn btn--primary btn--sm" type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? t.common.loading : initial ? t.common.save : t.workers.addWorker}
          </button>
        </>
      }
    >
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--danger-light)', borderRadius: 6, marginBottom: 10, color: 'var(--danger)', fontSize: 13 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}
      {initial && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            overflow: 'hidden',
            background: 'var(--border)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-muted)',
          }}>
            {photoUrl
              ? <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (initial.name.trim().slice(0, 1).toUpperCase() || 'I')
            }
          </div>
          <div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
            <button
              className="btn btn--secondary btn--sm"
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              style={{ fontSize: 12 }}
            >
              {photoUploading ? t.workers.photoUploading : t.workers.photoUpload}
            </button>
            {photoUrl && (
              <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>{t.workers.photoExists}</div>
            )}
          </div>
        </div>
      )}
      <div className="form-grid">
        <div className="form-row">
          <label className="form-label">{t.workers.name} *</label>
          <input value={form.name} onChange={set('name')} placeholder="ASHYROV BAYMYRAT" />
        </div>
        <div className="form-row">
          <label className="form-label">{t.workers.regNo}</label>
          <input
            value={form.workerId}
            onChange={set('workerId')}
            placeholder="0007064428"
            disabled={!!initial}
            style={initial ? { opacity: 0.5 } : {}}
          />
        </div>
      </div>
      <div className="form-grid">
        <div className="form-row">
          <label className="form-label">{t.workers.profession}</label>
          <input value={form.profession} onChange={set('profession')} placeholder="BORU MONTAJ ISCISI" />
        </div>
        <div className="form-row">
          <label className="form-label">{t.workers.team}</label>
          <input value={form.brigadeName} onChange={set('brigadeName')} placeholder="ALTYAPI EKIBI" />
        </div>
      </div>
      <div className="form-grid">
        <div className="form-row">
          <label className="form-label">{t.workers.overtimeSystem}</label>
          <select value={form.mesaiSistemi} onChange={set('mesaiSistemi')}>
            {MESAI_SISTEMLERI.map(value => <option key={value} value={value}>{value === 'Aylık' ? t.workers.mesaiMonthly : t.workers.mesaiHourly}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">{t.workers.status}</label>
          <select value={form.status} onChange={event => setForm(previous => ({ ...previous, status: event.target.value as WorkerStatus }))}>
            {WORKER_STATUSES.map(status => {
              const statusLabel: Record<string, string> = {
                Active: t.common.active,
                Inactive: t.workers.statusInactive,
                Suspended: t.workers.statusSuspended,
                Transferred: t.workers.statusTransferred,
                Terminated: t.workers.statusTerminated,
              }
              return <option key={status} value={status}>{statusLabel[status] ?? status}</option>
            })}
          </select>
        </div>
      </div>
      <div className="form-grid">
        <div className="form-row">
          <label className="form-label">{t.workers.mobileRole}</label>
          <select value={form.mobileRole} onChange={event => setForm(previous => ({ ...previous, mobileRole: event.target.value as MobileRole }))}>
            {MOBILE_ROLES.map(role => {
              const roleLabel: Record<string, string> = {
                worker: t.workers.roleWorker,
                foreman: t.workers.roleForeman,
                site_chief: t.workers.roleSiteChief,
                section_chief: t.workers.roleSectionChief,
              }
              return <option key={role} value={role}>{roleLabel[role] ?? role}</option>
            })}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">{t.workers.shift}</label>
          <select value={form.shift} onChange={set('shift')}>
            <option value="">{t.workers.shiftNone}</option>
            <option value="day">{t.workers.dayShift}</option>
            <option value="night">{t.workers.nightShift}</option>
          </select>
        </div>
      </div>
      <div className="form-grid">
        <div className="form-row">
          <label className="form-label">{t.workers.phone}</label>
          <input value={form.phone} onChange={set('phone')} placeholder="+993 65 000000" />
        </div>
        <div className="form-row">
          <label className="form-label">{t.workers.hireDate}</label>
          <input type="date" value={form.hireDate} onChange={set('hireDate')} />
        </div>
      </div>
      <div className="form-row">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={form.isStaff}
            onChange={event => setForm(previous => ({ ...previous, isStaff: event.target.checked }))}
            style={{ width: 15, height: 15 }}
          />
          {t.workers.staffLabel}
        </label>
      </div>
    </AppModal>
  )
}
