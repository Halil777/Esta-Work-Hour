import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KeyRound, Search } from 'lucide-react'
import { workersApi, type MobileRole, type WorkerApi } from '../../api/workers'
import { CredentialBadge, CredentialModal } from './CredentialAccess'
import { Badge, type BadgeVariant } from '../ui/Badge'

type RoleWorkersColumn = {
  header: string
  render: (worker: WorkerApi, index: number) => ReactNode
}

type RoleWorkersPageProps = {
  role: MobileRole
  title: string
  icon: ReactNode
  countVariant?: BadgeVariant
  description?: ReactNode
  emptyIcon: ReactNode
  emptyText: string
  emptySearchText?: string
  columns: RoleWorkersColumn[]
}

export function RoleWorkersPage({
  role,
  title,
  icon,
  countVariant = 'neutral',
  description,
  emptyIcon,
  emptyText,
  emptySearchText = 'Netije ýok',
  columns,
}: RoleWorkersPageProps) {
  const [credentialWorker, setCredentialWorker] = useState<WorkerApi | null>(null)
  const [search, setSearch] = useState('')

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ['workers', role],
    queryFn: () => workersApi.list({ mobileRole: role }),
  })

  const query = search.trim().toLowerCase()
  const filtered = (workers as WorkerApi[]).filter(worker => {
    if (!query) return true
    return [worker.name, worker.workerId, worker.profession, worker.brigadeName]
      .some(value => value?.toLowerCase().includes(query))
  })

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-left">
          {icon}
          <h1>{title}</h1>
          <Badge variant={countVariant}>{workers.length}</Badge>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              className="input"
              style={{ width: 240, paddingLeft: 32 }}
              placeholder="Gözle..."
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
        </div>
      </div>

      {description && (
        <div style={{ padding: '0 0 12px', fontSize: 13, color: 'var(--text-muted)' }}>
          {description}
        </div>
      )}

      {isLoading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {emptyIcon}
          <p>{query ? emptySearchText : emptyText}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map(column => <th key={column.header}>{column.header}</th>)}
                <th>Credential</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((worker, index) => (
                <tr key={worker.id}>
                  {columns.map(column => (
                    <td key={column.header}>{column.render(worker, index)}</td>
                  ))}
                  <td><CredentialBadge workerId={worker.id} /></td>
                  <td>
                    <button
                      className="btn btn--ghost btn--sm"
                      type="button"
                      title="Credential belleý"
                      onClick={() => setCredentialWorker(worker)}
                    >
                      <KeyRound size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {credentialWorker && (
        <CredentialModal worker={credentialWorker} onClose={() => setCredentialWorker(null)} />
      )}
    </div>
  )
}
