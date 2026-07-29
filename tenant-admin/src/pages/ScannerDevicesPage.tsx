import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Smartphone, Plus, Trash2, RefreshCw, Eye, Copy, Pencil, Wifi, WifiOff, X } from 'lucide-react'
import { scannerDevicesApi, type ScannerDevice } from '../api/scannerDevices'
import { apiFetch } from '../api/http'
import type { WorkerApi } from '../api/workers'

function formatLastSeen(ts: string | null) {
  if (!ts) return 'Hiç görülmedi'
  const d = new Date(ts)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'Az öň'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min öň`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} sagat öň`
  return d.toLocaleDateString()
}

// ─── Token reveal modal ───────────────────────────────────────────────────────

function TokenModal({ deviceId, label, onClose }: { deviceId: string; label: string; onClose: () => void }) {
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  async function reveal() {
    setLoading(true)
    try {
      const res = await scannerDevicesApi.getToken(deviceId)
      setToken(res.token)
    } finally {
      setLoading(false)
    }
  }

  function copy() {
    if (!token) return
    navigator.clipboard.writeText(token).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 24, width: 480, maxWidth: '95vw',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>{label} — Token</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, marginTop: 0 }}>
          Bu tokeni Android programmasynyň setup ekranyna giriziň.
        </p>
        {!token ? (
          <button className="btn btn--primary btn--sm" onClick={reveal} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Eye size={13} /> {loading ? 'Ýüklenýär...' : 'Tokeni görkez'}
          </button>
        ) : (
          <div>
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 12px', fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all',
              marginBottom: 12, letterSpacing: 1,
            }}>{token}</div>
            <button className="btn btn--sm btn--secondary" onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Copy size={13} /> {copied ? '✓ Kopirlendy' : 'Kopirle'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Create / Edit modal ──────────────────────────────────────────────────────

function DeviceModal({
  device, workers, onClose,
}: {
  device?: ScannerDevice;
  workers: WorkerApi[];
  onClose: () => void;
}) {
  const qc = useQueryClient()
  const [label, setLabel] = useState(device?.label ?? '')
  const [location, setLocation] = useState(device?.location ?? '')
  const [workerEntityId, setWorkerEntityId] = useState(device?.workerEntityId ?? '')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const isEdit = !!device

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        return scannerDevicesApi.update(device.id, {
          label: label.trim(),
          location: location.trim() || null,
          workerEntityId: workerEntityId || null,
        })
      } else {
        const res = await scannerDevicesApi.create({
          label: label.trim(),
          location: location.trim() || null,
          workerEntityId: workerEntityId || null,
        })
        setNewToken((res as any).token)
        return res
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scanner-devices'] })
    },
  })

  function copyToken() {
    if (!newToken) return
    navigator.clipboard.writeText(newToken).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={() => { if (!newToken) onClose() }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 24, width: 480, maxWidth: '95vw',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>{isEdit ? 'Enjamy üýtget' : 'Täze enjam'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>

        {newToken ? (
          <div>
            <p style={{ fontSize: 13, color: 'var(--success)', marginBottom: 12 }}>
              ✓ Enjam döredildi! Aşakdaky tokeni Android programmasynyň setup ekranyna giriziň:
            </p>
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', marginBottom: 12,
            }}>{newToken}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn--sm btn--secondary" onClick={copyToken} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Copy size={13} /> {copied ? '✓ Kopirlendy' : 'Kopirle'}
              </button>
              <button className="btn btn--sm btn--primary" onClick={onClose}>Ýap</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-row">
              <label className="form-label">Enjam ady *</label>
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="1-nji Giriş Derwezesi" />
            </div>
            <div className="form-row">
              <label className="form-label">Ýerleşýän ýeri</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Demirgazyk giriş" />
            </div>
            <div className="form-row">
              <label className="form-label">Operatör (bu enjamy ulanýan işçi)</label>
              <select value={workerEntityId} onChange={e => setWorkerEntityId(e.target.value)}>
                <option value="">— saýlaň —</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.workerId})</option>
                ))}
              </select>
            </div>

            {saveMutation.isError && (
              <div style={{ fontSize: 12, color: 'var(--danger)' }}>
                {(saveMutation.error as Error).message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn btn--sm btn--secondary" onClick={onClose}>Ýap</button>
              <button
                className="btn btn--sm btn--primary"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !label.trim()}
              >
                {saveMutation.isPending ? 'Saklanýar...' : isEdit ? 'Sakla' : 'Döret'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ScannerDevicesPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editDevice, setEditDevice] = useState<ScannerDevice | null>(null)
  const [tokenModal, setTokenModal] = useState<ScannerDevice | null>(null)
  const [regenConfirm, setRegenConfirm] = useState<string | null>(null)

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['scanner-devices'],
    queryFn: scannerDevicesApi.getAll,
    staleTime: 30_000,
  })

  const { data: workers = [] } = useQuery<WorkerApi[]>({
    queryKey: ['workers-all'],
    queryFn: () => apiFetch('/workers?status=Active'),
    staleTime: 60_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scannerDevicesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scanner-devices'] }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      scannerDevicesApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scanner-devices'] }),
  })

  const regenMutation = useMutation({
    mutationFn: (id: string) => scannerDevicesApi.regenerateToken(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scanner-devices'] })
      setRegenConfirm(null)
    },
  })

  return (
    <>
      {showCreate && (
        <DeviceModal workers={workers as WorkerApi[]} onClose={() => setShowCreate(false)} />
      )}
      {editDevice && (
        <DeviceModal device={editDevice} workers={workers as WorkerApi[]} onClose={() => setEditDevice(null)} />
      )}
      {tokenModal && (
        <TokenModal deviceId={tokenModal.id} label={tokenModal.label} onClose={() => setTokenModal(null)} />
      )}

      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Smartphone size={20} /> NFC Enjamlar
        </h1>
        <button
          className="btn btn--primary btn--sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setShowCreate(true)}
        >
          <Plus size={14} /> Täze enjam
        </button>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8, marginBottom: 20 }}>
        Her fiziki NFC scanner enjamy üçin aýratyn token. Operatör — şol enjamy ulanýan işçi.
      </p>

      {isLoading ? (
        <div className="card"><div className="card-body">Ýüklenýär...</div></div>
      ) : devices.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <Smartphone size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ margin: 0 }}>Enjamlaryň ýok. Täze enjam döret.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {devices.map(device => (
            <div key={device.id} className="card" style={{ opacity: device.isActive ? 1 : 0.55 }}>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px' }}>

                {/* Status icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: device.isActive ? 'var(--primary-light)' : 'var(--bg)',
                  border: `1px solid ${device.isActive ? 'var(--primary)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {device.isActive
                    ? <Wifi size={18} color="var(--primary)" />
                    : <WifiOff size={18} color="var(--text-muted)" />
                  }
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{device.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {device.location && <span>📍 {device.location}</span>}
                    {device.operatorName
                      ? <span>👤 {device.operatorName}</span>
                      : <span style={{ color: 'var(--warning)' }}>⚠ Operatör bellenilmedi</span>
                    }
                    <span style={{ fontFamily: 'monospace' }}>🔑 {device.tokenPrefix}...</span>
                    <span>🕐 {formatLastSeen(device.lastSeenAt)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn btn--sm btn--secondary"
                    onClick={() => setTokenModal(device)}
                    title="Tokeni görkez"
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Eye size={13} />
                  </button>

                  <button
                    className="btn btn--sm btn--secondary"
                    onClick={() => setEditDevice(device)}
                    title="Üýtget"
                  >
                    <Pencil size={13} />
                  </button>

                  <button
                    className="btn btn--sm"
                    style={{ background: 'var(--warning)', color: '#000', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setRegenConfirm(device.id)}
                    title="Token täzele"
                  >
                    <RefreshCw size={13} />
                  </button>

                  <button
                    className="btn btn--sm btn--secondary"
                    onClick={() => toggleMutation.mutate({ id: device.id, isActive: !device.isActive })}
                    title={device.isActive ? 'Öçür' : 'Işjet'}
                  >
                    {device.isActive ? <WifiOff size={13} /> : <Wifi size={13} />}
                  </button>

                  <button
                    className="btn btn--sm"
                    style={{ background: 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => {
                      if (window.confirm(`"${device.label}" enjamyny pozmak isleýärsiňizmi?`)) {
                        deleteMutation.mutate(device.id)
                      }
                    }}
                    title="Poz"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Regenerate confirm bar */}
              {regenConfirm === device.id && (
                <div style={{
                  borderTop: '1px solid var(--border)', padding: '10px 18px',
                  background: 'var(--warning-light, rgba(255,193,7,0.1))',
                  display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
                }}>
                  <span style={{ flex: 1 }}>⚠ Token täzeden döredilende, bu enjam täze token bilen täzeden sazlanmaly. Dowam etmeli?</span>
                  <button
                    className="btn btn--sm"
                    style={{ background: 'var(--warning)', color: '#000' }}
                    onClick={() => regenMutation.mutate(device.id)}
                    disabled={regenMutation.isPending}
                  >
                    {regenMutation.isPending ? '...' : 'Hawa, täzele'}
                  </button>
                  <button className="btn btn--sm btn--secondary" onClick={() => setRegenConfirm(null)}>Ýok</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
