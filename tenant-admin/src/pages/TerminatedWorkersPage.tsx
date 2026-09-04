import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, RefreshCw, Search, UserX, X } from 'lucide-react'
import { workersApi, type WorkerApi } from '../api/workers'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { useTranslation } from '../i18n/useTranslation'
import { TerminatedExportModal } from '../components/workers/TerminatedExportModal'

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
  const { user, language } = useUiPreferences()
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

  // Bulk selection — one or several terminated workers, picked so their
  // worked-hours / scan-times Excel report can be pulled for any of them
  // without leaving this page. Cleared whenever the search narrows the
  // visible list, same as the Workers page, so a selection never silently
  // carries over a row that's scrolled out of view.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showExport, setShowExport] = useState(false)

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const allSelected = workers.length > 0 && workers.every((w: WorkerApi) => selectedIds.has(w.id))
  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const everySelected = workers.length > 0 && workers.every((w: WorkerApi) => prev.has(w.id))
      return everySelected ? new Set() : new Set(workers.map((w: WorkerApi) => w.id))
    })
  }

  const selectedWorkers = workers.filter((w: WorkerApi) => selectedIds.has(w.id))

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
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="bulk-action-bar">
            <span className="bulk-action-bar__count">
              {t.workers.bulkSelected.replace('{{n}}', String(selectedIds.size))}
            </span>

            <button
              className="btn btn--secondary btn--sm"
              type="button"
              onClick={() => setShowExport(true)}
            >
              <Download size={13} /> {t.terminatedPage.exportHoursBtn}
            </button>

            <button
              className="btn btn--ghost btn--sm bulk-action-bar__spacer"
              type="button"
              onClick={() => setSelectedIds(new Set())}
            >
              <X size={12} /> {t.workers.bulkDeselect}
            </button>
          </div>
        )}

        <div className="card-body card-body--p0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      style={{ width: 14, height: 14, minHeight: 'unset' }}
                      title={t.common.all}
                    />
                  </th>
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
                  <tr><td colSpan={8}><div className="empty-state"><p>{t.common.loading}</p></div></td></tr>
                ) : workers.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        <UserX size={32} color="var(--text-muted)" />
                        <p>{t.terminatedPage.noData}</p>
                      </div>
                    </td>
                  </tr>
                ) : workers.map((w: WorkerApi) => (
                  <tr key={w.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(w.id)}
                        onChange={() => toggleSelect(w.id)}
                        style={{ width: 14, height: 14, minHeight: 'unset' }}
                      />
                    </td>
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

      {showExport && selectedWorkers.length > 0 && (
        <TerminatedExportModal
          workers={selectedWorkers}
          language={language}
          onClose={() => setShowExport(false)}
        />
      )}
    </>
  )
}
