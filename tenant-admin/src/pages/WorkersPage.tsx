import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, History, Plus, Upload } from 'lucide-react'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { foremansApi } from '../api/foremans'
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
import type { WorkerStatus } from '../types/tenant'
import { todayIso } from '../utils/dateTime'

export function WorkersPage() {
  const { t } = useTranslation()
  const { user } = useUiPreferences()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const adminName = user?.name ?? 'Admin'

  const [search, setSearch] = useState('')
  const [mesaiSistemi, setMesaiSistemi] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<WorkerStatus | 'all'>('all')
  const [foremanFilter, setForemanFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<MobileRole | 'all'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [noScanFilter, setNoScanFilter] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editWorker, setEditWorker] = useState<WorkerApi | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showCardImport, setShowCardImport] = useState(false)
  const [showReportHistory, setShowReportHistory] = useState(false)
  const [credentialWorker, setCredentialWorker] = useState<WorkerApi | null>(null)
  const [terminateWorker, setTerminateWorker] = useState<WorkerApi | null>(null)

  const { data: foremans = [] } = useQuery({
    queryKey: ['foremans'],
    queryFn: foremansApi.list,
    staleTime: 60_000,
  })

  const { data: workers = [], isLoading, error } = useQuery({
    queryKey: ['workers', search, mesaiSistemi, statusFilter, foremanFilter, roleFilter, startDate, endDate, noScanFilter],
    queryFn: () => workersApi.list({
      search: search || undefined,
      mesaiSistemi: mesaiSistemi !== 'all' ? mesaiSistemi : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      foremanId: foremanFilter !== 'all' ? foremanFilter : undefined,
      mobileRole: roleFilter !== 'all' ? roleFilter : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      noScan: noScanFilter || undefined,
    }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

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

  const activeFilterCount = [
    search,
    mesaiSistemi !== 'all',
    statusFilter !== 'all',
    foremanFilter !== 'all',
    roleFilter !== 'all',
    startDate,
    endDate,
    noScanFilter,
  ].filter(Boolean).length

  const clearFilters = () => {
    setSearch('')
    setMesaiSistemi('all')
    setStatusFilter('all')
    setForemanFilter('all')
    setRoleFilter('all')
    setStartDate('')
    setEndDate('')
    setNoScanFilter(false)
  }

  const applyTodayNoScan = () => {
    const date = todayIso()
    setStartDate(date)
    setEndDate(date)
    setNoScanFilter(true)
  }

  const applyActiveWorkers = () => {
    setStatusFilter('Active')
    setNoScanFilter(false)
  }

  return (
    <>
      <div className="page-header">
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1>{t.workers.title}</h1>
          <span className="page-kicker">Sanaw, NFC ýagdaýy, mobile giriş we işçi lifecycle bir ýerde</span>
        </div>
        <div className="page-actions">
          <button className="btn btn--secondary btn--sm" type="button" onClick={() => setShowImport(true)}>
            <Upload size={13} /> {t.common.import}
          </button>
          <button className="btn btn--secondary btn--sm" type="button" onClick={() => setShowCardImport(true)}>
            <Upload size={13} /> Kart Import
          </button>
          <button className="btn btn--secondary btn--sm" type="button" onClick={() => setShowReportHistory(true)}>
            <History size={13} /> Report history
          </button>
          <button className="btn btn--secondary btn--sm" type="button" onClick={() => workersApi.exportExcel()}>
            <Download size={13} /> {t.common.export}
          </button>
          <button className="btn btn--primary btn--sm" type="button" onClick={() => setShowAdd(true)}>
            <Plus size={13} /> {t.workers.addWorker}
          </button>
        </div>
      </div>

      <WorkerMetricsStrip workers={workers} lifecycleSummary={lifecycleSummary} />

      <div className="card">
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
          onNoScanFilterChange={setNoScanFilter}
          activeFilterCount={activeFilterCount}
          hasActiveFilters={activeFilterCount > 0}
          totalCount={workers.length}
          searchPlaceholder={t.workers.searchPlaceholder}
          allLabel={t.common.all}
          totalCountLabel={t.workers.totalCount}
          statusLabel={status => t.status[status.toLowerCase() as keyof typeof t.status] ?? status}
          onClearFilters={clearFilters}
          onApplyTodayNoScan={applyTodayNoScan}
          onApplyActiveWorkers={applyActiveWorkers}
        />

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
