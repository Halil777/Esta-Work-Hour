import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, Clock, TrendingUp, Plus,
  CheckSquare, Square, Tag, ExternalLink, RotateCcw,
} from 'lucide-react'
import { workTimeApi, adjustmentsApi, reasonsApi, type AdjustmentType } from '../api/workTime'

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

const ADJ_TYPE_LABELS: Record<AdjustmentType, string> = {
  ADD:      '+ Add Hours',
  SUBTRACT: '− Subtract Hours',
  SET:      '= Set Credited To',
  MINIMUM:  '↑ Minimum Hours',
  BONUS:    '★ Bonus Hours',
}

// ── Adjustment Modal ──────────────────────────────────────────────────────────

interface AdjModalProps {
  workers: { workerEntityId: string; name: string; actualMinutes?: number }[]
  workDate: string
  onClose: () => void
  onSaved: () => void
}

function AdjustmentModal({ workers, workDate, onClose, onSaved }: AdjModalProps) {
  const { data: reasons = [] } = useQuery({ queryKey: ['adjustment-reasons'], queryFn: reasonsApi.getAll })
  const activeReasons = reasons.filter(r => r.isActive)

  const [adjType, setAdjType] = useState<AdjustmentType>('ADD')
  const [minutes, setMinutes] = useState(60)
  const [reasonId, setReasonId] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(workDate)
  const [error, setError] = useState('')

  const qc = useQueryClient()
  const createMut = useMutation({
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
      onSaved()
      onClose()
    },
    onError: (e: any) => setError(e.message ?? 'Error'),
  })

  // Live preview for single worker
  const singleActual = workers.length === 1 ? (workers[0].actualMinutes ?? 0) : null
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

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: 460,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Add Adjustment</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        {/* Workers */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            {workers.length === 1 ? 'Worker' : `Workers (${workers.length} selected)`}
          </div>
          {workers.length === 1 ? (
            <div style={{ fontWeight: 600, fontSize: 14 }}>{workers[0].name}</div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxHeight: 80, overflowY: 'auto' }}>
              {workers.map(w => w.name).join(', ')}
            </div>
          )}
        </div>

        {/* Date */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Work Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>

        {/* Type */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Adjustment Type</label>
          <select
            value={adjType}
            onChange={e => setAdjType(e.target.value as AdjustmentType)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 14 }}
          >
            {(Object.entries(ADJ_TYPE_LABELS) as [AdjustmentType, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Minutes */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            {adjType === 'SET' || adjType === 'MINIMUM' ? 'Target Minutes' : 'Minutes'}
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              min={1}
              value={minutes}
              onChange={e => setMinutes(Math.max(1, Number(e.target.value)))}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 14 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              = {Math.floor(minutes / 60)}h {minutes % 60}m
            </span>
          </div>
          {/* Quick presets */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {[30, 60, 120, 180, 240, 330, 480, 660].map(m => (
              <button
                key={m}
                onClick={() => setMinutes(m)}
                style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                  background: minutes === m ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: minutes === m ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${minutes === m ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {Math.floor(m / 60)}h{m % 60 ? ` ${m % 60}m` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Reason</label>
          <select
            value={reasonId}
            onChange={e => setReasonId(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 14 }}
          >
            <option value="">— Select reason —</option>
            {activeReasons.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Description (optional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Additional details..."
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>

        {/* Preview */}
        {previewCredited !== null && (
          <div style={{
            background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 16px',
            marginBottom: 20, border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Preview</div>
            <div style={{ display: 'flex', gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Actual</div>
                <div style={{ fontWeight: 600 }}>{fmtMins(singleActual!)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Adjustment</div>
                <div style={{ fontWeight: 600, color: previewCredited - singleActual! >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {previewCredited - singleActual! >= 0 ? '+' : ''}{fmtMins(previewCredited - singleActual!)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Credited</div>
                <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmtMins(previewCredited)}</div>
              </div>
            </div>
          </div>
        )}

        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !date || minutes < 1}
            className="btn btn-primary"
          >
            {createMut.isPending ? 'Saving...' : `Apply to ${workers.length === 1 ? 'Worker' : `${workers.length} Workers`}`}
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
            onClick={() => navigate('/work-time/reasons')}
            className="btn btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Tag size={14} />
            Reasons
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
    </div>
  )
}
