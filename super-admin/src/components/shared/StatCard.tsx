import type { ReactNode } from 'react'

export function StatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string
  value: string
  detail: string
  icon: ReactNode
}) {
  return (
    <article className="stat-card">
      <div className="stat-card__icon">{icon}</div>
      <div>
        <span className="stat-card__label">{label}</span>
        <strong className="stat-card__value">{value}</strong>
        <p className="stat-card__detail">{detail}</p>
      </div>
    </article>
  )
}
