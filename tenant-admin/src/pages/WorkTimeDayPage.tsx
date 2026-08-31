import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  CheckSquare, Square, Plus, ExternalLink, RotateCcw,
} from 'lucide-react'
import { workTimeApi, type DayWorkerRow } from '../api/workTime'
import { AdjustmentModal } from './WorkTimePage'

// ── helpers ───────────────────────────────────────────────────────────────────
// Same conventions (TZ offset, minute/time formatting) as WorkTimesheetPage.tsx,
// so this page reads consistently with the rest of the Work Time section.

const TZ_OFFSET = 3 * 60 * 60 * 1000 // UTC+3

function fmtMins(minutes: number): string {
  if (!minutes || minutes === 0) return '—'
  const h = Math.floor(Math.abs(minutes) / 60)
  const m = Math.abs(minutes) % 60
  const sign = minutes < 0 ? '-' : ''
  return m > 0 ? `${sign}${h}h ${m}m` : `${sign}${h}h`
}

function fmtTime(ms: number | null): string {
  if (!ms) return '—'
  const d = new Date(Number(ms) + TZ_OFFSET)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function todayStr(): string {
  const d = new Date(Date.now() + TZ_OFFSET)
  return d.toISOString().slice(0, 10)
}

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function fmtDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// Bucket N = "N–(N+1) actual hours worked that day"; bucket 12 catches 12h+.
// Bucketing is always by the RAW actual scan hours (never the already-
// credited value), so admins are grouping and correcting the real record,
// not re-adjusting an adjustment.
function bucketOf(actualMinutes: number): number {
  return Math.min(Math.floor(actualMinutes / 60), 12)
}

function bucketLabel(n: number): string {
  if (n === 0) return '0–1 sag (gelmedi / az wagt)'
  if (n === 12) return '12+ sag'
  return `${n}–${n + 1} sag aralygy`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WorkTimeDayPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const date = params.get('date') || todayStr()
  const setDate = (d: string) => setParams({ date: d })

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [adjModal, setAdjModal] = useState(false)
  const [search, setSearch] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['work-time-day', date],
    queryFn: () => workTimeApi.getDaySummary(date),
  })

  const workers = data?.workers ?? []
  const filtered = search
    ? workers.filter(w =>
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        w.workerId.includes(search),
      )
    : workers

  const buckets = useMemo(() => {
    const map = new Map<number, DayWorkerRow[]>()
    for (const w of filtered) {
      const b = bucketOf(w.actualMinutes)
      const arr = map.get(b) ?? []
      arr.push(w)
      map.set(b, arr)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [filtered])

  const toggleWorker = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleBucket = (rows: DayWorkerRow[]) => {
    const ids = rows.map(r => r.workerEntityId)
    const allSelected = ids.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size > 0 && selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(w => w.workerEntityId)))
  }

  const toggleCollapse = (b: number) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(b) ? next.delete(b) : next.add(b)
      return next
    })
  }

  const selectedWorkers = filtered.filter(w => selected.has(w.workerEntityId))
  const isToday = date >= todayStr()

  return (
    <div style={{ padding: 24, maxWidth: 1100, paddingBottom: selected.size > 0 ? 100 : 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Gün Görnüşi</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Bir günki işçiler işlän sagat aralygy boýunça toparlanýar — saýlap, toparlaýyn ýa-da aýratyn sagat belläp bolýar.
            Hakyky geliş/gidiş wagty hemişe görkezilýär.
          </p>
        </div>
        <button
          onClick={() => navigate('/work-time')}
          className="btn btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ExternalLink size={14} />
          Aýlyk Görnüşe Gaýt
        </button>
      </div>

      {/* Date Nav */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 16px',
        width: 'fit-content',
      }}>
        <button onClick={() => { setDate(shiftDate(date, -1)); setSelected(new Set()) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <ChevronLeft size={18} />
        </button>
        <input
          type="date"
          value={date}
          max={todayStr()}
          onChange={e => { setDate(e.target.value); setSelected(new Set()) }}
          style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, fontSize: 15 }}
        />
        <button onClick={() => { setDate(shiftDate(date, 1)); setSelected(new Set()) }}
          disabled={isToday}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4, opacity: isToday ? 0.3 : 1 }}>
          <ChevronRight size={18} />
        </button>
        <button onClick={() => { setDate(todayStr()); setSelected(new Set()) }} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>
          Bu gün
        </button>
        <button onClick={() => refetch()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <RotateCcw size={14} />
        </button>
      </div>
      <div style={{ marginBottom: 20, color: 'var(--text-secondary)', fontSize: 13 }}>{fmtDateLabel(date)}</div>

      {/* Search + select all */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="At ýa-da sicil belgisi boýunça gözle..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, maxWidth: 300, padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg-surface)',
            color: 'var(--text-primary)', fontSize: 13,
          }}
        />
        <button
          onClick={toggleAll}
          className="btn btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
        >
          {selected.size > 0 && selected.size === filtered.length ? <CheckSquare size={14} /> : <Square size={14} />}
          Hemmesini saýla ({filtered.length})
        </button>
        {selected.size > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.size} işçi saýlandy</span>
        )}
      </div>

      {/* Buckets */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Ýüklenýär...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--red)' }}>{(error as Error).message}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {buckets.map(([b, rows]) => {
            const isCollapsed = collapsed.has(b)
            const ids = rows.map(r => r.workerEntityId)
            const bucketSelectedCount = ids.filter(id => selected.has(id)).length
            const allInBucketSelected = bucketSelectedCount === rows.length

            return (
              <div key={b} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                <div
                  onClick={() => toggleCollapse(b)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', cursor: 'pointer', background: 'var(--bg-elevated)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={e => { e.stopPropagation(); toggleBucket(rows) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                      title="Şu topary saýla / aýyr"
                    >
                      {bucketSelectedCount > 0 && allInBucketSelected
                        ? <CheckSquare size={15} color="var(--accent)" />
                        : <Square size={15} />}
                    </button>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{bucketLabel(b)}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      ({rows.length} işçi{bucketSelectedCount > 0 ? `, ${bucketSelectedCount} saýlandy` : ''})
                    </span>
                  </div>
                  {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>

                {!isCollapsed && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderTop: '1px solid var(--border)' }}>
                        <th style={{ width: 32 }} />
                        <th style={{ padding: '8px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>Işçi</th>
                        <th style={{ padding: '8px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>Vardiýa</th>
                        <th style={{ padding: '8px 8px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>Giriş → Çykyş</th>
                        <th style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>Hakyky</th>
                        <th style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>Hasaba alnan</th>
                        <th style={{ width: 40 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(w => {
                        const isChecked = selected.has(w.workerEntityId)
                        const hasAdj = w.adjustments.length > 0
                        return (
                          <tr key={w.workerEntityId} style={{
                            borderTop: '1px solid var(--border)',
                            background: isChecked ? 'rgba(139,92,246,0.05)' : 'transparent',
                          }}>
                            <td style={{ padding: '10px 8px 10px 16px' }}>
                              <button onClick={() => toggleWorker(w.workerEntityId)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                                {isChecked ? <CheckSquare size={15} color="var(--accent)" /> : <Square size={15} />}
                              </button>
                            </td>
                            <td style={{ padding: '10px 8px' }}>
                              <div style={{ fontWeight: 600 }}>{w.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{w.workerId} · {w.profession || '—'} · {w.brigade || '—'}</div>
                            </td>
                            <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>
                              {w.shift ? (w.shift === 'day' ? '☀️ Gündüz' : '🌙 Gije') : '—'}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                              {fmtTime(w.checkIn)} → {fmtTime(w.checkOut)}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {fmtMins(w.actualMinutes)}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700 }}>
                              {fmtMins(w.creditedMinutes)}
                              {hasAdj && (
                                <div
                                  title={w.adjustments.map(a => a.reasonLabel || a.adjustmentType).join(', ')}
                                  style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}
                                >
                                  ✓ düzedildi
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 16px 10px 8px', textAlign: 'center' }}>
                              <button
                                onClick={() => navigate(`/work-time/${w.workerEntityId}?month=${date.slice(0, 7)}`)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }}
                                title="Aýlyk tablisany gör"
                              >
                                <ExternalLink size={14} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
          {buckets.length === 0 && (
            <div style={{
              textAlign: 'center', padding: 48, color: 'var(--text-muted)',
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
            }}>
              Işçi tapylmady
            </div>
          )}
        </div>
      )}

      {/* Sticky bulk-action bar */}
      {selected.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
          padding: '12px 20px', boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', gap: 16, zIndex: 100,
        }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{selected.size} işçi saýlandy</span>
          <button onClick={() => setSelected(new Set())} className="btn btn-ghost" style={{ fontSize: 12 }}>Ýatyr</button>
          <button
            onClick={() => setAdjModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} />
            Sagat Belle
          </button>
        </div>
      )}

      {adjModal && selectedWorkers.length > 0 && (
        <AdjustmentModal
          workers={selectedWorkers.map(w => ({ workerEntityId: w.workerEntityId, name: w.name, actualMinutes: w.actualMinutes, checkIn: w.checkIn, checkOut: w.checkOut }))}
          workDate={date}
          onClose={() => setAdjModal(false)}
          onSaved={() => setSelected(new Set())}
        />
      )}
    </div>
  )
}
