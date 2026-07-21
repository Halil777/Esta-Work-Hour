import type { CSSProperties, ReactNode } from 'react'
import { X } from 'lucide-react'

type AppModalProps = {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  maxWidth?: number | string
  className?: string
  bodyClassName?: string
  style?: CSSProperties
}

export function AppModal({
  title,
  onClose,
  children,
  footer,
  maxWidth,
  className = '',
  bodyClassName = '',
  style,
}: AppModalProps) {
  return (
    <div className="modal-overlay" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div
        className={`modal-box ${className}`.trim()}
        onClick={event => event.stopPropagation()}
        style={{ ...style, ...(maxWidth ? { maxWidth } : {}) }}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn--ghost btn--sm" type="button" onClick={onClose} aria-label="Ýap">
            <X size={14} />
          </button>
        </div>
        <div className={`modal-body ${bodyClassName}`.trim()}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
