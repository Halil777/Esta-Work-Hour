import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  CheckSquare, Square, Plus, ExternalLink, RotateCcw,
} from 'lucide-react'
import { workTimeApi, type DayWorkerRow } from '../api/workTime'
import { AdjustmentModal } from './WorkTimePage'
import { useTranslation } from '../i18n/useTranslation'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import type { Language } from '../types/tenant'

// ── helpers ───────────────────────────────────────────────────────────────────
// Same conventions (TZ offset, minute/time formatting) as WorkTimesheetPage.tsx,
// so this page reads consistently with the rest of the Work Time section.

const TZ_OFFSET = 3 * 60 * 60 * 1000 // UTC+3

function fmtMins(minutes: number, units: { h: string; min: string } = { h: 'h', min: 'min' }): string {
  if (!minutes || minutes === 0) return '—'
  const h = Math.floor(Math.abs(minutes) / 60)
  const m = Math.abs(minutes) % 60
  const sign = minutes < 0 ? '-' : ''
  return m > 0 ? `${sign}${h}${units.h} ${m}${units.min}` : `${sign}${h}${units.h}`
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

const DATE_LABEL_LOCALES: Record<Language, string> = { en: 'en-US', ru: 'ru-RU', tr: 'tr-TR' }

function fmtDateLabel(dateStr: string, locale: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return d.toLocaleDateString(locale, { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// Bucket N = "N–(N+1) actual hours worked that day"; bucket 12 catches 12h+.
// Bucketing is always by the RAW actual scan hours (never the already-
// credited value), so admins are grouping and correcting the real record,
// not re-adjusting an adjustment.
function bucketOf(actualMinutes: number): number {
  return Math.min(Math.floor(actualMinutes / 60), 12)
}

// Templates come from the active tr/en/ru translation set (each has a
// {{h}}/{{n}}/{{n1}} placeholder) so this stays language-neutral — never a
// hardcoded Turkmen string regardless of the selected UI language.
function bucketLabel(n: number, hourUnit: string, tpl: { bucketZero: string; bucketMax: string; bucketRange: string }): string {
  if (n === 0) return tpl.bucketZero.replace('{{h}}', hourUnit)
  if (n === 12) return tpl.bucketMax.replace('{{h}}', hourUnit)
  return tpl.bucketRange.replace('{{n}}', String(n)).replace('{{n1}}', String(n + 1)).replace('{{h}}', hourUnit)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WorkTimeDayPage() {
  const { t } = useTranslation()
  const { language } = useUiPreferences()
  const hourUnits = { h: t.workers.hourUnit, min: t.workers.minUnit }
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const date = params.get('date') || todayStr()
  const setDate = (d: string) => setParams({ date: d })

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [adjModal, setAdjModal] = useState(false)
  const [search, setSearch] = useState('')
  // No-scan filter: workers with zero scans that day at all (distinct from
  // "scanned but very little", which bucket 0 already covers below).
  const [noScanOnly, setNoScanOnly] = useState(false)
  // Staff (Aylık/monthly) vs regular (Saatlik/hourly) worker filter — same
  // mesaiSistemi/isStaff distinction used on the Workers table and Reports.
  const [staffFilter, setStaffFilter] = useState<'all' | 'staff' | 'workers'>('all')
  // Day-shift vs night-shift filter, same w.shift field already shown in the
  // Shift column below.
  const [shiftFilter, setShiftFilter] = useState<'all' | 'day' | 'night'>('all')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['work-time-day', date],
    queryFn: () => workTimeApi.getDaySummary(date),
  })

  const workers = data?.workers ?? []
  const filtered = workers.filter(w => {
    if (search && !(w.name.toLowerCase().includes(search.toLowerCase()) || w.workerId.includes(search))) return false
    if (noScanOnly && w.hasScan) return false
    if (staffFilter === 'staff' && !w.isStaff) return false
    if (staffFilter === 'workers' && w.isStaff) return false
    if (shiftFilter !== 'all' && w.shift !== shiftFilter) return false
    return true
  })

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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{t.workTimeDay.title}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            {t.workTimeDay.pageDesc}
          </p>
        </div>
        <button
          onClick={() => navigate('/work-time')}
          className="btn btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ExternalLink size={14} />
          {t.workTimeDay.backToMonthly}
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
          {t.common.today}
        </button>
        <button onClick={() => refetch()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <RotateCcw size={14} />
        </button>
      </div>
      <div style={{ marginBottom: 20, color: 'var(--text-secondary)', fontSize: 13 }}>{fmtDateLabel(date, DATE_LABEL_LOCALES[language])}</div>

      {/* Search + select all */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder={t.common.searchByNameOrId}
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
          {t.workTimeDay.selectAllCount.replace('{{n}}', String(filtered.length))}
        </button>

        <button
          onClick={() => setNoScanOnly(v => !v)}
          className="btn btn-ghost"
          style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
            ...(noScanOnly ? { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 } : {}),
          }}
          title={t.workTimeDay.noScanTitle}
        >
          {noScanOnly ? <CheckSquare size={14} /> : <Square size={14} />}
          {t.workTimeDay.noScanBtn}
        </button>

        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {([
            { key: 'all' as const, label: t.workTimeDay.filterAll },
            { key: 'workers' as const, label: t.workTimeDay.filterWorkers },
            { key: 'staff' as const, label: t.workTimeDay.filterStaff },
          ]).map(opt => (
            <button
              key={opt.key}
              onClick={() => setStaffFilter(opt.key)}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: staffFilter === opt.key ? 600 : 500,
                border: 'none', cursor: 'pointer',
                background: staffFilter === opt.key ? 'var(--accent)' : 'var(--bg-card)',
                color: staffFilter === opt.key ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {([
            { key: 'all' as const, label: t.workTimeDay.filterAll },
            { key: 'day' as const, label: `☀️ ${t.workers.dayShift}` },
            { key: 'night' as const, label: `🌙 ${t.workers.nightShift}` },
          ]).map(opt => (
            <button
              key={opt.key}
              onClick={() => setShiftFilter(opt.key)}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: shiftFilter === opt.key ? 600 : 500,
                border: 'none', cursor: 'pointer',
                background: shiftFilter === opt.key ? 'var(--accent)' : 'var(--bg-card)',
                color: shiftFilter === opt.key ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {selected.size > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.workTimeDay.selectedCount.replace('{{n}}', String(selected.size))}</span>
        )}
      </div>

      {/* Buckets */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>{t.common.loading}</div>
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
                      title={t.workTimeDay.toggleGroup}
                    >
                      {bucketSelectedCount > 0 && allInBucketSelected
                        ? <CheckSquare size={15} color="var(--accent)" />
                        : <Square size={15} />}
                    </button>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{bucketLabel(b, hourUnits.h, t.workTimeDay)}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      ({rows.length} {t.workTimeDay.colWorker}{bucketSelectedCount > 0 ? `, ${t.workers.bulkSelected.replace('{{n}}', String(bucketSelectedCount))}` : ''})
                    </span>
                  </div>
                  {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>

                {!isCollapsed && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderTop: '1px solid var(--border)' }}>
                        <th style={{ width: 32 }} />
                        <th style={{ padding: '8px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{t.workTimeDay.colWorker}</th>
                        <th style={{ padding: '8px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{t.workTimeDay.colShift}</th>
                        <th style={{ padding: '8px 8px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{t.workTimeDay.colCheckInOut}</th>
                        <th style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{t.workTimeDay.colActual}</th>
                        <th style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{t.workTimeDay.colCredited}</th>
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
                              {w.shift ? (w.shift === 'day' ? `☀️ ${t.workers.dayShift}` : `🌙 ${t.workers.nightShift}`) : '—'}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                              {fmtTime(w.checkIn)} → {fmtTime(w.checkOut)}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {fmtMins(w.actualMinutes, hourUnits)}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700 }}>
                              {fmtMins(w.creditedMinutes, hourUnits)}
                              {hasAdj && (
                                <div
                                  title={w.adjustments.map(a => a.reasonLabel || a.adjustmentType).join(', ')}
                                  style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}
                                >
                                  ✓ {t.workTimeDay.adjustedLabel}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 16px 10px 8px', textAlign: 'center' }}>
                              <button
                                onClick={() => navigate(`/work-time/${w.workerEntityId}?month=${date.slice(0, 7)}`)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }}
                                title={t.adjustmentsAnalytics.viewMonthlyTitle}
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
              {t.workTimeDay.noWorkersFound}
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
          <span style={{ fontWeight: 600, fontSize: 13 }}>{t.workTimeDay.selectedCount.replace('{{n}}', String(selected.size))}</span>
          <button onClick={() => setSelected(new Set())} className="btn btn-ghost" style={{ fontSize: 12 }}>{t.common.cancel}</button>
          <button
            onClick={() => setAdjModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} />
            {t.workTimeDay.setHoursBtn}
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
