import { useState, useMemo, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Smartphone, Plus, Trash2, RefreshCw, Eye, Copy, Pencil, Wifi, WifiOff, X, Users, ScanLine,
  History, ChevronDown, ChevronUp, Calendar,
} from 'lucide-react'
import { scannerDevicesApi, type ScannerDevice, type OperatorScanLogRow } from '../api/scannerDevices'
import { apiFetch } from '../api/http'
import type { WorkerApi } from '../api/workers'

function formatLastSeen(ts: string | null) {
  if (!ts) return 'Hiç görülmedi'
  const d = new Date(ts)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'Az öň'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min öň`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} sagat öň`
  return d.toLocaleDateString(undefined, { timeZone: 'Europe/Moscow' })
}

// A device is nominally "active" but might actually be offline/frozen — the
// heartbeat/sync loop pings every ~2 min in foreground and WorkManager backs
// it up every 15 min, so no signal for 20+ min means something's wrong even
// though isActive is still true.
const STALE_THRESHOLD_MS = 20 * 60_000

function isStale(lastSeenAt: string | null) {
  if (!lastSeenAt) return true
  return Date.now() - new Date(lastSeenAt).getTime() > STALE_THRESHOLD_MS
}

function batteryColor(level: number | null) {
  if (level === null) return 'var(--text-muted)'
  if (level <= 15) return 'var(--danger)'
  if (level <= 35) return 'var(--warning)'
  return 'var(--text-muted)'
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

// ─── Small dashboard stat card ────────────────────────────────────────────────

function StatCard({
  icon, label, value, accent, accentLight,
}: {
  icon: ReactNode; label: string; value: ReactNode; accent: string; accentLight: string;
}) {
  return (
    <div className="card">
      <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 11, flexShrink: 0,
          background: accentLight,
          border: `1px solid ${accent}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.15, color: 'var(--text-primary)' }}>{value}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Operator Scan Log tab ─────────────────────────────────────────────────────
// "Which operator scanned which workers on which days" — grouped by date,
// then by device/operator within the date, with a per-worker breakdown that
// expands on demand. Lets an admin audit a disputed day, or spot an operator
// who isn't scanning their whole crew.

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoStr(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function fmtLogTime(ms: number): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' })
}

function OperatorLogTab({ workers }: { workers: WorkerApi[] }) {
  const [startDate, setStartDate] = useState(daysAgoStr(6))
  const [endDate, setEndDate] = useState(todayStr())
  const [deviceFilter, setDeviceFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data: log = [], isLoading } = useQuery({
    queryKey: ['scanner-devices-operator-log', startDate, endDate],
    queryFn: () => scannerDevicesApi.getOperatorLog(startDate, endDate),
  })

  const workerNameById = useMemo(() => new Map(workers.map(w => [w.workerId, w.name])), [workers])

  const deviceOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of log) map.set(r.deviceId, r.operatorName ? `${r.deviceLabel} (${r.operatorName})` : r.deviceLabel)
    return [...map.entries()]
  }, [log])

  const filtered = deviceFilter === 'all' ? log : log.filter(r => r.deviceId === deviceFilter)

  // date -> deviceId -> rows
  const grouped = useMemo(() => {
    const byDate = new Map<string, Map<string, OperatorScanLogRow[]>>()
    for (const r of filtered) {
      const byDevice = byDate.get(r.date) ?? new Map<string, OperatorScanLogRow[]>()
      const arr = byDevice.get(r.deviceId) ?? []
      arr.push(r)
      byDevice.set(r.deviceId, arr)
      byDate.set(r.date, byDevice)
    }
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div>
      {/* Filters */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20,
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16,
      }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Başlangyç sene</label>
          <input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Soňky sene</label>
          <input type="date" value={endDate} min={startDate} max={todayStr()} onChange={e => setEndDate(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Enjam / Operator</label>
          <select value={deviceFilter} onChange={e => setDeviceFilter(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, minWidth: 200 }}>
            <option value="all">Ähli enjamlar</option>
            {deviceOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { label: 'Şu gün', s: todayStr(), e: todayStr() },
            { label: 'Soňky 7 gün', s: daysAgoStr(6), e: todayStr() },
            { label: 'Soňky 30 gün', s: daysAgoStr(29), e: todayStr() },
          ].map(p => (
            <button key={p.label} onClick={() => { setStartDate(p.s); setEndDate(p.e) }}
              className="btn btn-ghost" style={{ fontSize: 12 }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="card"><div className="card-body">Ýüklenýär...</div></div>
      ) : grouped.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <History size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ margin: 0 }}>Bu aralykda scan tapylmady.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {grouped.map(([date, byDevice]) => (
            <div key={date}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                <Calendar size={15} color="var(--accent)" /> {date}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...byDevice.entries()].map(([deviceId, rows]) => {
                  const key = `${date}:${deviceId}`
                  const isOpen = expanded.has(key)
                  const totalScans = rows.reduce((s, r) => s + r.scanCount, 0)
                  const label = rows[0].operatorName ? `${rows[0].deviceLabel} (${rows[0].operatorName})` : rows[0].deviceLabel
                  return (
                    <div key={key} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                      <div
                        onClick={() => toggleExpand(key)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 16px', cursor: 'pointer', background: 'var(--bg-elevated)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Smartphone size={14} color="var(--primary)" />
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {rows.length} işçi · {totalScans} scan
                          </span>
                        </div>
                        {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </div>
                      {isOpen && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ borderTop: '1px solid var(--border)' }}>
                              <th style={{ padding: '7px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>Işçi</th>
                              <th style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>Scan sany</th>
                              <th style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>Ilkinji</th>
                              <th style={{ padding: '7px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>Soňky</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows
                              .slice()
                              .sort((a, b) => (workerNameById.get(a.workerId) ?? a.workerId).localeCompare(workerNameById.get(b.workerId) ?? b.workerId))
                              .map(r => (
                                <tr key={r.workerId} style={{ borderTop: '1px solid var(--border)' }}>
                                  <td style={{ padding: '7px 16px' }}>
                                    <div style={{ fontWeight: 600 }}>{workerNameById.get(r.workerId) ?? r.workerId}</div>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.workerId}</div>
                                  </td>
                                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>{r.scanCount}</td>
                                  <td style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>{fmtLogTime(r.firstScan)}</td>
                                  <td style={{ padding: '7px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>{fmtLogTime(r.lastScan)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ScannerDevicesPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'devices' | 'log'>('devices')
  const [showCreate, setShowCreate] = useState(false)
  const [editDevice, setEditDevice] = useState<ScannerDevice | null>(null)
  const [tokenModal, setTokenModal] = useState<ScannerDevice | null>(null)
  const [regenConfirm, setRegenConfirm] = useState<string | null>(null)

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['scanner-devices'],
    queryFn: scannerDevicesApi.getAll,
    staleTime: 30_000,
  })

  // Small per-page dashboard (device health + who's scanned how many
  // workers) — refetched a bit faster than the device list itself so the
  // "şu gün" numbers stay reasonably live while an admin has this page open.
  const { data: scanSummary } = useQuery({
    queryKey: ['scanner-devices-scan-summary'],
    queryFn: scannerDevicesApi.getScanSummary,
    staleTime: 15_000,
    refetchInterval: 30_000,
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
        {activeTab === 'devices' && (
          <button
            className="btn btn--primary btn--sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowCreate(true)}
          >
            <Plus size={14} /> Täze enjam
          </button>
        )}
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8, marginBottom: 16 }}>
        Her fiziki NFC scanner enjamy üçin aýratyn token. Operatör — şol enjamy ulanýan işçi.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {([
          { key: 'devices' as const, icon: Smartphone, label: 'Enjamlar' },
          { key: 'log' as const, icon: History, label: 'Operator Žurnaly' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', border: 'none', cursor: 'pointer',
              background: 'none', fontSize: 13, fontWeight: 600,
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'log' && <OperatorLogTab workers={workers as WorkerApi[]} />}

      {activeTab === 'devices' && (
      <>
      {/* Small dashboard: overall device health + how many workers have been
          scanned in, tenant-wide (deduped across every device) — for keeping
          both the workforce and the operators under control at a glance. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard
          icon={<Smartphone size={19} color="var(--primary)" />}
          accent="var(--primary)"
          accentLight="var(--primary-light)"
          value={`${devices.filter(d => d.isActive).length}/${devices.length}`}
          label="Işjeň enjam"
        />
        <StatCard
          icon={<Users size={19} color="var(--info)" />}
          accent="var(--info)"
          accentLight="var(--info-light)"
          value={scanSummary ? scanSummary.totalWorkersEverScanned : '—'}
          label="Jemi scan edilen işçi"
        />
        <StatCard
          icon={<ScanLine size={19} color="var(--success)" />}
          accent="var(--success)"
          accentLight="var(--success-light)"
          value={scanSummary ? scanSummary.todayWorkersScanned : '—'}
          label="Şu gün scan edilen işçi"
        />
      </div>

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
          {devices.map(device => {
            const stale = device.isActive && isStale(device.lastSeenAt)
            return (
            <div key={device.id} className="card" style={{ opacity: device.isActive ? 1 : 0.55 }}>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px' }}>

                {/* Status icon */}
                <div
                  title={stale ? 'Enjamdan 20 minutdan bäri signal ýok' : undefined}
                  style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: !device.isActive ? 'var(--bg)' : stale ? 'rgba(255,193,7,0.12)' : 'var(--primary-light)',
                    border: `1px solid ${!device.isActive ? 'var(--border)' : stale ? 'var(--warning)' : 'var(--primary)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  {!device.isActive
                    ? <WifiOff size={18} color="var(--text-muted)" />
                    : stale
                      ? <WifiOff size={18} color="var(--warning)" />
                      : <Wifi size={18} color="var(--primary)" />
                  }
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {device.label}
                    {stale && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--warning)' }}>⚠ signal ýok</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {device.location && <span>📍 {device.location}</span>}
                    {device.operatorName
                      ? <span>👤 {device.operatorName}</span>
                      : <span style={{ color: 'var(--warning)' }}>⚠ Operatör bellenilmedi</span>
                    }
                    <span style={{ fontFamily: 'monospace' }}>🔑 {device.tokenPrefix}...</span>
                    <span>🕐 {formatLastSeen(device.lastSeenAt)}</span>
                    {device.batteryLevel !== null && (
                      <span style={{ color: batteryColor(device.batteryLevel) }}>🔋 {device.batteryLevel}%</span>
                    )}
                    {device.appVersion && <span>📱 v{device.appVersion}</span>}
                    {!!device.pendingEventCount && (
                      <span style={{ color: device.pendingEventCount > 20 ? 'var(--danger)' : 'var(--warning)' }}>
                        📦 {device.pendingEventCount} synchronizasiýa garaşýar
                      </span>
                    )}
                  </div>

                  {/* Bu enjamyň (operatoryň) scan statistikasy — iscileri hem
                      operatory hem gözegçilikde saklamak üçin. */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontWeight: 600, color: 'var(--info)',
                      background: 'var(--info-light)', borderRadius: 99,
                      padding: '3px 10px',
                    }}>
                      <Users size={11} /> Jemi: {device.totalWorkersScanned} işçi ({device.totalScans} scan)
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontWeight: 600, color: 'var(--success)',
                      background: 'var(--success-light)', borderRadius: 99,
                      padding: '3px 10px',
                    }}>
                      <ScanLine size={11} /> Şu gün: {device.todayWorkersScanned} işçi ({device.todayScans} scan)
                    </span>
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
            )
          })}
        </div>
      )}
      </>
      )}
    </>
  )
}
