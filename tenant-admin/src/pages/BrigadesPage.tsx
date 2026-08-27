import { Fragment, useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Edit2, Trash2, X, Upload, ChevronDown, ChevronRight,
  User, UserCheck, AlertCircle, Search,
} from 'lucide-react'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { useTranslation } from '../i18n/useTranslation'
import { foremansApi, type ForemanApi } from '../api/foremans'
import { AppModal } from '../components/ui/AppModal'
import { workersApi, type WorkerApi } from '../api/workers'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Err({ msg }: { msg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--danger-light)', borderRadius: 6, color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>
      <AlertCircle size={13} /> {msg}
    </div>
  )
}

function ConfirmModal({ msg, onConfirm, onClose }: { msg: string; onConfirm: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <AppModal
      title={t.foreman.confirmTitle}
      onClose={onClose}
      maxWidth={340}
      footer={
        <>
          <button className="btn btn--secondary btn--sm" onClick={onClose}>{t.common.no}</button>
          <button className="btn btn--primary btn--sm" style={{ background: 'var(--danger)' }} onClick={() => { onConfirm(); onClose(); }}>{t.common.yes}</button>
        </>
      }
    >
      <p style={{ fontSize: 14 }}>{msg}</p>
    </AppModal>
  )
}

// ─── Foreman Modal ─────────────────────────────────────────────────────────────
function ForemanModal({ initial, onClose, onSave }: {
  initial?: ForemanApi | null
  onClose: () => void
  onSave: (data: { name: string; phone: string; workerId: string }) => Promise<void>
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [mode, setMode] = useState<'manual' | 'worker'>('manual')
  const [workerId, setWorkerId] = useState(initial?.workerId ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const { data: workers = [] } = useQuery({ queryKey: ['workers'], queryFn: () => workersApi.list(), staleTime: 60_000 })

  const handleWorkerPick = (id: string) => {
    const w = workers.find(w => w.id === id)
    if (w) { setName(w.name); setPhone(w.phone ?? ''); setWorkerId(w.id) }
    else { setWorkerId('') }
  }

  const handleSave = async () => {
    if (!name.trim()) { setErr(t.common.name + ' ' + t.common.error); return }
    setSaving(true); setErr('')
    try { await onSave({ name: name.trim(), phone, workerId }); onClose() }
    catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <AppModal
      title={initial ? t.foreman.edit : t.foreman.new}
      onClose={onClose}
      maxWidth={440}
      footer={
        <>
          <button className="btn btn--secondary btn--sm" onClick={onClose}>{t.common.cancel}</button>
          <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving}>
            {saving ? t.common.saving : t.common.save}
          </button>
        </>
      }
    >
      {err && <Err msg={err} />}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['manual', 'worker'] as const).map(m => (
          <button key={m} className={`btn btn--sm ${mode === m ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setMode(m)}>
            {m === 'manual' ? t.foreman.manualEntry : t.foreman.fromWorkers}
          </button>
        ))}
      </div>
      {mode === 'worker' && (
        <div className="form-row">
          <label className="form-label">{t.foreman.selectWorker}</label>
          <select onChange={e => handleWorkerPick(e.target.value)} defaultValue="">
            <option value="">— {t.foreman.selectWorker} —</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.workerId})</option>)}
          </select>
        </div>
      )}
      <div className="form-row">
        <label className="form-label">{t.foreman.name} *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={t.foreman.namePlaceholder} />
      </div>
      <div className="form-row">
        <label className="form-label">{t.foreman.phone}</label>
        <input value={phone ?? ''} onChange={e => setPhone(e.target.value)} placeholder="+993 65 000000" />
      </div>
    </AppModal>
  )
}

// ─── Assign Worker Modal ───────────────────────────────────────────────────────
function AssignWorkerModal({ foreman, onClose, onDone, adminName }: {
  foreman: ForemanApi
  onClose: () => void
  onDone: () => void
  adminName: string
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const { data: detail } = useQuery({
    queryKey: ['foreman', foreman.id],
    queryFn: () => foremansApi.getById(foreman.id),
    staleTime: 10_000,
  })
  const { data: allWorkers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: () => workersApi.list(),
    staleTime: 60_000,
  })

  const assignedIds = new Set((detail?.workers ?? []).map(w => w.id))

  const filtered = allWorkers.filter(w => {
    if (!search) return true
    const q = search.toLowerCase()
    return w.name.toLowerCase().includes(q) || w.workerId.toLowerCase().includes(q)
  })

  const handleAssign = async (w: WorkerApi) => {
    setLoading(true); setErr('')
    try { await foremansApi.assignWorker(foreman.id, w.id, adminName); onDone() }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const handleUnassign = async (wId: string) => {
    setLoading(true); setErr('')
    try { await foremansApi.unassignWorker(foreman.id, wId, adminName); onDone() }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <AppModal
      title={<>{t.foreman.assignTitle} — {foreman.name}</>}
      onClose={onClose}
      maxWidth={560}
      footer={<button className="btn btn--secondary btn--sm" onClick={onClose}>{t.common.close}</button>}
    >
      {err && <Err msg={err} />}

      {(detail?.workers?.length ?? 0) > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="text-xs text-muted fw-600" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            {t.foreman.assignedSection} ({detail!.workers.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
            {detail!.workers.map(w => (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6 }}>
                <User size={13} color="#10B981" />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{w.name}</span>
                <span className="td-muted" style={{ fontSize: 11 }}>{w.workerId} · {w.profession}</span>
                <span className={`badge badge--dot ${w.mesaiSistemi === 'Aylık' ? 'badge--info' : 'badge--success'}`} style={{ fontSize: 10 }}>{(w.mesaiSistemi ?? 'Saatlik') === 'Aylık' ? t.workers.mesaiMonthly : t.workers.mesaiHourly}</span>
                <button className="btn btn--ghost btn--sm" style={{ color: 'var(--danger)', padding: '2px 6px' }} disabled={loading}
                  onClick={() => handleUnassign(w.id)} title={t.common.delete}><X size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs text-muted fw-600" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t.foreman.addWorkerSection}</div>
        <div className="input-wrap" style={{ marginBottom: 8 }}>
          <Search size={13} />
          <input className="search-input" placeholder={t.foreman.workerSearchPlaceholder} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 260, overflowY: 'auto' }}>
          {filtered.map(w => {
            const isAssignedHere = assignedIds.has(w.id)
            const isAssignedElsewhere = w.foremanId && w.foremanId !== foreman.id
            return (
              <div key={w.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                background: isAssignedHere ? 'rgba(16,185,129,0.06)' : isAssignedElsewhere ? 'var(--bg-surface-2)' : undefined,
                border: `1px solid ${isAssignedHere ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
                borderRadius: 6, opacity: isAssignedElsewhere ? 0.5 : 1,
              }}>
                <User size={13} color={isAssignedHere ? '#10B981' : 'var(--text-muted)'} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: isAssignedHere ? 600 : 400 }}>{w.name}</span>
                <span className="td-muted" style={{ fontSize: 11 }}>{w.workerId} · {w.profession}</span>
                <span className={`badge badge--dot ${(w.mesaiSistemi ?? 'Saatlik') === 'Aylık' ? 'badge--info' : 'badge--success'}`} style={{ fontSize: 10 }}>{(w.mesaiSistemi ?? 'Saatlik') === 'Aylık' ? t.workers.mesaiMonthly : t.workers.mesaiHourly}</span>
                {isAssignedHere ? (
                  <span style={{ fontSize: 11, color: '#10B981' }}>{t.foreman.assignedLabel}</span>
                ) : isAssignedElsewhere ? (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.foreman.otherForemanLabel}</span>
                ) : (
                  <button className="btn btn--primary btn--sm" style={{ padding: '2px 10px', fontSize: 12 }}
                    disabled={loading} onClick={() => handleAssign(w)}>+ {t.common.add}</button>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && <div className="empty-state" style={{ padding: 16 }}>{t.common.noData}</div>}
        </div>
      </div>
    </AppModal>
  )
}

// ─── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({ onClose, onUpload }: {
  onClose: () => void
  onUpload: (file: File) => Promise<{ imported: number }>
}) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number } | null>(null)
  const [err, setErr] = useState('')

  const handleUpload = async () => {
    if (!file) return
    setLoading(true); setErr('')
    try { const r = await onUpload(file); setResult(r) }
    catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <AppModal
      title={t.foreman.importTitle}
      onClose={onClose}
      maxWidth={400}
      footer={
        <>
          <button className="btn btn--secondary btn--sm" onClick={onClose}>{result ? t.common.close : t.common.cancel}</button>
          {!result && <button className="btn btn--primary btn--sm" onClick={handleUpload} disabled={!file || loading}>{loading ? t.common.uploading : <><Upload size={13} /> {t.common.import}</>}</button>}
        </>
      }
    >
      {!result ? (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            {t.foreman.importDesc}
          </p>
          {err && <Err msg={err} />}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
          <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, background: file ? 'var(--success-light)' : undefined }}>
            {file ? <span style={{ color: 'var(--success)' }}>✓ {file.name}</span> : <span><Upload size={20} style={{ display: 'block', margin: '0 auto 6px' }} />{t.foreman.uploadFile}</span>}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <p style={{ fontWeight: 600 }}>{result.imported} {t.foreman.importSuccess}</p>
        </div>
      )}
    </AppModal>
  )
}

// ─── Foreman Expanded Workers Row ─────────────────────────────────────────────
function ForemanWorkers({ foremanId, adminName, onChanged }: {
  foremanId: string
  adminName: string
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const { data: detail, isLoading } = useQuery({
    queryKey: ['foreman', foremanId],
    queryFn: () => foremansApi.getById(foremanId),
    staleTime: 15_000,
  })

  const handleUnassign = async (workerId: string) => {
    await foremansApi.unassignWorker(foremanId, workerId, adminName)
    onChanged()
  }

  return (
    <tr>
      <td />
      <td colSpan={4} style={{ padding: '0 0 12px 24px' }}>
        {isLoading ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>{t.common.loading}</div>
        ) : (detail?.workers?.length ?? 0) === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>{t.foreman.noWorkersAssigned}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
            {detail!.workers.map(w => (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: 'var(--bg-surface-2)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <User size={12} color="var(--text-muted)" />
                <span className="fw-600" style={{ flex: 1, fontSize: 13 }}>{w.name}</span>
                <span className="td-muted" style={{ fontSize: 11 }}>{w.workerId} · {w.profession}</span>
                <span className={`badge badge--dot ${w.mesaiSistemi === 'Aylık' ? 'badge--info' : 'badge--success'}`} style={{ fontSize: 10 }}>{(w.mesaiSistemi ?? 'Saatlik') === 'Aylık' ? t.workers.mesaiMonthly : t.workers.mesaiHourly}</span>
                <button className="btn btn--ghost btn--sm" style={{ color: 'var(--danger)', padding: '2px 6px' }}
                  onClick={() => handleUnassign(w.id)} title={t.common.delete}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function BrigadesPage() {
  const { t } = useTranslation()
  const { user } = useUiPreferences()
  const adminName = user?.name ?? 'Admin'
  const qc = useQueryClient()

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['foremans'] })
  }
  const invForeman = (id: string) => {
    inv()
    qc.invalidateQueries({ queryKey: ['foreman', id] })
  }

  const { data: foremans = [], isLoading } = useQuery({
    queryKey: ['foremans'],
    queryFn: foremansApi.list,
    refetchInterval: 60_000,
  })

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<ForemanApi | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [assignWorkersFor, setAssignWorkersFor] = useState<ForemanApi | null>(null)
  const [showImport, setShowImport] = useState(false)

  const toggle = (id: string) => setExpanded(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s
  })

  return (
    <>
      <div className="page-header">
        <h1>{t.foreman.title}</h1>
        <div className="page-actions">
          <button className="btn btn--secondary btn--sm" onClick={() => setShowImport(true)}>
            <Upload size={13} /> {t.common.import}
          </button>
          <button className="btn btn--primary btn--sm" onClick={() => setShowAdd(true)}>
            <Plus size={13} /> {t.foreman.new}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="empty-state">{t.common.loading}</div>
      ) : foremans.length === 0 ? (
        <div className="empty-state"><UserCheck size={32} /><p>{t.foreman.noForemen}</p></div>
      ) : (
        <div className="card">
          <div className="card-body card-body--p0">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: 32 }} />
                  <th>{t.foreman.name}</th>
                  <th>{t.foreman.phone}</th>
                  <th>{t.foreman.workers}</th>
                  <th>{t.foreman.actions}</th>
                </tr>
              </thead>
              <tbody>
                {foremans.map(f => (
                  <Fragment key={f.id}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => toggle(f.id)}>
                      <td style={{ padding: '10px 8px 10px 14px' }}>
                        {expanded.has(f.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="fw-600">{f.name}</td>
                      <td className="td-muted">{f.phone || '—'}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#6366F1' }}>{f.workerCount} {t.foreman.workerCount}</span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="td-actions">
                          <button className="btn btn--ghost btn--sm" title={t.foreman.assignTitle} onClick={() => setAssignWorkersFor(f)}>
                            <User size={13} />
                          </button>
                          <button className="btn btn--ghost btn--sm" title={t.common.edit} onClick={() => setEditItem(f)}>
                            <Edit2 size={13} />
                          </button>
                          <button className="btn btn--ghost btn--sm" style={{ color: 'var(--danger)' }} title={t.common.delete} onClick={() => setDeleteId(f.id)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded.has(f.id) && (
                      <ForemanWorkers
                        foremanId={f.id}
                        adminName={adminName}
                        onChanged={() => invForeman(f.id)}
                      />
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {assignWorkersFor && (
        <AssignWorkerModal
          foreman={assignWorkersFor}
          adminName={adminName}
          onClose={() => setAssignWorkersFor(null)}
          onDone={() => invForeman(assignWorkersFor.id)}
        />
      )}

      {showAdd && (
        <ForemanModal
          onClose={() => setShowAdd(false)}
          onSave={async d => { await foremansApi.create(d, adminName); inv() }}
        />
      )}
      {editItem && (
        <ForemanModal
          initial={editItem}
          onClose={() => setEditItem(null)}
          onSave={async d => { await foremansApi.update(editItem.id, d, adminName); inv() }}
        />
      )}
      {deleteId && (
        <ConfirmModal
          msg={t.foreman.deleteConfirm}
          onConfirm={async () => { await foremansApi.remove(deleteId, adminName); inv() }}
          onClose={() => setDeleteId(null)}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onUpload={async f => { const r = await foremansApi.importExcel(f, adminName); inv(); return r }}
        />
      )}
    </>
  )
}
