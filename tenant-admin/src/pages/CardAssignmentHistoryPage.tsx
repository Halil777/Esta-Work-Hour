import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, RefreshCw, Smartphone, UserCog, History as HistoryIcon } from 'lucide-react'
import { cardAssignmentHistoryApi, type CardAssignmentHistoryEntry } from '../api/cardAssignmentHistory'
import { useTranslation } from '../i18n/useTranslation'

// Every NFC card unbind/rebind, tenant-wide, newest first. Replaces the old
// Card Reports queue: an operator now clears and rebinds a wrong card
// directly from the device's Settings screen (no admin approval step), so
// this page is a read-only audit trail rather than a to-do list — it's the
// answer to "which operator cleared which worker's card, and who did that
// card end up bound to".

const SOURCE_ICON: Record<string, typeof Smartphone> = {
  'mobile-device': Smartphone,
  'manual-edit': UserCog,
  'card-report': HistoryIcon,
}

function sourceLabel(t: ReturnType<typeof useTranslation>['t'], source: string): string {
  switch (source) {
    case 'mobile-device': return t.cardHistory.sourceMobileDevice
    case 'manual-edit':   return t.cardHistory.sourceManualEdit
    case 'card-report':   return t.cardHistory.sourceCardReport
    default:              return source
  }
}

export function CardAssignmentHistoryPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const { data: entries = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['card-assignment-history-recent'],
    queryFn: () => cardAssignmentHistoryApi.getRecent(300),
    refetchInterval: 30_000,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return entries
    const q = search.trim().toLowerCase()
    return entries.filter((e: CardAssignmentHistoryEntry) =>
      (e.workerName ?? '').toLowerCase().includes(q) ||
      (e.previousCardUid ?? '').toLowerCase().includes(q) ||
      (e.newCardUid ?? '').toLowerCase().includes(q) ||
      (e.changedBy ?? '').toLowerCase().includes(q),
    )
  }, [entries, search])

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1>{t.cardHistory.title}</h1>
          <span className="page-kicker">{t.cardHistory.pageDesc}</span>
        </div>
        <button className="btn btn--secondary btn--sm" type="button" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={13} style={isFetching ? { animation: 'spin 1s linear infinite' } : undefined} />
        </button>
      </div>

      <div className="card">
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 0 }}>
          <input
            className="input"
            style={{ maxWidth: 320 }}
            placeholder={t.cardHistory.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
            <div>{t.common.loading}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <CreditCard size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
            <div>{t.cardHistory.noData}</div>
          </div>
        ) : (
          <div style={{ padding: '0 0 8px' }}>
            {filtered.map(entry => {
              const SourceIcon = SOURCE_ICON[entry.source] ?? HistoryIcon
              const isAssigned = entry.action === 'ASSIGNED'
              return (
                <div
                  key={entry.id}
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    gap: 16,
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                    background: isAssigned ? '#10B981' : 'var(--danger)',
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                        {entry.workerName ?? '—'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(entry.createdAt).toLocaleString(undefined, { timeZone: 'Europe/Moscow' })}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, alignItems: 'center' }}>
                      <span style={{ color: isAssigned ? '#10B981' : 'var(--danger)', fontWeight: 600 }}>
                        {isAssigned
                          ? `✓ ${t.workerDetail.cardAttached}${entry.newCardUid ? ` (${entry.newCardUid})` : ''}`
                          : `✕ ${t.workerDetail.cardRemoved}${entry.previousCardUid ? ` (${entry.previousCardUid})` : ''}`}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12 }}>
                        <SourceIcon size={12} /> {sourceLabel(t, entry.source)}
                        {entry.changedBy ? ` — ${entry.changedBy}` : ''}
                      </span>
                    </div>

                    {entry.note && (
                      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        "{entry.note}"
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
