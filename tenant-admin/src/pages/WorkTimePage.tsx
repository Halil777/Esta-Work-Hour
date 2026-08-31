import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, Clock, TrendingUp, Plus,
  CheckSquare, Square, Tag, ExternalLink, RotateCcw, Download, CalendarDays,
} from 'lucide-react'
import { workTimeApi, adjustmentsApi, reasonsApi, type AdjustmentType, type WorkAdjustment } from '../api/workTime'
import { useUiPreferences } from '../app/providers/useUiPreferences'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtMins(minutes: number): string {
  if (!minutes || minutes === 0) return '—'
  const h = Math.floor(Math.abs(minutes) / 60)
  const m = Math.abs(minutes) % 60
  const sign = minutes < 0 ? '-' : ''
  return m > 0 ? `${sign}${h}h ${m}m` : `${sign}${h}h`
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const ADJ_TYPE_INFO: Record<AdjustmentType, { label: string; icon: string; hint: string }> = {
  SET:      { label: 'Takyk belle',   icon: '=', hint: 'Hasaba alynjak sagady takyk san bilen belle' },
  ADD:      { label: 'Sagat goş',     icon: '+', hint: 'Hakyky sagadyň üstüne goş' },
  SUBTRACT: { label: 'Sagat aýyr',    icon: '−', hint: 'Hakyky sagatdan aýyr' },
  MINIMUM:  { label: 'Iň az sagat',   icon: '↑', hint: 'Hakyky sagat şondan az bolsa, şu derejä çenli galdyr' },
  BONUS:    { label: 'Baýrak sagat',  icon: '★', hint: 'Goşmaça baýrak sagat goş' },
}

// ── Adjustment Modal ──────────────────────────────────────────────────────────

export interface AdjModalProps {
  workers: { workerEntityId: string; name: string; actualMinutes?: number; checkIn?: number | null; checkOut?: number | null }[]
  workDate: string
  onClose: () => void
  onSaved: () => void
}

const ADJ_TZ_OFFSET = 3 * 60 * 60 * 1000
function fmtAdjTime(ms: number | null | undefined): string {
  if (!ms) return '—'
  const d = new Date(Number(ms) + ADJ_TZ_OFFSET)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export function AdjustmentModal({ workers, workDate, onClose, onSaved }: AdjModalProps) {
  const { data: reasons = [] } = useQuery({ queryKey: ['adjustment-reasons'], queryFn: reasonsApi.getAll })
  const activeReasons = reasons.filter(r => r.isActive)

  const [adjType, setAdjType] = useState<AdjustmentType>('SET')
  const [hours, setHours] = useState(11)
  const [mins, setMins] = useState(0)
  const minutes = hours * 60 + mins
  const [reasonId, setReasonId] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(workDate)
  const [error, setError] = useState('')

  const setFromTotalMinutes = (m: number) => {
    setHours(Math.floor(m / 60))
    setMins(m % 60)
  }

  const qc = useQueryClient()
  const createMut = useMutation<WorkAdjustment | WorkAdjustment[], Error>({
    mutationFn: () => {
      if (workers.length === 1) {
        return adjustmentsApi.create({
          workerEntityId: workers[0].workerEntityId,
          workDate: date,
          adjustmentType: adjType,
          minutes,
          reasonId: reasonId || undefined,
          description: description || undefined,
        })
      }
      return adjustmentsApi.createBulk({
        workerEntityIds: workers.map(w => w.workerEntityId),
        workDate: date,
        adjustmentType: adjType,
        minutes,
        reasonId: reasonId || undefined,
        description: description || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-time-summary'] })
      qc.invalidateQueries({ queryKey: ['worker-timesheet'] })
      qc.invalidateQueries({ queryKey: ['work-time-day'] })
      onSaved()
      onClose()
    },
    onError: (e: any) => setError(e.message ?? 'Ýalňyşlyk ýüze çykdy'),
  })

  // Live preview — only meaningful when correcting a single worker
  const single = workers.length === 1 ? workers[0] : null
  const singleActual = single ? (single.actualMinutes ?? 0) : null
  const previewCredited = useMemo(() => {
    if (singleActual === null) return null
    switch (adjType) {
      case 'ADD':
      case 'BONUS':    return singleActual + minutes
      case 'SUBTRACT': return Math.max(0, singleActual - minutes)
      case 'SET':      return minutes
      case 'MINIMUM':  return Math.max(singleActual, minutes)
    }
  }, [singleActual, adjType, minutes])

  const initials = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(10,10,16,0.6)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: 20, width: 520,
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 24px 70px rgba(0,0,0,0.45)', border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '22px 26px 18px', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Iş sagadyny düzet</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
              {new Date(`${date}T00:00:00Z`).toLocaleDateString('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })} üçin hasaba alynjak sagady belläň
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
            cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', flexShrink: 0,
          }}>✕</button>
        </div>

        <div style={{ padding: '20px 26px 26px' }}>

          {/* Workers chip card */}
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12,
            padding: 14, marginBottom: 18,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
              {workers.length === 1 ? 'IŞÇI' : `${workers.length} IŞÇI SAÝLANDY`}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {workers.slice(0, 8).map(w => (
                <div key={w.workerEntityId} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 999, padding: '4px 10px 4px 4px',
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', color: '#fff',
                    fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{initials(w.name)}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{w.name}</span>
                </div>
              ))}
              {workers.length > 8 && (
                <div style={{
                  display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)',
                  padding: '4px 10px',
                }}>+ ýene {workers.length - 8}</div>
              )}
            </div>
          </div>

          {/* Raw scan reference — always visible, read-only, only makes sense for one worker */}
          {single && (single.checkIn || single.checkOut || singleActual !== null) && (
            <div style={{
              display: 'flex', gap: 18, alignItems: 'center',
              background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: 10,
              padding: '10px 14px', marginBottom: 18, fontSize: 12.5,
            }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>🕒 Hakyky scan:</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {fmtAdjTime(single.checkIn)} → {fmtAdjTime(single.checkOut)}
              </span>
              {singleActual !== null && (
                <span style={{ color: 'var(--text-secondary)' }}>
                  ({fmtMins(singleActual)})
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>üýtgemez</span>
            </div>
          )}

          {/* Date */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Sene</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          {/* Adjustment type — segmented cards instead of a bare <select> */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Näme etmeli?</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8 }}>
              {(Object.entries(ADJ_TYPE_INFO) as [AdjustmentType, typeof ADJ_TYPE_INFO[AdjustmentType]][]).map(([k, info]) => (
                <button
                  key={k}
                  onClick={() => setAdjType(k)}
                  title={info.hint}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                    background: adjType === k ? 'var(--accent)' : 'var(--bg-surface)',
                    color: adjType === k ? '#fff' : 'var(--text-primary)',
                    border: `1.5px solid ${adjType === k ? 'var(--accent)' : 'var(--border)'}`,
                    fontWeight: 600, transition: 'all .12s',
                  }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{info.icon}</span>
                  <span style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.2 }}>{info.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Hours / minutes duration picker */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
              {adjType === 'SET' || adjType === 'MINIMUM' ? 'Näçe sagat bellemeli' : 'Näçe sagat'}
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number" min={0}
                  value={hours}
                  onChange={e => setHours(Math.max(0, Number(e.target.value)))}
                  style={{ width: 64, padding: '9px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, textAlign: 'center' }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>sagat</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number" min={0} max={59}
                  value={mins}
                  onChange={e => setMins(Math.min(59, Math.max(0, Number(e.target.value))))}
                  style={{ width: 64, padding: '9px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, textAlign: 'center' }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>minut</span>
              </div>
            </div>
            {/* Quick presets */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {[30, 60, 120, 180, 240, 330, 480, 660].map(m => (
                <button
                  key={m}
                  onClick={() => setFromTotalMinutes(m)}
                  style={{
                    padding: '4px 11px', borderRadius: 7, fontSize: 11.5, cursor: 'pointer', fontWeight: 600,
                    background: minutes === m ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: minutes === m ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${minutes === m ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {Math.floor(m / 60)}{m % 60 ? `.${Math.round((m % 60) / 6)}` : ''}s
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Sebäbi</label>
            <select
              value={reasonId}
              onChange={e => setReasonId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 14 }}
            >
              <option value="">— Sebäp saýla (islege görä) —</option>
              {activeReasons.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Bellik (islege görä)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Goşmaça maglumat..."
              style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          {/* Preview */}
          {previewCredited !== null && (
            <div style={{
              background: 'var(--bg-elevated)', borderRadius: 12, padding: '14px 16px',
              marginBottom: 20, border: '1px solid var(--border)',
              display: 'flex', gap: 0, justifyContent: 'space-between',
            }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>HAKYKY</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{fmtMins(singleActual!)}</div>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>ÜÝTGEŞME</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: previewCredited - singleActual! >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {previewCredited - singleActual! >= 0 ? '+' : ''}{fmtMins(previewCredited - singleActual!)}
                </div>
              </div>
              <div style={{ width: 1, background: 'var(--border)' }} />
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>HASABA ALYNAN</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)' }}>{fmtMins(previewCredited)}</div>
              </div>
            </div>
          )}
          {workers.length > 1 && (
            <div style={{
              background: 'var(--bg-elevated)', borderRadius: 12, padding: '12px 16px',
              marginBottom: 20, border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-secondary)',
            }}>
              Bu üýtgetme saýlanan <b>{workers.length}</b> işçiniň hemmesine bir wagtda ulanylar.
            </div>
          )}

          {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn btn-ghost">Ýatyr</button>
            <button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !date || minutes < 0}
              className="btn btn-primary"
            >
              {createMut.isPending ? 'Ýazylýar...' : workers.length === 1 ? 'Işçä ulan' : `${workers.length} işçä ulan`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Export Modal ──────────────────────────────────────────────────────────────

type ExportMode = 'times' | 'hours' | 'both'

function ExportModal({ month, onClose }: { month: string; onClose: () => void }) {
  const { language } = useUiPreferences()
  const [mode, setMode] = useState<ExportMode>('both')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const OPTIONS: { value: ExportMode; label: string; desc: string }[] = [
    {
      value: 'times',
      label: 'Diňe Giriş / Çykyş Wagtlary',
      desc:  'Her günde işçiniň geleniň we gideniniň wagty görkezi\u0307ler',
    },
    {
      value: 'hours',
      label: 'Diňe İşlenen Sagatlar',
      desc:  'Her günde işçiniň işlän sagatlarynyň jemi görkezi\u0307ler',
    },
    {
      value: 'both',
      label: 'Ikisi hem (Giriş / Çykyş + Sagat)',
      desc:  'Her günde giriş, çykyş wagty we işlän sagatlarynyň jemi',
    },
  ]

  const handleExport = async () => {
    setLoading(true)
    setError('')
    try {
      await workTimeApi.exportXlsx(month, mode, language)
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Export ýalňyşlygy')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Download size={18} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Excel Export</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>
          Haýsy maglumatlary export etmeli? (<strong>{month}</strong>)
        </p>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                borderRadius: 10, border: `2px solid ${mode === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                background: mode === opt.value ? 'rgba(139,92,246,0.07)' : 'var(--bg-surface)',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              {/* Radio indicator */}
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                border: `2px solid ${mode === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                background: mode === opt.value ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {mode === opt.value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: mode === opt.value ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost" disabled={loading}>Ýatyr</button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={14} />
            {loading ? 'Taýýarlanýar...' : 'Excel göçür'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function WorkTimePage() {
  const navigate = useNavigate()
  const [month, setMonth] = useState(currentMonth)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adjModal, setAdjModal] = useState<{ workDate: string } | null>(null)
  const [search, setSearch] = useState('')
  const [exportModal, setExportModal] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['work-time-summary', month],
    queryFn: () => workTimeApi.getMonthSummary(month),
  })

  const isCurrentOrFuture = month >= currentMonth()

  const workers = data?.workers ?? []
  const filtered = search
    ? workers.filter(w =>
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        w.workerId.includes(search),
      )
    : workers

  const toggleWorker = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(w => w.workerEntityId)))
    }
  }

  const selectedWorkers = filtered.filter(w => selected.has(w.workerEntityId))

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Work Time</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Actual · Adjustment · Credited — per worker per month
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate('/work-time/day')}
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            title="Bir günki sagatlary aralyk boýunça görüp, toparlaýyn düzetmek"
          >
            <CalendarDays size={14} />
            Gün Görnüşi
          </button>
          <button
            onClick={() => navigate('/work-time/reasons')}
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Tag size={14} />
            Reasons
          </button>
          <button
            onClick={() => setExportModal(true)}
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={14} />
            Excel Export
          </button>
          <button
            onClick={() => setAdjModal({ workDate: `${month}-01` })}
            disabled={selected.size === 0}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} />
            {selected.size > 0 ? `Add Adjustment (${selected.size})` : 'Select Workers First'}
          </button>
        </div>
      </div>

      {/* Month Nav */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 16px',
        width: 'fit-content',
      }}>
        <button onClick={() => { setMonth(m => prevMonth(m)); setSelected(new Set()) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 15, minWidth: 160, textAlign: 'center' }}>
          {monthLabel(month)}
        </span>
        <button onClick={() => { setMonth(m => nextMonth(m)); setSelected(new Set()) }}
          disabled={isCurrentOrFuture}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4, opacity: isCurrentOrFuture ? 0.3 : 1 }}>
          <ChevronRight size={18} />
        </button>
        <button onClick={() => refetch()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Summary Stats */}
      {data?.totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Actual', value: data.totals.actualMinutes, icon: Clock, color: '#64748b' },
            { label: 'Total Adjustment', value: data.totals.adjustmentMinutes, icon: TrendingUp, color: data.totals.adjustmentMinutes >= 0 ? '#22c55e' : '#ef4444' },
            { label: 'Total Credited', value: data.totals.creditedMinutes, icon: CheckSquare, color: 'var(--accent)' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <stat.icon size={20} color={stat.color} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stat.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>{fmtMins(stat.value)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search + Select All */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <input
          placeholder="Search by name or ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, maxWidth: 300, padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg-surface)',
            color: 'var(--text-primary)', fontSize: 13,
          }}
        />
        {selected.size > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {selected.size} worker{selected.size > 1 ? 's' : ''} selected
          </span>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--red)' }}>
          {(error as Error).message}
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', width: 40 }}>
                  <button onClick={toggleAll} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                    {selected.size > 0 && selected.size === filtered.length
                      ? <CheckSquare size={15} />
                      : <Square size={15} />}
                  </button>
                </th>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Worker</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Shift</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Brigade</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Actual</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Adjustment</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Credited</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w, i) => {
                const isChecked = selected.has(w.workerEntityId)
                const adjColor = w.adjustmentMinutes === 0 ? 'var(--text-muted)'
                  : w.adjustmentMinutes > 0 ? '#22c55e' : '#ef4444'
                return (
                  <tr
                    key={w.workerEntityId}
                    style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                      background: isChecked ? 'rgba(139,92,246,0.05)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => toggleWorker(w.workerEntityId)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                        {isChecked ? <CheckSquare size={15} color="var(--accent)" /> : <Square size={15} />}
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600 }}>{w.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{w.workerId} · {w.profession || '—'}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                      {w.shift ? (w.shift === 'day' ? '☀️ Day' : '🌙 Night') : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>
                      {w.brigade || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {fmtMins(w.actualMinutes)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500, color: adjColor }}>
                      {w.adjustmentMinutes === 0 ? '—' : (w.adjustmentMinutes > 0 ? '+' : '') + fmtMins(w.adjustmentMinutes)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {fmtMins(w.creditedMinutes)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button
                        onClick={() => navigate(`/work-time/${w.workerEntityId}?month=${month}`)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }}
                        title="View Timesheet"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No workers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjustment Modal */}
      {adjModal && selectedWorkers.length > 0 && (
        <AdjustmentModal
          workers={selectedWorkers.map(w => ({
            workerEntityId: w.workerEntityId,
            name: w.name,
            actualMinutes: undefined,
          }))}
          workDate={adjModal.workDate}
          onClose={() => setAdjModal(null)}
          onSaved={() => setSelected(new Set())}
        />
      )}

      {/* Export Modal */}
      {exportModal && (
        <ExportModal month={month} onClose={() => setExportModal(false)} />
      )}
    </div>
  )
}
