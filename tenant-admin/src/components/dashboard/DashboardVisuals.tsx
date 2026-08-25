import { TrendingUp, TrendingDown } from 'lucide-react'

// ─── Sparkline ──────────────────────────────────────────────────────────────
// Tiny inline trend line: muted path + a single colored dot on the last point.
// Pure presentational — no axes, no gridlines (a stat-tile sparkline per the
// dataviz mark spec never carries chrome of its own).

export function Sparkline({
  points, color = 'var(--primary)', width = 96, height = 28,
}: { points: number[]; color?: string; width?: number; height?: number }) {
  if (!points || points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const pad = 3
  const stepX = (width - pad * 2) / (points.length - 1)
  const coords = points.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (1 - (v - min) / span) * (height - pad * 2)
    return [x, y] as const
  })
  const d = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lastX, lastY] = coords[coords.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <path d={d} fill="none" stroke="var(--text-muted)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
    </svg>
  )
}

// ─── Progress ring ──────────────────────────────────────────────────────────
// SVG donut for a single headline percentage (attendance rate). Track uses a
// recessive surface tone; the arc uses the brand primary.

export function ProgressRing({
  pct, size = 100, stroke = 10, color = 'var(--primary)',
}: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  const offset = c - (clamped / 100) * c
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-surface-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 500ms ease' }}
      />
    </svg>
  )
}

// ─── Delta badge ────────────────────────────────────────────────────────────
// pct === null means "no prior-period baseline" — render a neutral "new" chip
// when a label is supplied, otherwise nothing (never a fabricated 0%/flat claim).

export function DeltaBadge({
  pct, size = 'sm', newLabel, invert = false,
}: { pct: number | null; size?: 'sm' | 'md'; newLabel?: string; invert?: boolean }) {
  if (pct === null) {
    if (!newLabel) return null
    return (
      <span className={`delta-badge delta-badge--flat delta-badge--${size}`}>{newLabel}</span>
    )
  }
  if (pct === 0) {
    return <span className={`delta-badge delta-badge--flat delta-badge--${size}`}>0%</span>
  }
  // `numericUp` is the true direction of the number; `good` is whether that
  // direction is favorable — inverted for metrics where a decrease is good
  // (e.g. absences, pending overtime), so the arrow always tells the truth
  // while the color tells the story.
  const numericUp = pct >= 0
  const good = invert ? !numericUp : numericUp
  const Icon = numericUp ? TrendingUp : TrendingDown
  return (
    <span className={`delta-badge ${good ? 'delta-badge--up' : 'delta-badge--down'} delta-badge--${size}`}>
      <Icon size={size === 'sm' ? 11 : 13} />
      {numericUp ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}
