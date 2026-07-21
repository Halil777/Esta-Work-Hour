import { Search, SlidersHorizontal, WifiOff, X } from 'lucide-react'
import type { MobileRole } from '../../api/workers'
import type { ForemanApi } from '../../api/foremans'
import type { WorkerStatus } from '../../types/tenant'
import { MOBILE_ROLES, ROLE_LABELS, WORKER_STATUSES } from '../../domain/workerMeta'

export type WorkerStatusFilter = WorkerStatus | 'all'
export type WorkerRoleFilter = MobileRole | 'all'

type WorkersFilterPanelProps = {
  search: string
  onSearchChange: (value: string) => void
  foremans: ForemanApi[]
  foremanFilter: string
  onForemanFilterChange: (value: string) => void
  roleFilter: WorkerRoleFilter
  onRoleFilterChange: (value: WorkerRoleFilter) => void
  mesaiSistemi: string
  onMesaiSistemiChange: (value: string) => void
  statusFilter: WorkerStatusFilter
  onStatusFilterChange: (value: WorkerStatusFilter) => void
  startDate: string
  onStartDateChange: (value: string) => void
  endDate: string
  onEndDateChange: (value: string) => void
  noScanFilter: boolean
  onNoScanFilterChange: (value: boolean) => void
  activeFilterCount: number
  hasActiveFilters: boolean
  totalCount: number
  searchPlaceholder: string
  allLabel: string
  totalCountLabel: string
  statusLabel: (status: WorkerStatus) => string
  onClearFilters: () => void
  onApplyTodayNoScan: () => void
  onApplyActiveWorkers: () => void
}

export function WorkersFilterPanel({
  search,
  onSearchChange,
  foremans,
  foremanFilter,
  onForemanFilterChange,
  roleFilter,
  onRoleFilterChange,
  mesaiSistemi,
  onMesaiSistemiChange,
  statusFilter,
  onStatusFilterChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  noScanFilter,
  onNoScanFilterChange,
  activeFilterCount,
  hasActiveFilters,
  totalCount,
  searchPlaceholder,
  allLabel,
  totalCountLabel,
  statusLabel,
  onClearFilters,
  onApplyTodayNoScan,
  onApplyActiveWorkers,
}: WorkersFilterPanelProps) {
  return (
    <div className="card-header filter-panel">
      <div className="filter-row">
        <span className="ops-pill"><SlidersHorizontal size={13} />Filtr</span>
        <div className="input-wrap">
          <Search size={14} />
          <input
            className="search-input"
            placeholder={searchPlaceholder}
            value={search}
            onChange={event => onSearchChange(event.target.value)}
          />
        </div>
        <select className="filter-select" value={foremanFilter} onChange={event => onForemanFilterChange(event.target.value)}>
          <option value="all">Ähli foremen</option>
          {foremans.map(foreman => <option key={foreman.id} value={foreman.id}>{foreman.name}</option>)}
        </select>
        <select className="filter-select" value={roleFilter} onChange={event => onRoleFilterChange(event.target.value as WorkerRoleFilter)}>
          <option value="all">Ähli rollar</option>
          {MOBILE_ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
        </select>
        <select className="filter-select" value={mesaiSistemi} onChange={event => onMesaiSistemiChange(event.target.value)}>
          <option value="all">Ähli mesai</option>
          <option value="Saatlik">Saatlik</option>
          <option value="Aylık">Aylık</option>
        </select>
        <select className="filter-select" value={statusFilter} onChange={event => onStatusFilterChange(event.target.value as WorkerStatusFilter)}>
          <option value="all">{allLabel}</option>
          {WORKER_STATUSES.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}
        </select>
      </div>

      <div className="filter-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Sene:</label>
          <input
            type="date"
            className="filter-select"
            style={{ width: 136 }}
            value={startDate}
            onChange={event => onStartDateChange(event.target.value)}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>
          <input
            type="date"
            className="filter-select"
            style={{ width: 136 }}
            value={endDate}
            onChange={event => onEndDateChange(event.target.value)}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13, userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={noScanFilter}
            onChange={event => onNoScanFilterChange(event.target.checked)}
            style={{ width: 14, height: 14 }}
          />
          <WifiOff size={13} style={{ color: noScanFilter ? 'var(--danger)' : 'var(--text-muted)' }} />
          <span style={{ color: noScanFilter ? 'var(--danger)' : 'var(--text-muted)' }}>NFC skan ýok</span>
        </label>
        <div className="quick-filter-row">
          <button className={`quick-chip${statusFilter === 'Active' ? ' active' : ''}`} type="button" onClick={onApplyActiveWorkers}>
            Aktiw
          </button>
          <button className={`quick-chip${noScanFilter ? ' active' : ''}`} type="button" onClick={onApplyTodayNoScan}>
            Şu gün skan ýok
          </button>
          <button className={`quick-chip${roleFilter === 'foreman' ? ' active' : ''}`} type="button" onClick={() => onRoleFilterChange('foreman')}>
            Foremen
          </button>
          <button className={`quick-chip${roleFilter === 'site_chief' ? ' active' : ''}`} type="button" onClick={() => onRoleFilterChange('site_chief')}>
            Site Chief
          </button>
        </div>
        {hasActiveFilters && (
          <button className="btn btn--ghost btn--sm" type="button" onClick={onClearFilters} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            <X size={12} /> Filtr arassala ({activeFilterCount})
          </button>
        )}
        <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
          {totalCount} {totalCountLabel}
        </span>
      </div>
    </div>
  )
}
