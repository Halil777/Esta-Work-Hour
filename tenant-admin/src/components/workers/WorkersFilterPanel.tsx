import { useEffect, useRef, useState } from "react";
import { ChevronDown, Filter as FilterIcon, Search, WifiOff, X } from "lucide-react";
import type { MobileRole } from "../../api/workers";
import type { ForemanApi } from "../../api/foremans";
import type { WorkerStatus } from "../../types/tenant";
import { MOBILE_ROLES, WORKER_STATUSES } from "../../domain/workerMeta";
import { useTranslation } from "../../i18n/useTranslation";

export type WorkerStatusFilter = WorkerStatus | "all";
export type WorkerRoleFilter = MobileRole | "all";

type WorkersFilterPanelProps = {
  search: string;
  onSearchChange: (value: string) => void;
  foremans: ForemanApi[];
  foremanFilter: string;
  onForemanFilterChange: (value: string) => void;
  roleFilter: WorkerRoleFilter;
  onRoleFilterChange: (value: WorkerRoleFilter) => void;
  mesaiSistemi: string;
  onMesaiSistemiChange: (value: string) => void;
  statusFilter: WorkerStatusFilter;
  onStatusFilterChange: (value: WorkerStatusFilter) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  noScanFilter: boolean;
  onNoScanFilterChange: (value: boolean) => void;
  hasScanFilter: boolean;
  onHasScanFilterChange: (value: boolean) => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  totalCount: number;
  searchPlaceholder: string;
  allLabel: string;
  totalCountLabel: string;
  statusLabel: (status: WorkerStatus) => string;
  onClearFilters: () => void;
  onApplyTodayHasScan: () => void;
  onApplyActiveWorkers: () => void;
};

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
  hasScanFilter,
  onApplyTodayHasScan,
  activeFilterCount,
  hasActiveFilters,
  totalCount,
  searchPlaceholder,
  allLabel,
  totalCountLabel,
  statusLabel,
  onClearFilters,
  onApplyActiveWorkers,
}: WorkersFilterPanelProps) {
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Secondary filters that live behind the "Filters" popover instead of
  // taking up permanent space in the toolbar — date range, overtime system,
  // and the no-scan checkbox are used far less often than search/foreman/role/status.
  const moreFilterCount = [
    mesaiSistemi !== "all",
    Boolean(startDate || endDate),
    noScanFilter,
  ].filter(Boolean).length;

  useEffect(() => {
    if (!showMore) return;
    const onDocClick = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setShowMore(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showMore]);

  const mesaiLabel = mesaiSistemi === "Saatlik" ? t.workers.mesaiHourly
    : mesaiSistemi === "Aylık" ? t.workers.mesaiMonthly
    : null;

  return (
    <div>
      <div className="filter-toolbar">
        <div className="filter-search">
          <Search size={14} />
          <input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <div className={`filter-pill${foremanFilter !== "all" ? " filter-pill--active" : ""}`}>
          <span className="filter-pill__label">{t.workers.pillForeman}</span>
          <select
            value={foremanFilter}
            onChange={(event) => onForemanFilterChange(event.target.value)}
          >
            <option value="all">{t.workers.allForemenFilter}</option>
            {foremans.map((foreman) => (
              <option key={foreman.id} value={foreman.id}>{foreman.name}</option>
            ))}
          </select>
          <ChevronDown className="filter-pill__chev" />
        </div>

        <div className={`filter-pill${roleFilter !== "all" ? " filter-pill--active" : ""}`}>
          <span className="filter-pill__label">{t.workers.pillRole}</span>
          <select
            value={roleFilter}
            onChange={(event) => onRoleFilterChange(event.target.value as WorkerRoleFilter)}
          >
            <option value="all">{t.workers.allRoles}</option>
            {MOBILE_ROLES.map((role) => {
              const roleLabel: Record<string, string> = {
                worker: t.workers.roleWorker,
                foreman: t.workers.roleForeman,
                site_chief: t.workers.roleSiteChief,
                section_chief: t.workers.roleSectionChief,
              };
              return <option key={role} value={role}>{roleLabel[role] ?? role}</option>;
            })}
          </select>
          <ChevronDown className="filter-pill__chev" />
        </div>

        <div className={`filter-pill${statusFilter !== "all" ? " filter-pill--active" : ""}`}>
          <span className="filter-pill__label">{t.common.status}</span>
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as WorkerStatusFilter)}
          >
            <option value="all">{allLabel}</option>
            {WORKER_STATUSES.map((status) => (
              <option key={status} value={status}>{statusLabel(status)}</option>
            ))}
          </select>
          <ChevronDown className="filter-pill__chev" />
        </div>

        <div ref={moreRef} style={{ position: "relative" }}>
          <button
            type="button"
            className={`filter-more-btn${moreFilterCount > 0 ? " filter-more-btn--active" : ""}`}
            onClick={() => setShowMore((v) => !v)}
          >
            <FilterIcon size={13} />
            {t.workers.moreFiltersLabel}
            {moreFilterCount > 0 && <span className="filter-more-btn__count">{moreFilterCount}</span>}
          </button>

          {showMore && (
            <div className="filter-popover">
              <div className="filter-popover__field">
                <label>{t.workers.dateRangeLabel}</label>
                <div className="filter-popover__row">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => onStartDateChange(event.target.value)}
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => onEndDateChange(event.target.value)}
                  />
                </div>
              </div>
              <div className="filter-popover__field">
                <label>{t.workers.overtimeSystem}</label>
                <select
                  style={{ width: "100%" }}
                  value={mesaiSistemi}
                  onChange={(event) => onMesaiSistemiChange(event.target.value)}
                >
                  <option value="all">{t.workers.allMesai}</option>
                  <option value="Saatlik">{t.workers.mesaiHourly}</option>
                  <option value="Aylık">{t.workers.mesaiMonthly}</option>
                </select>
              </div>
              <label className="filter-popover__check">
                <input
                  type="checkbox"
                  checked={noScanFilter}
                  onChange={(event) => onNoScanFilterChange(event.target.checked)}
                />
                <WifiOff size={13} style={{ color: noScanFilter ? "var(--danger)" : "var(--text-muted)" }} />
                {t.workers.noScanLabel}
              </label>
            </div>
          )}
        </div>

        <span className="text-xs text-muted" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
          {totalCount} {totalCountLabel}
        </span>
      </div>

      {hasActiveFilters && (
        <div className="active-filters">
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
            {t.workers.activeFiltersLabel}
          </span>
          {search && (
            <span className="active-filter-chip">
              "{search}"
              <button type="button" onClick={() => onSearchChange("")}><X size={11} /></button>
            </span>
          )}
          {mesaiLabel && (
            <span className="active-filter-chip">
              {mesaiLabel}
              <button type="button" onClick={() => onMesaiSistemiChange("all")}><X size={11} /></button>
            </span>
          )}
          {(startDate || endDate) && (
            <span className="active-filter-chip">
              {t.workers.dateRangeLabel}: {startDate || "…"} → {endDate || "…"}
              <button type="button" onClick={() => { onStartDateChange(""); onEndDateChange(""); }}><X size={11} /></button>
            </span>
          )}
          {noScanFilter && (
            <span className="active-filter-chip">
              {t.workers.noScanLabel}
              <button type="button" onClick={() => onNoScanFilterChange(false)}><X size={11} /></button>
            </span>
          )}
          <button type="button" className="clear-all-link" onClick={onClearFilters}>
            {t.workers.clearAllLabel} ({activeFilterCount})
          </button>
        </div>
      )}

      <div className="filter-quickrow" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "10px 14px" }}>
        <button
          className={`quick-chip${statusFilter === "Active" ? " active" : ""}`}
          type="button"
          onClick={onApplyActiveWorkers}
        >
          {t.workers.quickFilterActive}
        </button>
        <button
          className={`quick-chip${hasScanFilter ? " active" : ""}`}
          type="button"
          onClick={onApplyTodayHasScan}
        >
          {t.workers.quickFilterHasScan}
        </button>
        <button
          className={`quick-chip${roleFilter === "foreman" ? " active" : ""}`}
          type="button"
          onClick={() => onRoleFilterChange("foreman")}
        >
          Foremen
        </button>
        <button
          className={`quick-chip${roleFilter === "site_chief" ? " active" : ""}`}
          type="button"
          onClick={() => onRoleFilterChange("site_chief")}
        >
          Site Chief
        </button>
      </div>
    </div>
  );
}
