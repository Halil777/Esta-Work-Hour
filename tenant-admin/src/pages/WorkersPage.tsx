import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Download, History, Plus, Upload, X } from 'lucide-react'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { foremansApi } from '../api/foremans'
import { shiftSettingsApi } from '../api/shiftSettings'
import {
  workersApi,
  type MobileRole,
  type TerminateWorkerPayload,
  type WorkerApi,
} from '../api/workers'
import { CredentialModal } from '../components/workers/CredentialAccess'
import { WorkerCardImportModal } from '../components/workers/WorkerCardImportModal'
import { WorkerDirectoryTable } from '../components/workers/WorkerDirectoryTable'
import { WorkerFormModal, type WorkerForm } from '../components/workers/WorkerFormModal'
import { WorkerImportModal } from '../components/workers/WorkerImportModal'
import { WorkerLifecycleReportHistoryModal } from '../components/workers/WorkerLifecycleReportHistoryModal'
import { WorkerMetricsStrip } from '../components/workers/WorkerMetricsStrip'
import { WorkerTerminationModal } from '../components/workers/WorkerTerminationModal'
import { WorkersFilterPanel } from '../components/workers/WorkersFilterPanel'
import { useTranslation } from '../i18n/useTranslation'
import { MOBILE_ROLES, WORKER_STATUSES } from '../domain/workerMeta'
import type { WorkerStatus } from '../types/tenant'
import { todayIso } from '../utils/dateTime'
import { useDebouncedValue } from '../utils/useDebouncedValue'
import { exportWorkersToExcel } from '../utils/exportWorkersExcel'

export function WorkersPage() {
  const { t } = useTranslation()
  const { user, language } = useUiPreferences()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const adminName = user?.name ?? 'Admin'

  const [search, setSearch] = useState('')
  const [mesaiSistemi, setMesaiSistemi] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<WorkerStatus | 'all'>('all')
  const [foremanFilter, setForemanFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<MobileRole | 'all'>('all')
  const [shiftFilter, setShiftFilter] = useState<'all' | 'day' | 'night'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [noScanFilter, setNoScanFilter] = useState(false)
  const [hasScanFilter, setHasScanFilter] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editWorker, setEditWorker] = useState<WorkerApi | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showCardImport, setShowCardImport] = useState(false)
  const [showReportHistory, setShowReportHistory] = useState(false)
  const [credentialWorker, setCredentialWorker] = useState<WorkerApi | null>(null)
  const [terminateWorker, setTerminateWorker] = useState<WorkerApi | null>(null)

  // Bulk selection — scoped to whatever the current filters show. Cleared
  // automatically below whenever the filters change, so a selection never
  // silently carries over rows that have scrolled out of view.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<WorkerStatus>('Active')
  const [bulkRole, setBulkRole] = useState<MobileRole>('worker')

  const { data: foremans = [] } = useQuery({
    queryKey: ['foremans'],
    queryFn: foremansApi.list,
    staleTime: 60_000,
  })

  // Debounced so typing in the search box doesn't fire a request per
  // keystroke — the input itself stays bound to `search` so it feels instant.
  const debouncedSearch = useDebouncedValue(search, 300)

  const { data: workers = [], isLoading, error } = useQuery({
    queryKey: ['workers', debouncedSearch, mesaiSistemi, statusFilter, foremanFilter, roleFilter, shiftFilter, startDate, endDate, noScanFilter, hasScanFilter],
    queryFn: () => workersApi.list({
      search: debouncedSearch || undefined,
      mesaiSistemi: mesaiSistemi !== 'all' ? mesaiSistemi : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      foremanId: foremanFilter !== 'all' ? foremanFilter : undefined,
      mobileRole: roleFilter !== 'all' ? roleFilter : undefined,
      shift: shiftFilter !== 'all' ? shiftFilter : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      noScan: noScanFilter || undefined,
      hasScan: hasScanFilter || undefined,
    }),
    refetchInterval: 30_000,
    staleTime: 15_000,
    // Keep showing the previous filter/tab's rows while the new ones load,
    // instead of flashing to a blank loading state on every tab/filter click.
    placeholderData: keepPreviousData,
  })

  // Shift start/end times shown on the tabs come from Settings → Shift Settings
  // (manually editable there). Falls back to 06:30–19:30 / 19:30–06:30 while loading.
  const { data: shiftSettings = [] } = useQuery({
    queryKey: ['shift-settings'],
    queryFn: shiftSettingsApi.getAll,
    staleTime: 60_000,
  })
  const dayShift = shiftSettings.find(s => s.shiftType === 'day')
  const nightShift = shiftSettings.find(s => s.shiftType === 'night')
  const dayShiftLabel = `${dayShift?.startTime ?? '06:30'}–${dayShift?.endTime ?? '19:30'}`
  const nightShiftLabel = `${nightShift?.startTime ?? '19:30'}–${nightShift?.endTime ?? '06:30'}`

  const { data: lifecycleSummary } = useQuery({
    queryKey: ['worker-lifecycle-pending-summary'],
    queryFn: workersApi.lifecyclePendingSummary,
    refetchInterval: 60_000,
    staleTime: 15_000,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['workers'] })
    queryClient.invalidateQueries({ queryKey: ['worker-lifecycle-pending-summary'] })
    queryClient.invalidateQueries({ queryKey: ['worker-lifecycle-reports'] })
  }

  const buildPayload = (form: WorkerForm) => ({
    ...form,
    shift: (form.shift || null) as 'day' | 'night' | null,
  })

  const createMutation = useMutation({
    mutationFn: (form: WorkerForm) => workersApi.create(buildPayload(form), adminName),
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: WorkerForm }) =>
      workersApi.update(id, buildPayload(form), adminName),
    onSuccess: invalidate,
  })

  const terminateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TerminateWorkerPayload }) =>
      workersApi.terminate(id, payload, adminName),
    onSuccess: () => {
      setTerminateWorker(null)
      invalidate()
    },
  })

  // Bulk status/role change reuses the same single-worker PATCH the edit
  // modal calls — every field on it is optional, so a payload with just
  // `{ status }` or `{ mobileRole }` is a valid partial update. Running it
  // per selected id keeps this a pure frontend feature with no new backend
  // endpoint needed.
  const bulkStatusMutation = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map(id => workersApi.update(id, { status: bulkStatus }, adminName))),
    onSuccess: () => { setSelectedIds(new Set()); invalidate() },
  })

  const bulkRoleMutation = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map(id => workersApi.update(id, { mobileRole: bulkRole }, adminName))),
    onSuccess: () => { setSelectedIds(new Set()); invalidate() },
  })

  const toggleSelect = (workerId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(workerId)) next.delete(workerId); else next.add(workerId)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const allSelected = workers.length > 0 && workers.every(w => prev.has(w.id))
      return allSelected ? new Set() : new Set(workers.map(w => w.id))
    })
  }

  // Selection is scoped to "what's currently on screen" — when the filters
  // change the set of visible rows, a stale selection would silently apply
  // bulk actions to workers the admin can no longer see, so clear it.
  useEffect(() => {
    setSelectedIds(new Set())
  }, [debouncedSearch, mesaiSistemi, statusFilter, foremanFilter, roleFilter, shiftFilter, startDate, endDate, noScanFilter, hasScanFilter])

  const activeFilterCount = [
    search,
    mesaiSistemi !== 'all',
    statusFilter !== 'all',
    foremanFilter !== 'all',
    roleFilter !== 'all',
    shiftFilter !== 'all',
    startDate,
    endDate,
    noScanFilter,
    hasScanFilter,
  ].filter(Boolean).length

  const clearFilters = () => {
    setSearch('')
    setMesaiSistemi('all')
    setStatusFilter('all')
    setForemanFilter('all')
    setRoleFilter('all')
    setShiftFilter('all')
    setStartDate('')
    setEndDate('')
    setNoScanFilter(false)
    setHasScanFilter(false)
  }

  const applyTodayHasScan = () => {
    const date = todayIso()
    setStartDate(date)
    setEndDate(date)
    setHasScanFilter(true)
    setNoScanFilter(false)
  }

  const applyActiveWorkers = () => {
    setStatusFilter('Active')
    setNoScanFilter(false)
    setHasScanFilter(false)
  }

  const statusLabel = (status: WorkerStatus) => t.status[status.toLowerCase() as keyof typeof t.status] ?? status
  const roleLabelMap: Record<string, string> = {
    worker: t.workers.roleWorker,
    foreman: t.workers.roleForeman,
    site_chief: t.workers.roleSiteChief,
    section_chief: t.workers.roleSectionChief,
  }

  return (
    <>
      <div className="page-header">
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1>{t.workers.title}</h1>
          <span className="page-kicker">{t.workers.workerDesc}</span>
        </div>
        <div className="page-actions">
          <button className="btn btn--secondary btn--sm" type="button" onClick={() => setShowImport(true)}>
            <Upload size={13} /> {t.common.import}
          </button>
          <button className="btn btn--secondary btn--sm" type="button" onClick={() => setShowCardImport(true)}>
            <Upload size={13} /> {t.workers.kartImport}
          </button>
          <button className="btn btn--secondary btn--sm" type="button" onClick={() => setShowReportHistory(true)}>
            <History size={13} /> {t.workers.reportHistory}
          </button>
          {/* Exports the rows already loaded for the table below — no second
              network round-trip or duplicate database query, so it's instant
              regardless of how "heavy" the underlying query used to be. */}
          <button className="btn btn--secondary btn--sm" type="button" onClick={() => exportWorkersToExcel(workers, language)}>
            <Download size={13} /> {t.common.export}
          </button>
          <button className="btn btn--primary btn--sm" type="button" onClick={() => setShowAdd(true)}>
            <Plus size={13} /> {t.workers.addWorker}
          </button>
        </div>
      </div>

      {/* Day / Night Shift Tabs — switches the table below to that shift's workers.
          Shift is set manually per worker (edit worker → Shift), so this just filters by it.
          Note: `workers` already reflects the active tab (shift is a server-side filter param,
          same as status/mesaiSistemi below), so we don't show a count here — it would only be
          correct for whichever tab is currently selected. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([
          { key: 'all' as const, label: t.common.all },
          { key: 'day' as const, label: `☀️ ${t.workers.dayShift} (${dayShiftLabel})` },
          { key: 'night' as const, label: `🌙 ${t.workers.nightShift} (${nightShiftLabel})` },
        ]).map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setShiftFilter(tab.key)}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: shiftFilter === tab.key ? 600 : 500,
              cursor: 'pointer',
              border: `1px solid ${shiftFilter === tab.key ? 'var(--accent)' : 'var(--border)'}`,
              background: shiftFilter === tab.key ? 'var(--accent)' : 'var(--bg-card)',
              color: shiftFilter === tab.key ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <WorkerMetricsStrip workers={workers} lifecycleSummary={lifecycleSummary} />

      <div className="card card--overflow-visible">
        <WorkersFilterPanel
          search={search}
          onSearchChange={setSearch}
          foremans={foremans}
          foremanFilter={foremanFilter}
          onForemanFilterChange={setForemanFilter}
          roleFilter={roleFilter}
          onRoleFilterChange={setRoleFilter}
          mesaiSistemi={mesaiSistemi}
          onMesaiSistemiChange={setMesaiSistemi}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
          noScanFilter={noScanFilter}
          onNoScanFilterChange={v => { setNoScanFilter(v); if (v) setHasScanFilter(false) }}
          hasScanFilter={hasScanFilter}
          onHasScanFilterChange={v => { setHasScanFilter(v); if (v) setNoScanFilter(false) }}
          activeFilterCount={activeFilterCount}
          hasActiveFilters={activeFilterCount > 0}
          totalCount={workers.length}
          searchPlaceholder={t.workers.searchPlaceholder}
          allLabel={t.common.all}
          totalCountLabel={t.workers.totalCount}
          statusLabel={statusLabel}
          onClearFilters={clearFilters}
          onApplyTodayHasScan={applyTodayHasScan}
          onApplyActiveWorkers={applyActiveWorkers}
        />

        {selectedIds.size > 0 && (
          <div className="bulk-action-bar">
            <span className="bulk-action-bar__count">
              {t.workers.bulkSelected.replace('{{n}}', String(selectedIds.size))}
            </span>

            <button
              className="btn btn--secondary btn--sm"
              type="button"
              onClick={() => exportWorkersToExcel(workers.filter(w => selectedIds.has(w.id)), language)}
            >
              <Download size={13} /> {t.workers.bulkExport}
            </button>

            <div className="bulk-action-bar__group">
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as WorkerStatus)}>
                {WORKER_STATUSES.map(status => (
                  <option key={status} value={status}>{statusLabel(status)}</option>
                ))}
              </select>
              <button
                className="btn btn--secondary btn--sm"
                type="button"
                disabled={bulkStatusMutation.isPending}
                onClick={() => bulkStatusMutation.mutate(Array.from(selectedIds))}
              >
                {t.common.apply}
              </button>
            </div>

            <div className="bulk-action-bar__group">
              <select value={bulkRole} onChange={e => setBulkRole(e.target.value as MobileRole)}>
                {MOBILE_ROLES.map(role => (
                  <option key={role} value={role}>{roleLabelMap[role] ?? role}</option>
                ))}
              </select>
              <button
                className="btn btn--secondary btn--sm"
                type="button"
                disabled={bulkRoleMutation.isPending}
                onClick={() => bulkRoleMutation.mutate(Array.from(selectedIds))}
              >
                {t.common.apply}
              </button>
            </div>

            <button
              className="btn btn--ghost btn--sm bulk-action-bar__spacer"
              type="button"
              onClick={() => setSelectedIds(new Set())}
            >
              <X size={12} /> {t.workers.bulkDeselect}
            </button>
          </div>
        )}

        <WorkerDirectoryTable
          workers={workers}
          isLoading={isLoading}
          error={error}
          loadingText={t.common.loading}
          noDataText={t.common.noData}
          onOpenDetail={workerId => navigate(`/workers/${workerId}`)}
          onCredential={setCredentialWorker}
          onEdit={setEditWorker}
          onTerminate={setTerminateWorker}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      </div>

      {showAdd && (
        <WorkerFormModal
          onClose={() => setShowAdd(false)}
          onSave={async form => { await createMutation.mutateAsync(form) }}
        />
      )}
      {editWorker && (
        <WorkerFormModal
          initial={editWorker}
          onClose={() => setEditWorker(null)}
          onSave={async form => { await updateMutation.mutateAsync({ id: editWorker.id, form }) }}
        />
      )}
      {showImport && (
        <WorkerImportModal
          onClose={() => setShowImport(false)}
          onDone={invalidate}
          changedBy={adminName}
        />
      )}
      {showCardImport && <WorkerCardImportModal onClose={() => setShowCardImport(false)} />}
      {showReportHistory && (
        <WorkerLifecycleReportHistoryModal
          onClose={() => setShowReportHistory(false)}
          onChanged={invalidate}
        />
      )}
      {credentialWorker && (
        <CredentialModal worker={credentialWorker} onClose={() => setCredentialWorker(null)} />
      )}
      {terminateWorker && (
        <WorkerTerminationModal
          worker={terminateWorker}
          onClose={() => setTerminateWorker(null)}
          onSubmit={async payload => {
            await terminateMutation.mutateAsync({ id: terminateWorker.id, payload })
          }}
        />
      )}
    </>
  )
}
