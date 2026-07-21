import type { CSSProperties, ReactNode } from 'react'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'primary'

type BadgeProps = {
  children: ReactNode
  variant?: BadgeVariant
  dot?: boolean
  className?: string
  style?: CSSProperties
  title?: string
}

export function Badge({
  children,
  variant = 'neutral',
  dot = false,
  className = '',
  style,
  title,
}: BadgeProps) {
  const classes = ['badge', `badge--${variant}`, dot ? 'badge--dot' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes} style={style} title={title}>
      {children}
    </span>
  )
}
