import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, WifiOff } from "lucide-react";
import { workersApi } from "../api/workers";
import { foremansApi } from "../api/foremans";
import { useTranslation } from "../i18n/useTranslation";

// Returns today's work date: if current hour >= 7 → today, else → yesterday
function getWorkDate(): string {
  const now = new Date();
  if (now.getHours() >= 7) {
    return now.toISOString().split("T")[0];
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

export function AbsentTodayPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [foremanFilter, setForemanFilter] = useState("all");

  const workDate = getWorkDate();

  const { data: foremans = [] } = useQuery({
    queryKey: ["foremans"],
    queryFn: foremansApi.list,
    staleTime: 60_000,
  });

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ["workers-absent", workDate, foremanFilter],
    queryFn: () =>
      workersApi.list({
        noScan: true,
        startDate: workDate,
        endDate: workDate,
        foremanId: foremanFilter !== "all" ? foremanFilter : undefined,
      }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const filtered = search
    ? workers.filter((w) => {
        const q = search.toLowerCase();
        return (
          w.name.toLowerCase().includes(q) ||
          w.workerId.toLowerCase().includes(q)
        );
      })
    : workers;

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <WifiOff size={20} style={{ color: "var(--danger)" }} />
          <h1>{t.absentPage.title}</h1>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {t.absentPage.workDate}: <strong>{workDate}</strong>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="filters-bar">
            <div className="input-wrap">
              <Search size={14} />
              <input
                className="search-input"
                placeholder={t.absentPage.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="filter-select"
              value={foremanFilter}
              onChange={(e) => setForemanFilter(e.target.value)}
            >
              <option value="all">{t.absentPage.allForemen}</option>
              {foremans.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-muted">
            {filtered.length} {t.absentPage.notScannedCount}
          </span>
        </div>

        <div className="card-body card-body--p0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.absentPage.regNo}</th>
                  <th>{t.absentPage.fullName}</th>
                  <th>{t.absentPage.profession}</th>
                  <th>{t.absentPage.team}</th>
                  <th>{t.absentPage.overtimeSystem}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">
                        <p>{t.common.loading}</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">
                        <WifiOff size={32} style={{ color: "var(--success)" }} />
                        <p style={{ color: "var(--success)" }}>
                          {t.absentPage.allScanned}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((w) => (
                    <tr key={w.id}>
                      <td className="td-mono">{w.workerId}</td>
                      <td className="fw-600">{w.name}</td>
                      <td className="td-muted" style={{ fontSize: 12 }}>
                        {w.profession || "—"}
                      </td>
                      <td className="td-muted" style={{ fontSize: 12 }}>
                        {w.brigadeName || "—"}
                      </td>
                      <td>
                        <span
                          className={`badge badge--dot ${
                            (w.mesaiSistemi ?? "Saatlik") === "Aylık"
                              ? "badge--info"
                              : "badge--success"
                          }`}
                        >
                          {(w.mesaiSistemi ?? "Saatlik") === "Aylık" ? t.workers.mesaiMonthly : t.workers.mesaiHourly}
                        </span>
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
