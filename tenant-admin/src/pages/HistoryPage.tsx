import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Edit2, Trash2, Plus, Search, AlertTriangle } from "lucide-react";
import { auditLogApi } from "../api/auditLog";
import { anomaliesApi } from "../api/anomaliesApi";
import { useTranslation } from "../i18n/useTranslation";

const actionColor = (action: string) => {
  if (action === "CREATE") return "#10B981";
  if (action === "UPDATE") return "#6366F1";
  return "#EF4444";
};

const actionIcon = (action: string) => {
  if (action === "CREATE") return <Plus size={12} />;
  if (action === "UPDATE") return <Edit2 size={12} />;
  return <Trash2 size={12} />;
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

const IGNORED_FIELDS = new Set(["createdAt", "updatedAt"]);

function DiffView({ before, after, action }: { before: any; after: any; action: string }) {
  if (action === "CREATE") {
    const name = after?.name;
    return name ? <span style={{ color: "#10B981", fontSize: 12 }}>+{name}</span> : null;
  }
  if (action === "DELETE") {
    const name = before?.name;
    return name ? <span style={{ color: "#EF4444", fontSize: 12, textDecoration: "line-through" }}>{name}</span> : null;
  }

  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changed: { field: string; before: any; after: any }[] = [];

  for (const field of fields) {
    if (IGNORED_FIELDS.has(field)) continue;
    const b = before?.[field];
    const a = after?.[field];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changed.push({ field, before: b, after: a });
    }
  }

  if (changed.length === 0) return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>;

  return (
    <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
      {changed.map((c) => (
        <div key={c.field}>
          <span style={{ color: "var(--text-muted)", marginRight: 4 }}>{c.field}:</span>
          {c.before !== undefined && c.before !== null && (
            <span style={{ color: "#EF4444", textDecoration: "line-through", marginRight: 6 }}>
              {String(c.before)}
            </span>
          )}
          {c.after !== undefined && c.after !== null && (
            <span style={{ color: "#10B981" }}>{String(c.after)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function MissingCheckInTab() {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ["anomalies-missing-checkin", date],
    queryFn: () => anomaliesApi.getMissingCheckIn(date),
    staleTime: 60_000,
  });

  const fmtTime = (ms: number) =>
    ms ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="card">
      <div className="card-header">
        <div className="filters-bar">
          <label style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            {t.anomaly.filterDate}
            <input
              type="date"
              className="filter-select"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </label>
        </div>
        {data && (
          <span className="text-xs text-muted">{data.count} {t.anomaly.colWorker.toLowerCase()}(s)</span>
        )}
      </div>
      <div className="card-body card-body--p0">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.anomaly.colWorker}</th>
                <th>{t.anomaly.colTeam}</th>
                <th>{t.anomaly.colCheckout}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={3}><div className="empty-state"><p>{t.common.loading}</p></div></td></tr>
              ) : !data || data.workers.length === 0 ? (
                <tr><td colSpan={3}><div className="empty-state"><AlertTriangle size={28} style={{ color: "#94a3b8" }} /><p>{t.anomaly.noAnomalies}</p></div></td></tr>
              ) : (
                data.workers.map(w => (
                  <tr key={w.workerId}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{w.name} <span className="td-muted" style={{ fontSize: 11, marginLeft: 6 }}>{w.workerId}</span></td>
                    <td style={{ fontSize: 13, color: "var(--text-muted)" }}>{w.team || "—"}</td>
                    <td style={{ fontSize: 13, color: "#d97706", fontWeight: 600 }}>{fmtTime(w.checkOutTime)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function HistoryPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"audit" | "missing">("missing");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<"ALL" | "CREATE" | "UPDATE" | "DELETE">("ALL");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => auditLogApi.list(500),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const filtered = logs.filter((log) => {
    if (actionFilter !== "ALL" && log.action !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = (log.before?.name || log.after?.name || "").toLowerCase();
      const by = log.changedBy.toLowerCase();
      const id = log.entityId.toLowerCase();
      if (!name.includes(q) && !by.includes(q) && !id.includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      <div className="page-header">
        <h1 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <History size={20} /> {t.historyPage.title}
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["missing", "audit"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              border: "1px solid",
              borderColor: activeTab === tab ? "var(--brand-primary)" : "var(--bg-border)",
              background: activeTab === tab ? "var(--brand-primary)" : "transparent",
              color: activeTab === tab ? "#fff" : "var(--text-muted)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {tab === "missing" && <AlertTriangle size={13} />}
            {tab === "missing" ? t.anomaly.tabMissingCheckin : t.anomaly.tabAuditLog}
          </button>
        ))}
      </div>

      {activeTab === "missing" && <MissingCheckInTab />}

      {activeTab === "audit" && <div className="card">
        <div className="card-header">
          <div className="filters-bar">
            <div className="input-wrap">
              <Search size={14} />
              <input
                className="search-input"
                placeholder={t.historyPage.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className="filter-select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value as any)}>
              <option value="ALL">{t.historyPage.allActions}</option>
              <option value="CREATE">{t.historyPage.created}</option>
              <option value="UPDATE">{t.historyPage.updated}</option>
              <option value="DELETE">{t.historyPage.deleted}</option>
            </select>
          </div>
          <span className="text-xs text-muted">{filtered.length} {t.historyPage.records}</span>
        </div>

        <div className="card-body card-body--p0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.historyPage.colTime}</th>
                  <th>{t.historyPage.colAction}</th>
                  <th>{t.historyPage.colWorker}</th>
                  <th>{t.historyPage.colBy}</th>
                  <th>{t.historyPage.colChanges}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5}><div className="empty-state"><p>{t.common.loading}</p></div></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state"><History size={32} /><p>{t.historyPage.noData}</p></div></td></tr>
                ) : (
                  filtered.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(log.changedAt)}</td>
                      <td>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 8px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                          color: actionColor(log.action),
                          background: `${actionColor(log.action)}20`,
                        }}>
                          {actionIcon(log.action)}
                          {log.action === "CREATE" ? t.historyPage.created : log.action === "UPDATE" ? t.historyPage.updated : t.historyPage.deleted}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        <span style={{ fontWeight: 600 }}>
                          {log.before?.name || log.after?.name || "—"}
                        </span>
                        <span className="td-muted" style={{ marginLeft: 6, fontSize: 11 }}>
                          {log.before?.workerId || log.after?.workerId}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{log.changedBy}</td>
                      <td>
                        <DiffView before={log.before} after={log.after} action={log.action} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>}
    </>
  );
}
