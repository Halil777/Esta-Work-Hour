import type { ReactNode } from 'react'

export function Panel({
  title,
  subtitle,
  extra,
  children,
}: {
  title: string
  subtitle?: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {extra}
      </div>
      {children}
    </section>
  )
}
