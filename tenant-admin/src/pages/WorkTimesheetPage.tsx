import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2, Clock, TrendingUp, CheckSquare } from 'lucide-react'
import { workTimeApi, adjustmentsApi, reasonsApi, type AdjustmentType, type WorkAdjustment, type DayRow } from '../api/workTime'
import { useTranslation } from '../i18n/useTranslation'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import type { Language } from '../types/tenant'

// ── helpers ───────────────────────────────────────────────────────────────────

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

const DATE_LABEL_LOCALES: Record<Language, string> = { en: 'en-US', ru: 'ru-RU', tr: 'tr-TR' }

function fmtDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(locale, { timeZone: 'Europe/Moscow', weekday: 'short', month: 'short', day: 'numeric' })
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString(locale, { month: 'long', year: 'numeric' })
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
  ADD: '+', SUBTRACT: '−', SET: '=', MINIMUM: '↑', BONUS: '★',
}

// ── Add/Edit Adjustment Modal ─────────────────────────────────────────────────

interface AdjModalProps {
  workerEntityId: string
  workerName: string
  workDate: string
  actualMinutes: number
  existing?: WorkAdjustment
  onClose: () => void
  onSaved: () => void
}

function AdjModal({ workerEntityId, workerName, workDate, actualMinutes, existing, onClose, onSaved }: AdjModalProps) {
  const { t } = useTranslation()
  const { language } = useUiPreferences()
  const hourUnits = { h: t.workers.hourUnit, min: t.workers.minUnit }
  const { data: reasons = [] } = useQuery({ queryKey: ['adjustment-reasons'], queryFn: reasonsApi.getAll })
  const activeReasons = reasons.filter(r => r.isActive)
  const qc = useQueryClient()

  const [adjType, setAdjType]     = useState<AdjustmentType>(existing?.adjustmentType ?? 'ADD')
  const [minutes, setMinutes]     = useState(existing?.minutes ?? 60)
  const [reasonId, setReasonId]   = useState(existing?.reasonId ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [changeReason, setChangeReason] = useState('')
  const [error, setError] = useState('')

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['worker-timesheet'] })
    qc.invalidateQueries({ queryKey: ['work-time-summary'] })
  }

  const createMut = useMutation({
    mutationFn: () => adjustmentsApi.create({
      workerEntityId, workDate, adjustmentType: adjType, minutes,
      reasonId: reasonId || undefined, description: description || undefined,
    }),
    onSuccess: () => { invalidate(); onSaved(); onClose() },
    onError: (e: any) => setError(e.message),
  })

  const updateMut = useMutation({
    mutationFn: () => adjustmentsApi.update(existing!.id, {
      adjustmentType: adjType, minutes,
      reasonId: reasonId || null, description: description || null,
      changeReason: changeReason || undefined,
    }),
    onSuccess: () => { invalidate(); onSaved(); onClose() },
    onError: (e: any) => setError(e.message),
  })

  // Preview
  const preview = (() => {
    switch (adjType) {
      case 'ADD': case 'BONUS': return actualMinutes + minutes
      case 'SUBTRACT': return Math.max(0, actualMinutes - minutes)
      case 'SET': return minutes
      case 'MINIMUM': return Math.max(actualMinutes, minutes)
    }
  })()

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{existing ? t.workTimesheet.editAdjustmentTitle : t.workTimesheet.addAdjustmentTitle}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{workerName} — {fmtDate(workDate, DATE_LABEL_LOCALES[language])}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.workTimeDay.colActual}: {fmtMins(actualMinutes, hourUnits)}</div>
        </div>

        {/* Type */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{t.workTimesheet.typeLabel}</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {(Object.keys(ADJ_TYPE_LABELS) as AdjustmentType[]).map(adjT => (
              <button
                key={adjT}
                onClick={() => setAdjType(adjT)}
                style={{
                  padding: '7px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 500,
                  background: adjType === adjT ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: adjType === adjT ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${adjType === adjT ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {ADJ_TYPE_LABELS[adjT]} {adjT === 'ADD' ? t.workTimesheet.typeAdd : adjT === 'SUBTRACT' ? t.workTimesheet.typeSubtract : adjT === 'SET' ? t.workTimesheet.typeSetTo : adjT === 'MINIMUM' ? t.workTimesheet.typeMinimum : t.workTimesheet.typeBonus}
              </button>
            ))}
          </div>
        </div>

        {/* Minutes */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{t.workTimesheet.minutesLabel}</label>
          <input type="number" min={1} value={minutes} onChange={e => setMinutes(Math.max(1, Number(e.target.value)))}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {[30, 60, 120, 180, 240, 330, 480, 660].map(m => (
              <button key={m} onClick={() => setMinutes(m)} style={{
                padding: '3px 9px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                background: minutes === m ? 'var(--accent)' : 'var(--bg-elevated)',
                color: minutes === m ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${minutes === m ? 'var(--accent)' : 'var(--border)'}`,
              }}>
                {Math.floor(m / 60)}{hourUnits.h}{m % 60 ? ` ${m % 60}${hourUnits.min}` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{t.workTimesheet.reasonLabel}</label>
          <select value={reasonId} onChange={e => setReasonId(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }}>
            <option value="">{t.workTimesheet.selectReasonPlaceholder}</option>
            {activeReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{t.common.description}</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>

        {/* Change reason (edit only) */}
        {existing && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{t.workTimesheet.changeReasonLabel}</label>
            <input value={changeReason} onChange={e => setChangeReason(e.target.value)}
              placeholder={t.workTimesheet.changeReasonPlaceholder}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        )}

        {/* Preview */}
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{t.workTimesheet.previewLabel}</div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.workTimeDay.colActual}</div><div style={{ fontWeight: 600 }}>{fmtMins(actualMinutes, hourUnits)}</div></div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.workTimesheet.colAdjustment}</div>
              <div style={{ fontWeight: 600, color: preview - actualMinutes >= 0 ? '#22c55e' : '#ef4444' }}>
                {preview - actualMinutes >= 0 ? '+' : ''}{fmtMins(preview - actualMinutes, hourUnits)}
              </div>
            </div>
            <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.workTimeDay.colCredited}</div><div style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmtMins(preview, hourUnits)}</div></div>
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost">{t.common.cancel}</button>
          <button
            onClick={() => existing ? updateMut.mutate() : createMut.mutate()}
            disabled={isPending || minutes < 1}
            className="btn btn-primary"
          >
            {isPending ? t.common.saving : existing ? t.workTimesheet.saveChangesBtn : t.workTimesheet.addAdjustmentTitle}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Day Row ───────────────────────────────────────────────────────────────────

function DayRowComponent({
  day, workerEntityId, workerName, onRefresh,
}: {
  day: DayRow
  workerEntityId: string
  workerName: string
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const { language } = useUiPreferences()
  const hourUnits = { h: t.workers.hourUnit, min: t.workers.minUnit }
  const [expanded, setExpanded] = useState(false)
  const [adjModal, setAdjModal] = useState<WorkAdjustment | null | 'new'>(null)
  const qc = useQueryClient()

  const cancelMut = useMutation({
    mutationFn: (id: string) => adjustmentsApi.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['worker-timesheet'] }); qc.invalidateQueries({ queryKey: ['work-time-summary'] }) },
  })

  const hasAdj  = day.adjustments.length > 0
  const adjColor = day.adjustmentMinutes === 0 ? 'var(--text-muted)'
    : day.adjustmentMinutes > 0 ? '#22c55e' : '#ef4444'

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--border)', background: hasAdj ? 'rgba(139,92,246,0.03)' : 'transparent' }}>
        <td style={{ padding: '9px 14px', color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
          {fmtDate(day.workDate, DATE_LABEL_LOCALES[language])}
        </td>
        <td style={{ padding: '9px 14px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          {day.checkIn ? fmtTime(day.checkIn) : '—'}
        </td>
        <td style={{ padding: '9px 14px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          {day.checkOut ? fmtTime(day.checkOut) : '—'}
        </td>
        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>
          {fmtMins(day.actualMinutes, hourUnits)}
        </td>
        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: adjColor }}>
          {day.adjustmentMinutes === 0 ? '—' : (day.adjustmentMinutes > 0 ? '+' : '') + fmtMins(day.adjustmentMinutes, hourUnits)}
          {hasAdj && (
            <button onClick={() => setExpanded(e => !e)}
              style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--accent)' }}>
              {expanded ? '▲' : '▼'} {day.adjustments.length}
            </button>
          )}
        </td>
        <td style={{ padding: '9px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700 }}>
          {fmtMins(day.creditedMinutes, hourUnits)}
        </td>
        <td style={{ padding: '9px 14px', textAlign: 'center' }}>
          <button
            onClick={() => setAdjModal('new')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }}
            title={t.workTimesheet.addAdjustmentTitle}
          >
            <Plus size={13} />
          </button>
        </td>
      </tr>

      {/* Adjustment rows */}
      {expanded && day.adjustments.map(adj => (
        <tr key={adj.id} style={{ background: 'rgba(139,92,246,0.04)', borderBottom: '1px solid var(--border)' }}>
          <td colSpan={3} style={{ padding: '6px 14px 6px 28px' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {ADJ_TYPE_LABELS[adj.adjustmentType]} {fmtMins(adj.minutes, hourUnits)} · {adj.reasonLabel ?? t.workTimesheet.noReasonLabel}
              {adj.description && <> · <span style={{ fontStyle: 'italic' }}>{adj.description}</span></>}
            </span>
          </td>
          <td colSpan={2} style={{ padding: '6px 14px', fontSize: 11, color: 'var(--text-muted)' }}>
            {t.workTimesheet.byLabel} {adj.createdBy} · {new Date(adj.createdAt).toLocaleDateString(DATE_LABEL_LOCALES[language], { timeZone: 'Europe/Moscow' })}
            {adj.updatedBy && <> · {t.workTimesheet.editedByLabel} {adj.updatedBy}</>}
          </td>
          <td style={{ padding: '6px 14px' }} />
          <td style={{ padding: '6px 14px', textAlign: 'center' }}>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              <button onClick={() => setAdjModal(adj)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3 }}>
                <Edit2 size={12} />
              </button>
              <button onClick={() => { if (window.confirm(t.workTimesheet.cancelAdjustmentConfirm)) cancelMut.mutate(adj.id) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 3 }}>
                <Trash2 size={12} />
              </button>
            </div>
          </td>
        </tr>
      ))}

      {adjModal && (
        <AdjModal
          workerEntityId={workerEntityId}
          workerName={workerName}
          workDate={day.workDate}
          actualMinutes={day.actualMinutes}
          existing={adjModal === 'new' ? undefined : adjModal}
          onClose={() => setAdjModal(null)}
          onSaved={onRefresh}
        />
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function WorkTimesheetPage() {
  const { t } = useTranslation()
  const { language } = useUiPreferences()
  const hourUnits = { h: t.workers.hourUnit, min: t.workers.minUnit }
  const { workerEntityId } = useParams<{ workerEntityId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [month, setMonth] = useState(searchParams.get('month') ?? currentMonth())

  const isCurrentOrFuture = month >= currentMonth()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['worker-timesheet', workerEntityId, month],
    queryFn: () => workTimeApi.getWorkerTimesheet(workerEntityId!, month),
    enabled: !!workerEntityId,
  })

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Back */}
      <button onClick={() => navigate(`/work-time?month=${month}`)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13, marginBottom: 16, padding: 0 }}>
        <ChevronLeft size={16} /> {t.adjustmentReasons.backToWorkTime}
      </button>

      {/* Worker header */}
      {data && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{data.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {data.workerId} · {data.profession || '—'} · {data.brigade || '—'} ·{' '}
            {data.shift ? (data.shift === 'day' ? `☀️ ${t.shiftSettings.dayShift}` : `🌙 ${t.shiftSettings.nightShift}`) : t.workTimesheet.noShiftAssigned}
          </div>
        </div>
      )}

      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 16px', width: 'fit-content' }}>
        <button onClick={() => setMonth(m => prevMonth(m))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 15, minWidth: 160, textAlign: 'center' }}>{monthLabel(month, DATE_LABEL_LOCALES[language])}</span>
        <button onClick={() => setMonth(m => nextMonth(m))}
          disabled={isCurrentOrFuture}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4, opacity: isCurrentOrFuture ? 0.3 : 1 }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Monthly totals */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { key: 'actual' as const, label: t.workTimeDay.colActual, value: data.totalActualMinutes, icon: Clock, color: '#64748b' },
            { key: 'adjustment' as const, label: t.workTimesheet.colAdjustment, value: data.totalAdjustmentMinutes, icon: TrendingUp, color: data.totalAdjustmentMinutes >= 0 ? '#22c55e' : '#ef4444' },
            { key: 'credited' as const, label: t.workTimeDay.colCredited, value: data.totalCreditedMinutes, icon: CheckSquare, color: 'var(--accent)' },
          ].map(stat => (
            <div key={stat.key} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <stat.icon size={18} color={stat.color} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stat.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: stat.color }}>
                  {stat.key === 'adjustment' && stat.value > 0 ? '+' : ''}{fmtMins(stat.value, hourUnits)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Day table */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>{t.common.loading}</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#ef4444' }}>{(error as Error).message}</div>
      ) : data ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{t.workTimesheet.colDate}</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{t.workTimesheet.colCheckIn}</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{t.workTimesheet.colCheckOut}</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>{t.workTimeDay.colActual}</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>{t.workTimesheet.colAdjustment}</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>{t.workTimeDay.colCredited}</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{t.common.add}</th>
              </tr>
            </thead>
            <tbody>
              {data.days
                .filter(d => d.actualMinutes > 0 || d.adjustments.length > 0 || d.checkIn !== null)
                .map(day => (
                  <DayRowComponent
                    key={day.workDate}
                    day={day}
                    workerEntityId={workerEntityId!}
                    workerName={data.name}
                    onRefresh={() => refetch()}
                  />
                ))}
              {data.days.filter(d => d.actualMinutes > 0 || d.adjustments.length > 0 || d.checkIn !== null).length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t.workTimesheet.noDataMonth}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
