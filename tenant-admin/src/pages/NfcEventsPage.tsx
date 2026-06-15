import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScanLine, RefreshCw, LogIn, LogOut, Clock, Link2 } from "lucide-react";
import {
  attendanceEventsApi,
  type AttendanceEventRecord,
  type DailySummaryRecord,
} from "../api/attendanceEvents";
import { workersApi, type WorkerApi } from "../api/workers";

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

const fmtTimeShort = (ts: number) =>
  new Date(ts).toLocaleString("ru-RU", {
    hour: "2-digit", minute: "2-digit",
  });

const fmtDuration = (ms: number) => {
  if (!ms || ms <= 0) return "—";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} sag`;
  return `${h} sag ${m} min`;
};

const today = () => new Date().toISOString().split("T")[0];

type Tab = "events" | "summary";

function LinkCardModal({
  cardUid,
  onClose,
  onLinked,
}: {
  cardUid: string;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: workers = [] } = useQuery({
    queryKey: ["workers-for-card-link"],
    queryFn: () => workersApi.list(),
    staleTime: 30_000,
  });

  const filtered = workers.filter(
    (w) =>
      !search ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.workerId.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = async (worker: WorkerApi) => {
    setSaving(true);
    try {
      await workersApi.update(worker.id, { nfcCardUid: cardUid }, "Admin");
      onLinked();
      onClose();
    } catch (e: any) {
      alert("Ýalňyşlyk: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, width: 460, maxWidth: "95vw", maxHeight: "80vh", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>Karta UID bellemek</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>{cardUid}</p>
          </div>
          <button className="btn btn--secondary btn--sm" onClick={onClose}>✕</button>
        </div>
        <input
          className="input"
          placeholder="Işçi gözle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.map((w) => (
            <button
              key={w.id}
              className="btn btn--secondary"
              style={{ justifyContent: "flex-start", textAlign: "left", padding: "8px 12px" }}
              onClick={() => handleAssign(w)}
              disabled={saving}
            >
              <span style={{ fontWeight: 600 }}>{w.name}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 12, marginLeft: 8 }}>{w.workerId}</span>
              {w.nfcCardUid && (
                <span style={{ color: "#F59E0B", fontSize: 11, marginLeft: 8 }}>⚠ başga karta bar</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventsTab({ date }: { date: string }) {
  const qc = useQueryClient();
  const [linkCardUid, setLinkCardUid] = useState<string | null>(null);
  const { data: events = [], isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["nfc-events", date],
    queryFn: () => attendanceEventsApi.list({ date: date || undefined, limit: 500 }),
    refetchInterval: 10_000,
    staleTime: 8_000,
  });

  return (
    <>
      {linkCardUid && (
        <LinkCardModal
          cardUid={linkCardUid}
          onClose={() => setLinkCardUid(null)}
          onLinked={() => { qc.invalidateQueries({ queryKey: ["nfc-events"] }); qc.invalidateQueries({ queryKey: ["workers-for-card-link"] }); }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        {dataUpdatedAt > 0 && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Täzelenen: {new Date(dataUpdatedAt).toLocaleTimeString()}
          </span>
        )}
        <button className="btn btn--secondary btn--sm" onClick={() => refetch()} style={{ marginLeft: "auto" }}>
          <RefreshCw size={13} /> Täzele
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "12px 16px", color: "#EF4444", marginBottom: 16 }}>
          Backend bağlantısı yok. Backend çalışıyor mu?
        </div>
      )}

      <div className="card">
        <div className="card-body card-body--p0">
          {isLoading ? (
            <div className="empty-state">Ýüklenýär…</div>
          ) : events.length === 0 ? (
            <div className="empty-state">Bu gün wakalar ýok.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Işçi ady</th>
                    <th>Taб. №</th>
                    <th>Karta UID</th>
                    <th>Görnüşi</th>
                    <th>Wagt</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(events as AttendanceEventRecord[]).map((ev, i) => {
                    const unknown = !ev.employeeNumber || ev.workerName === ev.employeeNumber || ev.workerName === "Unknown";
                    return (
                      <tr key={ev.id} style={unknown ? { background: "rgba(239,68,68,0.04)" } : undefined}>
                        <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{i + 1}</td>
                        <td style={{ fontWeight: 600, color: unknown ? "#EF4444" : undefined }}>
                          {unknown ? "⚠ Näbelli" : ev.workerName}
                        </td>
                        <td style={{ color: "var(--text-secondary)" }}>{ev.employeeNumber || "—"}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)" }}>{ev.cardUid}</td>
                        <td>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                            background: ev.eventType === "CHECK_IN" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                            color: ev.eventType === "CHECK_IN" ? "#10B981" : "#F59E0B",
                          }}>
                            {ev.eventType === "CHECK_IN" ? <><LogIn size={12} /> Giriş</> : <><LogOut size={12} /> Çykyş</>}
                          </span>
                        </td>
                        <td style={{ fontSize: 13 }}>{fmtTime(ev.eventTime)}</td>
                        <td>
                          {unknown && (
                            <button
                              className="btn btn--secondary btn--sm"
                              style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}
                              onClick={() => setLinkCardUid(ev.cardUid)}
                            >
                              <Link2 size={11} /> Işçä bellemek
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SummaryTab({ date }: { date: string }) {
  const { data: summary = [], isLoading, error, refetch } = useQuery({
    queryKey: ["nfc-daily-summary", date],
    queryFn: () => attendanceEventsApi.dailySummary(date || undefined),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button className="btn btn--secondary btn--sm" onClick={() => refetch()}>
          <RefreshCw size={13} /> Täzele
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "12px 16px", color: "#EF4444", marginBottom: 16 }}>
          Backend bağlantısı yok.
        </div>
      )}

      <div className="card">
        <div className="card-body card-body--p0">
          {isLoading ? (
            <div className="empty-state">Ýüklenýär…</div>
          ) : summary.length === 0 ? (
            <div className="empty-state">Bu gün maglumat ýok.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Işçi ady</th>
                    <th>Taб. №</th>
                    <th>Seanslary</th>
                    <th style={{ color: "#6366F1" }}>⏱ Jemi işlän wagty</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary as DailySummaryRecord[]).map((row, i) => (
                    <tr key={row.employeeNumber}>
                      <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{row.workerName}</td>
                      <td style={{ color: "var(--text-secondary)" }}>{row.employeeNumber}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {row.sessions.map((s, si) => (
                            <div key={si} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                              <span style={{ color: "#10B981", display: "inline-flex", alignItems: "center", gap: 2 }}>
                                <LogIn size={11} /> {fmtTimeShort(s.checkIn)}
                              </span>
                              <span style={{ color: "var(--text-muted)" }}>→</span>
                              {s.checkOut ? (
                                <span style={{ color: "#F59E0B", display: "inline-flex", alignItems: "center", gap: 2 }}>
                                  <LogOut size={11} /> {fmtTimeShort(s.checkOut)}
                                  <span style={{ color: "var(--text-muted)", marginLeft: 2 }}>
                                    ({fmtDuration(s.checkOut - s.checkIn)})
                                  </span>
                                </span>
                              ) : (
                                <span style={{ color: "#10B981", fontSize: 11 }}>işde</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#6366F1", fontSize: 14 }}>
                          <Clock size={13} style={{ marginRight: 4 }} />
                          {fmtDuration(row.totalMs)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function NfcEventsPage() {
  const [tab, setTab] = useState<Tab>("summary");
  const [date, setDate] = useState(today());

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ScanLine size={22} /> NFC Gatnaw Žurnaly
          </h1>
          <p className="page-subtitle">Android planşetden geçen NFC geçişleri</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["summary", "events"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`btn btn--sm ${tab === t ? "btn--primary" : "btn--secondary"}`}
            onClick={() => setTab(t)}
          >
            {t === "summary" ? "Günlük Jemi" : "Ähli Skanlar"}
          </button>
        ))}
      </div>

      {tab === "summary" ? <SummaryTab date={date} /> : <EventsTab date={date} />}
    </div>
  );
}
