import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, RefreshCw, UserX } from 'lucide-react'
import { workersApi, type WorkerApi } from '../api/workers'
import { useUiPreferences } from '../app/providers/useUiPreferences'

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export function TerminatedWorkersPage() {
  const [search, setSearch] = useState('')
  const { user } = useUiPreferences()
  const qc = useQueryClient()
  const adminName = user?.name ?? 'Admin'

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ['terminated-workers', search],
    queryFn: () => workersApi.listTerminated(search || undefined),
    staleTime: 30_000,
  })

  const restoreMut = useMutation({
    mutationFn: (id: string) => workersApi.restore(id, adminName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['terminated-workers'] }),
  })

  return (
    <>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserX size={20} color="var(--danger)" />
          İşden Bosadylanlar
        </h1>
        <div className="page-actions">
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Jemi: <strong>{workers.length}</strong>
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="filters-bar">
            <div className="input-wrap">
              <Search size={14} />
              <input
                className="search-input"
                placeholder="Işçi adyny ýa-da Sicil No gözle…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card-body card-body--p0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sicil No</th>
                  <th>İnsan Adı</th>
                  <th>Görev</th>
                  <th>Ekip</th>
                  <th>İşden Aýrylan Senesi</th>
                  <th>Hereketler</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6}><div className="empty-state"><p>Ýüklenýär…</p></div></td></tr>
                ) : workers.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <UserX size={32} color="var(--text-muted)" />
                        <p>İşden bosadylan işçi ýok</p>
                      </div>
                    </td>
                  </tr>
                ) : workers.map((w: WorkerApi & { terminatedAt?: string }) => (
                  <tr key={w.id}>
                    <td className="td-mono">{w.workerId}</td>
                    <td className="fw-600">{w.name}</td>
                    <td className="td-muted" style={{ fontSize: 12 }}>{w.profession || '—'}</td>
                    <td className="td-muted" style={{ fontSize: 12 }}>{w.brigadeName || '—'}</td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--danger)' }}>
                        {fmtDate((w as any).terminatedAt)}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => restoreMut.mutate(w.id)}
                        disabled={restoreMut.isPending}
                        title="Sanawa gaýtadan goş"
                      >
                        <RefreshCw size={13} />
                        Dikelt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
