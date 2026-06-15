import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Edit2, Trash2, Plus, Search } from "lucide-react";
import { auditLogApi } from "../api/auditLog";

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

export function HistoryPage() {
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
          <History size={20} /> Üýtgeşme Taryhy
        </h1>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="filters-bar">
            <div className="input-wrap">
              <Search size={14} />
              <input
                className="search-input"
                placeholder="Ady, kim ýa-da ID boýunça..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className="filter-select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value as any)}>
              <option value="ALL">Ähli amallar</option>
              <option value="CREATE">Goşuldy</option>
              <option value="UPDATE">Üýtgedildi</option>
              <option value="DELETE">Pozuldy</option>
            </select>
          </div>
          <span className="text-xs text-muted">{filtered.length} ýazgy</span>
        </div>

        <div className="card-body card-body--p0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Wagt</th>
                  <th>Amal</th>
                  <th>Işçi</th>
                  <th>Kim tarapyndan</th>
                  <th>Üýtgeşmeler</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5}><div className="empty-state"><p>Ýüklenýär…</p></div></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state"><History size={32} /><p>Maglumat ýok</p></div></td></tr>
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
                          {log.action === "CREATE" ? "Goşuldy" : log.action === "UPDATE" ? "Üýtgedildi" : "Pozuldy"}
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
      </div>
    </>
  );
}
