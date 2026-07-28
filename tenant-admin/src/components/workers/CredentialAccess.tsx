import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react'
import { workersApi, type WorkerApi } from '../../api/workers'
import { AppModal } from '../ui/AppModal'
import { Badge } from '../ui/Badge'
import { useTranslation } from '../../i18n/useTranslation'

type CredentialModalProps = {
  worker: WorkerApi
  onClose: () => void
}

export function CredentialModal({ worker, onClose }: CredentialModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const roleLabel = (role: string) => ({
    worker: t.workers.roleWorker,
    foreman: t.workers.roleForeman,
    site_chief: t.workers.roleSiteChief,
    section_chief: t.workers.roleSectionChief,
  }[role] ?? role)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  const { data: credential, isLoading } = useQuery({
    queryKey: ['credential', worker.id],
    queryFn: () => workersApi.getCredential(worker.id),
    staleTime: 0,
  })

  const setCredentialMutation = useMutation({
    mutationFn: () => workersApi.setCredential(worker.id, username.trim(), password),
    onSuccess: () => {
      setMessage({ tone: 'success', text: t.credentials.savedMsg })
      setUsername('')
      setPassword('')
      queryClient.invalidateQueries({ queryKey: ['credential', worker.id] })
    },
    onError: (error: Error) => setMessage({ tone: 'danger', text: error.message || t.common.error }),
  })

  const deactivateCredentialMutation = useMutation({
    mutationFn: () => workersApi.deactivateCredential(worker.id),
    onSuccess: () => {
      setMessage({ tone: 'success', text: t.credentials.deactivatedMsg })
      queryClient.invalidateQueries({ queryKey: ['credential', worker.id] })
    },
    onError: (error: Error) => setMessage({ tone: 'danger', text: error.message || t.common.error }),
  })

  const saving = setCredentialMutation.isPending || deactivateCredentialMutation.isPending
  const canSave = username.trim().length > 0 && password.trim().length > 0

  return (
    <AppModal
      title={`${t.credentials.modalTitle} - ${worker.name}`}
      onClose={onClose}
      maxWidth={440}
      footer={(
        <>
          <button className="btn btn--secondary btn--sm" type="button" onClick={onClose}>
            {t.credentials.close}
          </button>
          <button
            className="btn btn--primary btn--sm"
            type="button"
            onClick={() => setCredentialMutation.mutate()}
            disabled={saving || !canSave}
          >
            {setCredentialMutation.isPending ? t.common.saving : <><KeyRound size={13} /> {t.credentials.saveBtn}</>}
          </button>
        </>
      )}
    >
      {isLoading ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.common.loading}</p>
      ) : credential ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              @{credential.username}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t.credentials.roleLabel}: {roleLabel(credential.role)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge variant={credential.isActive ? 'success' : 'neutral'}>
              {credential.isActive ? t.credentials.activeStatus : t.credentials.disabledStatus}
            </Badge>
            {credential.isActive && (
              <button
                className="btn btn--danger btn--sm"
                type="button"
                onClick={() => deactivateCredentialMutation.mutate()}
                disabled={saving}
              >
                {t.credentials.deactivateBtn}
              </button>
            )}
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.credentials.noCredential}</p>
      )}

      {message && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 6,
            background: message.tone === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            color: message.tone === 'success' ? 'var(--success)' : 'var(--danger)',
            fontSize: 13,
          }}
        >
          {message.tone === 'danger' && <AlertCircle size={14} />}
          {message.text}
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 650, marginBottom: 8 }}>
          {credential ? t.credentials.updateSection : t.credentials.createSection}
        </p>
        <div className="form-row" style={{ marginBottom: 8 }}>
          <label className="form-label">{t.credentials.usernameLabel}</label>
          <input
            value={username}
            onChange={event => setUsername(event.target.value)}
            placeholder={worker.workerId}
          />
        </div>
        <div className="form-row">
          <label className="form-label">{t.credentials.passwordLabel}</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder={t.credentials.passwordPlaceholder}
              style={{ paddingRight: 36 }}
            />
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? t.common.hidePassword : t.common.showPassword}
              style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                minHeight: 28,
                padding: '4px 7px',
                transform: 'translateY(-50%)',
              }}
            >
              {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
      </div>
    </AppModal>
  )
}

export function CredentialBadge({ workerId }: { workerId: string }) {
  const { t } = useTranslation()
  const roleLabel = (role: string) => ({
    worker: t.workers.roleWorker,
    foreman: t.workers.roleForeman,
    site_chief: t.workers.roleSiteChief,
    section_chief: t.workers.roleSectionChief,
  }[role] ?? role)
  const { data: credential, isLoading } = useQuery({
    queryKey: ['credential', workerId],
    queryFn: () => workersApi.getCredential(workerId),
    staleTime: 60_000,
  })

  if (isLoading) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>...</span>
  if (!credential) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>

  return (
    <Badge variant={credential.isActive ? 'success' : 'neutral'} title={roleLabel(credential.role)}>
      @{credential.username}
    </Badge>
  )
}
