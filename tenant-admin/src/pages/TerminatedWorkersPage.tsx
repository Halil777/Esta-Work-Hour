import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, RefreshCw, UserX } from 'lucide-react'
import { workersApi, type WorkerApi } from '../api/workers'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { useTranslation } from '../i18n/useTranslation'

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Moscow',
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export function TerminatedWorkersPage() {
  const { t } = useTranslation()
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
          {t.terminatedPage.title}
        </h1>
        <div className="page-actions">
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {t.terminatedPage.total}: <strong>{workers.length}</strong>
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
                placeholder={t.terminatedPage.searchPlaceholder}
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
                  <th>{t.terminatedPage.colRegNo}</th>
                  <th>{t.terminatedPage.colName}</th>
                  <th>{t.terminatedPage.colPosition}</th>
                  <th>{t.terminatedPage.colTeam}</th>
                  <th>{t.terminatedPage.colTermDate}</th>
                  <th>{t.terminatedPage.colReason}</th>
                  <th>{t.terminatedPage.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7}><div className="empty-state"><p>{t.common.loading}</p></div></td></tr>
                ) : workers.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <UserX size={32} color="var(--text-muted)" />
                        <p>{t.terminatedPage.noData}</p>
                      </div>
                    </td>
                  </tr>
                ) : workers.map((w: WorkerApi) => (
                  <tr key={w.id}>
                    <td className="td-mono">{w.workerId}</td>
                    <td className="fw-600">{w.name}</td>
                    <td className="td-muted" style={{ fontSize: 12 }}>{w.profession || '—'}</td>
                    <td className="td-muted" style={{ fontSize: 12 }}>{w.brigadeName || '—'}</td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--danger)' }}>
                        {fmtDate(w.terminationDate ?? w.terminatedAt)}
                      </span>
                    </td>
                    <td className="td-muted" style={{ fontSize: 12 }}>{w.terminationReason || '—'}</td>
                    <td>
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => restoreMut.mutate(w.id)}
                        disabled={restoreMut.isPending}
                        title={t.terminatedPage.restoreTitle}
                      >
                        <RefreshCw size={13} />
                        {t.terminatedPage.restoreBtn}
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
