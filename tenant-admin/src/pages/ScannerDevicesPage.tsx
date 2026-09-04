import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Smartphone, Plus, Trash2, RefreshCw, Eye, Copy, Pencil, Wifi, WifiOff, X, Users, ScanLine,
  History, ChevronDown, ChevronUp, Calendar, MapPin, Search, Target,
} from 'lucide-react'
import { scannerDevicesApi, type ScannerDevice, type OperatorScanLogRow, type ScanLocationRow } from '../api/scannerDevices'
import { geofenceApi, type GeofenceZone, type GeofenceZoneInput } from '../api/geofence'
import { apiFetch } from '../api/http'
import type { WorkerApi } from '../api/workers'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTranslation } from '../i18n/useTranslation'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import type { Language } from '../types/tenant'

const DATE_LABEL_LOCALES: Record<Language, string> = { en: 'en-US', ru: 'ru-RU', tr: 'tr-TR' }

function formatLastSeen(ts: string | null, t: ReturnType<typeof useTranslation>['t'], locale: string) {
  if (!ts) return t.scannerDevices.neverSeen
  const d = new Date(ts)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return t.scannerDevices.justNow
  if (diff < 3_600_000) return t.scannerDevices.minutesAgoTemplate.replace('{{n}}', String(Math.floor(diff / 60_000)))
  if (diff < 86_400_000) return t.scannerDevices.hoursAgoTemplate.replace('{{n}}', String(Math.floor(diff / 3_600_000)))
  return d.toLocaleDateString(locale, { timeZone: 'Europe/Moscow' })
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
  const { t } = useTranslation()
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
          <h3 style={{ margin: 0, fontSize: 15 }}>{label} — {t.scannerDevices.tokenSuffix}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, marginTop: 0 }}>
          {t.scannerDevices.tokenModalDesc}
        </p>
        {!token ? (
          <button className="btn btn--primary btn--sm" onClick={reveal} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Eye size={13} /> {loading ? t.common.loading : t.scannerDevices.revealTokenBtn}
          </button>
        ) : (
          <div>
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 12px', fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all',
              marginBottom: 12, letterSpacing: 1,
            }}>{token}</div>
            <button className="btn btn--sm btn--secondary" onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Copy size={13} /> {copied ? `✓ ${t.scannerDevices.copiedLabel}` : t.settings.copyBtn}
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
  const { t } = useTranslation()
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
          <h3 style={{ margin: 0, fontSize: 15 }}>{isEdit ? t.scannerDevices.editDeviceTitle : t.scannerDevices.newDeviceTitle}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>

        {newToken ? (
          <div>
            <p style={{ fontSize: 13, color: 'var(--success)', marginBottom: 12 }}>
              ✓ {t.scannerDevices.deviceCreatedMsg}
            </p>
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', marginBottom: 12,
            }}>{newToken}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn--sm btn--secondary" onClick={copyToken} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Copy size={13} /> {copied ? `✓ ${t.scannerDevices.copiedLabel}` : t.settings.copyBtn}
              </button>
              <button className="btn btn--sm btn--primary" onClick={onClose}>{t.common.close}</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-row">
              <label className="form-label">{t.scannerDevices.deviceNameLabel}</label>
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder={t.scannerDevices.deviceNamePlaceholder} />
            </div>
            <div className="form-row">
              <label className="form-label">{t.scannerDevices.locationLabel}</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder={t.scannerDevices.locationPlaceholder} />
            </div>
            <div className="form-row">
              <label className="form-label">{t.scannerDevices.operatorLabel}</label>
              <select value={workerEntityId} onChange={e => setWorkerEntityId(e.target.value)}>
                <option value="">{t.scannerDevices.selectPlaceholder}</option>
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
              <button className="btn btn--sm btn--secondary" onClick={onClose}>{t.common.close}</button>
              <button
                className="btn btn--sm btn--primary"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !label.trim()}
              >
                {saveMutation.isPending ? t.common.saving : isEdit ? t.common.save : t.scannerDevices.createBtn}
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

function fmtLogTime(ms: number, locale: string): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleTimeString(locale, { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' })
}

function OperatorLogTab({ workers }: { workers: WorkerApi[] }) {
  const { t } = useTranslation()
  const { language } = useUiPreferences()
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
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{t.scannerDevices.startDateLabel}</label>
          <input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{t.scannerDevices.endDateLabel}</label>
          <input type="date" value={endDate} min={startDate} max={todayStr()} onChange={e => setEndDate(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{t.scannerDevices.deviceOperatorLabel}</label>
          <select value={deviceFilter} onChange={e => setDeviceFilter(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, minWidth: 200 }}>
            <option value="all">{t.scannerDevices.allDevicesOption}</option>
            {deviceOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { label: t.common.today, s: todayStr(), e: todayStr() },
            { label: t.scannerDevices.last7DaysLabel, s: daysAgoStr(6), e: todayStr() },
            { label: t.scannerDevices.last30DaysLabel, s: daysAgoStr(29), e: todayStr() },
          ].map(p => (
            <button key={p.label} onClick={() => { setStartDate(p.s); setEndDate(p.e) }}
              className="btn btn-ghost" style={{ fontSize: 12 }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="card"><div className="card-body">{t.common.loading}</div></div>
      ) : grouped.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <History size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ margin: 0 }}>{t.scannerDevices.noScansInRange}</p>
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
                            {t.scannerDevices.workersScansSummary.replace('{{n1}}', String(rows.length)).replace('{{n2}}', String(totalScans))}
                          </span>
                        </div>
                        {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </div>
                      {isOpen && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ borderTop: '1px solid var(--border)' }}>
                              <th style={{ padding: '7px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{t.workTimeDay.colWorker}</th>
                              <th style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{t.scannerDevices.scanCountCol}</th>
                              <th style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{t.scannerDevices.firstScanCol}</th>
                              <th style={{ padding: '7px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{t.scannerDevices.lastScanCol}</th>
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
                                  <td style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>{fmtLogTime(r.firstScan, DATE_LABEL_LOCALES[language])}</td>
                                  <td style={{ padding: '7px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>{fmtLogTime(r.lastScan, DATE_LABEL_LOCALES[language])}</td>
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

// Groups raw per-scan points into "spots" — points within ~15m of each
// other (rounded to 4 decimal places, ≈11m at this latitude) are treated as
// the same physical location so the list and the map's popups both read as
// "who was scanned here", not one row per scan.
function groupIntoSpots(points: ScanLocationRow[]) {
  const spots = new Map<string, { lat: number; lng: number; points: ScanLocationRow[] }>()
  for (const p of points) {
    const key = `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`
    const spot = spots.get(key) ?? { lat: p.latitude, lng: p.longitude, points: [] }
    spot.points.push(p)
    spots.set(key, spot)
  }
  return [...spots.values()]
}

// Leaflet's default marker icon references image files by a relative path
// that doesn't resolve once bundled — the standard fix is pointing it at
// the same version's images on a CDN once, at module load.
let leafletIconPatched = false
function patchLeafletIcon(leaflet: typeof import('leaflet')) {
  if (leafletIconPatched) return
  leafletIconPatched = true
  leaflet.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

// Default map center when there's neither scan data nor zones yet — lets an
// admin lay down geofence zones before a single scan has ever happened.
const DEFAULT_MAP_CENTER: [number, number] = [37.9601, 58.3261] // Aşgabat
const DEFAULT_MAP_ZOOM = 12

function formatRadius(m: number) {
  if (m >= 1000 && m % 1000 === 0) return `${m / 1000} km`
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`
  return `${m} m`
}

// Small colored dot for scans that fell outside every configured geofence
// zone — keeps them visually distinct from normal-location pins without
// needing another marker image asset.
function outOfBoundsIcon() {
  return L.divIcon({
    className: 'geofence-oob-marker',
    html: '<div style="width:16px;height:16px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

type ZoneFormValue = {
  label: string
  scope: 'all' | 'device'
  deviceId: string
  radiusMeters: number
}

// Shared label/scope/radius fields for both "create a zone" and "edit a
// zone" — position (lat/lng) is set by the map click and never edited here.
function ZoneFormFields({
  value, onChange, devices,
}: {
  value: ZoneFormValue
  onChange: (v: ZoneFormValue) => void
  devices: ScannerDevice[]
}) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{t.common.name}</label>
        <input
          type="text" value={value.label}
          onChange={e => onChange({ ...value, label: e.target.value })}
          placeholder={t.scannerDevices.zoneNamePlaceholder}
          style={{ width: '100%', maxWidth: 320, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{t.scannerDevices.forWhomLabel}</label>
          <select
            value={value.scope}
            onChange={e => onChange({ ...value, scope: e.target.value as 'all' | 'device' })}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, minWidth: 170 }}
          >
            <option value="all">{t.scannerDevices.allOperatorsOption}</option>
            <option value="device">{t.scannerDevices.specificDeviceOption}</option>
          </select>
        </div>
        {value.scope === 'device' && (
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{t.scannerDevices.deviceLabelShort}</label>
            <select
              value={value.deviceId}
              onChange={e => onChange({ ...value, deviceId: e.target.value })}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, minWidth: 200 }}
            >
              <option value="">{t.scannerDevices.selectPlaceholder}</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>{d.operatorName ? `${d.label} (${d.operatorName})` : d.label}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{t.scannerDevices.radiusLabel}</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number" min={1} value={value.radiusMeters}
              onChange={e => onChange({ ...value, radiusMeters: Math.max(1, Number(e.target.value) || 0) })}
              style={{ width: 90, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }}
            />
            {[10, 100, 1000].map(r => (
              <button key={r} type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 8px' }}
                onClick={() => onChange({ ...value, radiusMeters: r })}>
                {formatRadius(r)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ZoneDraftCard({
  lat, lng, devices, onSave, onCancel, saving,
}: {
  lat: number; lng: number; devices: ScannerDevice[]
  onSave: (input: GeofenceZoneInput) => void
  onCancel: () => void
  saving: boolean
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState<ZoneFormValue>({ label: '', scope: 'all', deviceId: '', radiusMeters: 100 })
  const canSave = value.label.trim().length > 0 && (value.scope === 'all' || value.deviceId)

  return (
    <div className="card" style={{ marginBottom: 16, border: '1px solid var(--accent)' }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Target size={14} color="var(--accent)" /> {t.scannerDevices.newZonePrefix} {lat.toFixed(5)}, {lng.toFixed(5)}
        </span>
        <button className="btn btn-ghost btn--sm" onClick={onCancel}><X size={14} /></button>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ZoneFormFields value={value} onChange={setValue} devices={devices} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn--primary btn--sm"
            disabled={!canSave || saving}
            onClick={() => onSave({
              label: value.label.trim(),
              scannerDeviceId: value.scope === 'device' ? value.deviceId : null,
              latitude: lat,
              longitude: lng,
              radiusMeters: value.radiusMeters,
            })}
          >
            {saving ? '...' : t.common.save}
          </button>
          <button className="btn btn-ghost btn--sm" onClick={onCancel}>{t.common.cancel}</button>
        </div>
      </div>
    </div>
  )
}

function ZoneRow({
  zone, devices, onSave, onDelete, saving, deleting,
}: {
  zone: GeofenceZone; devices: ScannerDevice[]
  onSave: (input: Partial<GeofenceZoneInput>) => void
  onDelete: () => void
  saving: boolean
  deleting: boolean
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<ZoneFormValue>({
    label: zone.label,
    scope: zone.scannerDeviceId ? 'device' : 'all',
    deviceId: zone.scannerDeviceId ?? '',
    radiusMeters: zone.radiusMeters,
  })

  const deviceLabel = zone.scannerDeviceId
    ? (devices.find(d => d.id === zone.scannerDeviceId)?.label ?? t.scannerDevices.unknownDeviceLabel)
    : null

  if (!editing) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Target size={14} color="var(--accent)" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{zone.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {formatRadius(zone.radiusMeters)} {t.scannerDevices.radiusSuffixWord}{deviceLabel ? ` · ${deviceLabel}` : ''} · {zone.latitude.toFixed(5)}, {zone.longitude.toFixed(5)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="btn btn--sm btn--secondary" onClick={() => setEditing(true)} title={t.common.edit}><Pencil size={13} /></button>
          <button className="btn btn--sm" style={{ background: 'var(--danger)', color: '#fff' }} disabled={deleting} onClick={onDelete} title={t.common.delete}><Trash2 size={13} /></button>
        </div>
      </div>
    )
  }

  const canSave = value.label.trim().length > 0 && (value.scope === 'all' || value.deviceId)

  return (
    <div className="card" style={{ border: '1px solid var(--accent)' }}>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ZoneFormFields value={value} onChange={setValue} devices={devices} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn--primary btn--sm"
            disabled={!canSave || saving}
            onClick={() => {
              onSave({
                label: value.label.trim(),
                scannerDeviceId: value.scope === 'device' ? value.deviceId : null,
                radiusMeters: value.radiusMeters,
              })
              setEditing(false)
            }}
          >
            {saving ? '...' : t.common.save}
          </button>
          <button className="btn btn-ghost btn--sm" onClick={() => setEditing(false)}>{t.common.cancel}</button>
        </div>
      </div>
    </div>
  )
}

function LocationsTab() {
  const { t } = useTranslation()
  const { language } = useUiPreferences()
  const qc = useQueryClient()
  const [startDate, setStartDate] = useState(daysAgoStr(6))
  const [endDate, setEndDate] = useState(todayStr())
  const [search, setSearch] = useState('')
  const [deviceFilter, setDeviceFilter] = useState<string>('all')
  const [selectedSpot, setSelectedSpot] = useState<{ lat: number; lng: number; points: ScanLocationRow[] } | null>(null)

  const [addingZone, setAddingZone] = useState(false)
  const [zoneDraft, setZoneDraft] = useState<{ lat: number; lng: number } | null>(null)

  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const zonesLayerRef = useRef<L.LayerGroup | null>(null)
  const addingZoneRef = useRef(false)
  addingZoneRef.current = addingZone

  const { data: points = [], isLoading } = useQuery({
    queryKey: ['scanner-devices-scan-locations', startDate, endDate],
    queryFn: () => scannerDevicesApi.getScanLocations(startDate, endDate),
  })

  const { data: devices = [] } = useQuery({
    queryKey: ['scanner-devices'],
    queryFn: scannerDevicesApi.getAll,
    staleTime: 30_000,
  })

  const { data: zones = [] } = useQuery({
    queryKey: ['geofence-zones'],
    queryFn: geofenceApi.list,
  })

  const createZoneMutation = useMutation({
    mutationFn: (input: GeofenceZoneInput) => geofenceApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['geofence-zones'] })
      setZoneDraft(null)
      setAddingZone(false)
    },
  })
  const updateZoneMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<GeofenceZoneInput> }) => geofenceApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geofence-zones'] }),
  })
  const deleteZoneMutation = useMutation({
    mutationFn: (id: string) => geofenceApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geofence-zones'] }),
  })

  // Search + device filter over the raw scan points, same pattern as
  // OperatorLogTab's deviceFilter — before grouping into spots.
  const deviceOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of points) map.set(p.deviceId, p.operatorName ? `${p.deviceLabel} (${p.operatorName})` : p.deviceLabel)
    return [...map.entries()]
  }, [points])

  const filteredPoints = useMemo(() => {
    const q = search.trim().toLowerCase()
    return points.filter(p => {
      if (deviceFilter !== 'all' && p.deviceId !== deviceFilter) return false
      if (q && !p.workerName.toLowerCase().includes(q) && !p.employeeNumber.toLowerCase().includes(q)) return false
      return true
    })
  }, [points, deviceFilter, search])

  const spots = useMemo(() => groupIntoSpots(filteredPoints), [filteredPoints])

  // Map is created once, independent of scan/zone data, so an admin can lay
  // down geofence zones before a single scan has ever happened. Free —
  // OpenStreetMap tiles, no API key.
  useEffect(() => {
    if (!mapDivRef.current || mapInstanceRef.current) return
    patchLeafletIcon(L)

    const map = L.map(mapDivRef.current).setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)
    markersLayerRef.current = L.layerGroup().addTo(map)
    zonesLayerRef.current = L.layerGroup().addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!addingZoneRef.current) return
      setZoneDraft({ lat: e.latlng.lat, lng: e.latlng.lng })
    })

    mapInstanceRef.current = map
    return () => {
      map.remove()
      mapInstanceRef.current = null
      markersLayerRef.current = null
      zonesLayerRef.current = null
    }
  }, [])

  // Scan-spot markers — red dot when any scan at that spot fell outside
  // every configured geofence zone.
  useEffect(() => {
    const map = mapInstanceRef.current
    const layer = markersLayerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const markers: L.Marker[] = []
    for (const spot of spots) {
      const anyOut = spot.points.some(p => p.outOfGeofence)
      const marker = anyOut ? L.marker([spot.lat, spot.lng], { icon: outOfBoundsIcon() }) : L.marker([spot.lat, spot.lng])
      marker.bindTooltip(
        t.scannerDevices.workersScansSummary.replace('{{n1}}', String(new Set(spot.points.map(p => p.employeeNumber)).size)).replace('{{n2}}', String(spot.points.length))
          + (anyOut ? ` · ⚠ ${t.scannerDevices.outOfZoneSuffix}` : ''),
      )
      marker.on('click', () => setSelectedSpot(spot))
      marker.addTo(layer)
      markers.push(marker)
    }
    if (markers.length === 1) {
      map.setView([spots[0].lat, spots[0].lng], 15)
    } else if (markers.length > 1) {
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2))
    }
  }, [spots, t])

  // Zone circles — re-fit the view around them when there's no scan data to
  // anchor on instead, so newly-added zones are always visible.
  useEffect(() => {
    const map = mapInstanceRef.current
    const layer = zonesLayerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const circles: L.Circle[] = []
    for (const zone of zones) {
      const circle = L.circle([zone.latitude, zone.longitude], {
        radius: zone.radiusMeters,
        color: '#2563eb',
        weight: 2,
        dashArray: '6 4',
        fillOpacity: 0.08,
      })
      circle.bindTooltip(`${zone.label} · ${formatRadius(zone.radiusMeters)}`)
      circle.addTo(layer)
      circles.push(circle)
    }
    if (spots.length === 0 && circles.length > 0) {
      map.fitBounds(L.featureGroup(circles).getBounds().pad(0.3))
    }
  }, [zones, spots.length])

  // Marks the point the admin just clicked while placing a new zone.
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !zoneDraft) return
    const marker = L.circleMarker([zoneDraft.lat, zoneDraft.lng], {
      radius: 8, color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.6,
    }).addTo(map)
    return () => { marker.remove() }
  }, [zoneDraft])

  const globalZones = zones.filter(z => !z.scannerDeviceId)
  const deviceZones = zones.filter(z => z.scannerDeviceId)

  return (
    <div>
      {/* Filters */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20,
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16,
      }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{t.scannerDevices.startDateLabel}</label>
          <input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{t.scannerDevices.endDateLabel}</label>
          <input type="date" value={endDate} min={startDate} max={todayStr()} onChange={e => setEndDate(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{t.scannerDevices.deviceOperatorLabel}</label>
          <select value={deviceFilter} onChange={e => setDeviceFilter(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, minWidth: 200 }}>
            <option value="all">{t.scannerDevices.allDevicesOption}</option>
            {deviceOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{t.common.search}</label>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t.common.searchByNameOrId}
              style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { label: t.common.today, s: todayStr(), e: todayStr() },
            { label: t.scannerDevices.last7DaysLabel, s: daysAgoStr(6), e: todayStr() },
            { label: t.scannerDevices.last30DaysLabel, s: daysAgoStr(29), e: todayStr() },
          ].map(p => (
            <button key={p.label} onClick={() => { setStartDate(p.s); setEndDate(p.e) }}
              className="btn btn-ghost" style={{ fontSize: 12 }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Zone-add toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          className={addingZone ? 'btn btn--primary btn--sm' : 'btn btn--secondary btn--sm'}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => { setAddingZone(v => !v); setZoneDraft(null) }}
        >
          <Target size={14} /> {addingZone ? t.scannerDevices.pickPointOnMap : t.scannerDevices.addZoneBtn}
        </button>
        {addingZone && !zoneDraft && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.scannerDevices.zoneAddHint}</span>
        )}
      </div>

      {zoneDraft && (
        <ZoneDraftCard
          lat={zoneDraft.lat}
          lng={zoneDraft.lng}
          devices={devices}
          saving={createZoneMutation.isPending}
          onCancel={() => { setZoneDraft(null); setAddingZone(false) }}
          onSave={input => createZoneMutation.mutate(input)}
        />
      )}

      <div ref={mapDivRef} style={{ width: '100%', height: 420, borderRadius: 12, overflow: 'hidden', marginBottom: 16, border: '1px solid var(--border)' }} />

      {isLoading ? (
        <div className="card" style={{ marginBottom: 16 }}><div className="card-body">{t.common.loading}</div></div>
      ) : spots.length === 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <MapPin size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ margin: 0 }}>{t.scannerDevices.noLocationScansInRange}</p>
          </div>
        </div>
      ) : (
        <>
          {selectedSpot && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} color="var(--accent)" /> {selectedSpot.lat.toFixed(5)}, {selectedSpot.lng.toFixed(5)}
                </span>
                <button className="btn btn-ghost btn--sm" onClick={() => setSelectedSpot(null)}><X size={14} /></button>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '7px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{t.workTimeDay.colWorker}</th>
                      <th style={{ padding: '7px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{t.scannerDevices.operatorCol}</th>
                      <th style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{t.scannerDevices.typeCol}</th>
                      <th style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{t.scannerDevices.zoneCol}</th>
                      <th style={{ padding: '7px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{t.common.time}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSpot.points
                      .slice()
                      .sort((a, b) => b.eventTime - a.eventTime)
                      .map((p, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '7px 16px', fontWeight: 600 }}>{p.workerName}</td>
                          <td style={{ padding: '7px 8px', color: 'var(--text-secondary)' }}>{p.operatorName ?? p.deviceLabel}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                            <span style={{ color: p.eventType === 'CHECK_IN' ? 'var(--success)' : 'var(--warning, #F59E0B)', fontWeight: 600 }}>
                              {p.eventType === 'CHECK_IN' ? t.workTimesheet.colCheckIn : t.workTimesheet.colCheckOut}
                            </span>
                          </td>
                          <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                            {p.outOfGeofence === true && <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 11 }}>⚠ {t.scannerDevices.outsideLabel}</span>}
                            {p.outOfGeofence === false && <span style={{ color: 'var(--success)', fontSize: 11 }}>✓ {t.scannerDevices.insideLabel}</span>}
                            {p.outOfGeofence === null && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                          </td>
                          <td style={{ padding: '7px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>{fmtLogTime(p.eventTime, DATE_LABEL_LOCALES[language])}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* List of spots below the map — click either to see who was scanned there */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {spots
              .slice()
              .sort((a, b) => b.points.length - a.points.length)
              .map((spot, i) => {
                const anyOut = spot.points.some(p => p.outOfGeofence)
                return (
                  <div
                    key={i}
                    onClick={() => setSelectedSpot(spot)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
                      background: 'var(--bg-card)', border: `1px solid ${anyOut ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 12, padding: '10px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MapPin size={14} color={anyOut ? 'var(--danger)' : 'var(--primary)'} />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {t.scannerDevices.workersScansSummary.replace('{{n1}}', String(new Set(spot.points.map(p => p.employeeNumber)).size)).replace('{{n2}}', String(spot.points.length))}
                      </span>
                      {anyOut && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)' }}>⚠ {t.scannerDevices.outOfZoneSuffix}</span>}
                    </div>
                    <ChevronDown size={15} />
                  </div>
                )
              })}
          </div>
        </>
      )}

      {/* Geofence zones management */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={15} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>{t.scannerDevices.allowedZonesTitle}</span>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
            {t.scannerDevices.zonesExplanation}
          </p>
          {zones.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{t.scannerDevices.noZonesYet}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>{t.scannerDevices.forAllOperatorsCountLabel.replace('{{n}}', String(globalZones.length))}</div>
                {globalZones.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>—</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {globalZones.map(zone => (
                      <ZoneRow
                        key={zone.id} zone={zone} devices={devices}
                        saving={updateZoneMutation.isPending} deleting={deleteZoneMutation.isPending}
                        onSave={input => updateZoneMutation.mutate({ id: zone.id, input })}
                        onDelete={() => { if (window.confirm(t.scannerDevices.deleteZoneConfirm.replace('{{label}}', zone.label))) deleteZoneMutation.mutate(zone.id) }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>{t.scannerDevices.forSpecificDevicesCountLabel.replace('{{n}}', String(deviceZones.length))}</div>
                {deviceZones.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>—</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {deviceZones.map(zone => (
                      <ZoneRow
                        key={zone.id} zone={zone} devices={devices}
                        saving={updateZoneMutation.isPending} deleting={deleteZoneMutation.isPending}
                        onSave={input => updateZoneMutation.mutate({ id: zone.id, input })}
                        onDelete={() => { if (window.confirm(t.scannerDevices.deleteZoneConfirm.replace('{{label}}', zone.label))) deleteZoneMutation.mutate(zone.id) }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ScannerDevicesPage() {
  const { t } = useTranslation()
  const { language } = useUiPreferences()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'devices' | 'log' | 'locations'>('devices')
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
          <Smartphone size={20} /> {t.scannerDevices.pageTitle}
        </h1>
        {activeTab === 'devices' && (
          <button
            className="btn btn--primary btn--sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowCreate(true)}
          >
            <Plus size={14} /> {t.scannerDevices.newDeviceTitle}
          </button>
        )}
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8, marginBottom: 16 }}>
        {t.scannerDevices.pageDesc}
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {([
          { key: 'devices' as const, icon: Smartphone, label: t.scannerDevices.devicesTab },
          { key: 'log' as const, icon: History, label: t.scannerDevices.operatorLogTab },
          { key: 'locations' as const, icon: MapPin, label: t.scannerDevices.locationsTab },
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

      {activeTab === 'locations' && <LocationsTab />}

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
          label={t.scannerDevices.activeDevicesLabel}
        />
        <StatCard
          icon={<Users size={19} color="var(--info)" />}
          accent="var(--info)"
          accentLight="var(--info-light)"
          value={scanSummary ? scanSummary.totalWorkersEverScanned : '—'}
          label={t.scannerDevices.totalScannedWorkersLabel}
        />
        <StatCard
          icon={<ScanLine size={19} color="var(--success)" />}
          accent="var(--success)"
          accentLight="var(--success-light)"
          value={scanSummary ? scanSummary.todayWorkersScanned : '—'}
          label={t.scannerDevices.todayScannedWorkersLabel}
        />
      </div>

      {isLoading ? (
        <div className="card"><div className="card-body">{t.common.loading}</div></div>
      ) : devices.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <Smartphone size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ margin: 0 }}>{t.scannerDevices.noDevicesYet}</p>
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
                  title={stale ? t.scannerDevices.staleTooltip : undefined}
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
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--warning)' }}>⚠ {t.scannerDevices.staleLabel}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {device.location && <span>📍 {device.location}</span>}
                    {device.operatorName
                      ? <span>👤 {device.operatorName}</span>
                      : <span style={{ color: 'var(--warning)' }}>⚠ {t.scannerDevices.noOperatorAssigned}</span>
                    }
                    <span style={{ fontFamily: 'monospace' }}>🔑 {device.tokenPrefix}...</span>
                    <span>🕐 {formatLastSeen(device.lastSeenAt, t, DATE_LABEL_LOCALES[language])}</span>
                    {device.batteryLevel !== null && (
                      <span style={{ color: batteryColor(device.batteryLevel) }}>🔋 {device.batteryLevel}%</span>
                    )}
                    {device.appVersion && <span>📱 v{device.appVersion}</span>}
                    {!!device.pendingEventCount && (
                      <span style={{ color: device.pendingEventCount > 20 ? 'var(--danger)' : 'var(--warning)' }}>
                        📦 {t.scannerDevices.pendingSyncTemplate.replace('{{n}}', String(device.pendingEventCount))}
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
                      <Users size={11} /> {t.scannerDevices.totalPrefixLabel} {t.scannerDevices.workersScansSummary.replace('{{n1}}', String(device.totalWorkersScanned)).replace('{{n2}}', String(device.totalScans))}
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontWeight: 600, color: 'var(--success)',
                      background: 'var(--success-light)', borderRadius: 99,
                      padding: '3px 10px',
                    }}>
                      <ScanLine size={11} /> {t.scannerDevices.todayPrefixLabel} {t.scannerDevices.workersScansSummary.replace('{{n1}}', String(device.todayWorkersScanned)).replace('{{n2}}', String(device.todayScans))}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn btn--sm btn--secondary"
                    onClick={() => setTokenModal(device)}
                    title={t.scannerDevices.revealTokenBtn}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Eye size={13} />
                  </button>

                  <button
                    className="btn btn--sm btn--secondary"
                    onClick={() => setEditDevice(device)}
                    title={t.common.edit}
                  >
                    <Pencil size={13} />
                  </button>

                  <button
                    className="btn btn--sm"
                    style={{ background: 'var(--warning)', color: '#000', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setRegenConfirm(device.id)}
                    title={t.settings.regenerateBtn}
                  >
                    <RefreshCw size={13} />
                  </button>

                  <button
                    className="btn btn--sm btn--secondary"
                    onClick={() => toggleMutation.mutate({ id: device.id, isActive: !device.isActive })}
                    title={device.isActive ? t.scannerDevices.deactivateLabel : t.scannerDevices.activateLabel}
                  >
                    {device.isActive ? <WifiOff size={13} /> : <Wifi size={13} />}
                  </button>

                  <button
                    className="btn btn--sm"
                    style={{ background: 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => {
                      if (window.confirm(t.scannerDevices.deleteDeviceConfirm.replace('{{label}}', device.label))) {
                        deleteMutation.mutate(device.id)
                      }
                    }}
                    title={t.common.delete}
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
                  <span style={{ flex: 1 }}>⚠ {t.scannerDevices.regenerateWarning}</span>
                  <button
                    className="btn btn--sm"
                    style={{ background: 'var(--warning)', color: '#000' }}
                    onClick={() => regenMutation.mutate(device.id)}
                    disabled={regenMutation.isPending}
                  >
                    {regenMutation.isPending ? '...' : t.scannerDevices.yesRegenerateBtn}
                  </button>
                  <button className="btn btn--sm btn--secondary" onClick={() => setRegenConfirm(null)}>{t.common.no}</button>
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
