import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LogIn, LogOut, Sun, Moon } from "lucide-react";
import { attendanceApi, type DaySummary } from "../api/attendance";

// ─── helpers ────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function firstDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function lastDay(d: Date): string {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

function fmtMs(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} sag`;
  return `${h}:${String(m).padStart(2, "0")} sag`;
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

// ─── types ──────────────────────────────────────────────────────────────────

type Preset = "bu-ay" | "onki-ay" | "son-3-ay" | "son-6-ay" | "bu-yyl" | "gecen-yyl" | "2-yyl" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "bu-ay",     label: "Bu aý"       },
  { key: "onki-ay",   label: "Öňki aý"     },
  { key: "son-3-ay",  label: "3 aý"        },
  { key: "son-6-ay",  label: "6 aý"        },
  { key: "bu-yyl",    label: "Bu ýyl"      },
  { key: "gecen-yyl", label: "Geçen ýyl"   },
  { key: "2-yyl",     label: "2 ýyl"       },
  { key: "custom",    label: "Öz sene"     },
];

function getRange(preset: Preset): { startDate: string; endDate: string } {
  const now = new Date();
  const t = todayStr();
  switch (preset) {
    case "bu-ay":     return { startDate: firstDay(now), endDate: t };
    case "onki-ay": { const lm = shiftMonths(now, -1); return { startDate: firstDay(lm), endDate: lastDay(lm) }; }
    case "son-3-ay":  return { startDate: firstDay(shiftMonths(now, -3)), endDate: t };
    case "son-6-ay":  return { startDate: firstDay(shiftMonths(now, -6)), endDate: t };
    case "bu-yyl":    return { startDate: `${now.getFullYear()}-01-01`, endDate: t };
    case "gecen-yyl": { const y = now.getFullYear() - 1; return { startDate: `${y}-01-01`, endDate: `${y}-12-31` }; }
    case "2-yyl":     return { startDate: `${now.getFullYear() - 2}-01-01`, endDate: t };
    default:          return { startDate: "", endDate: "" };
  }
}

// ─── Calendar ───────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Ýanwar","Fewral","Mart","Aprel","Maý","Iýun","Iýul","Awgust","Sentýabr","Oktýabr","Noýabr","Dekabr"];
const DOW_LABELS  = ["Du","Si","Ça","Pe","An","Şe","Ýe"];

function MonthCalendar({ month, year, days }: { month: number; year: number; days: DaySummary[] }) {
  const dayMap = new Map(days.map(d => [d.date, d]));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let startDow = new Date(year, month, 1).getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1;    // Mon=0

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const today = todayStr();

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
        {DOW_LABELS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", padding: "2px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const entry = dayMap.get(dateStr);
          const h = entry ? Math.floor(entry.totalMs / 3600000) : 0;
          const m = entry ? Math.floor((entry.totalMs % 3600000) / 60000) : 0;
          const hasWork = !!entry && entry.totalMs > 0;
          const isToday = dateStr === today;

          const bg = hasWork
            ? h >= 8 ? "var(--success-light)" : h >= 5 ? "#FFF7ED" : "var(--card2)"
            : "var(--card2)";
          const hourColor = h >= 8 ? "var(--success)" : h >= 5 ? "var(--warning, #F59E0B)" : "var(--text-muted)";

          return (
            <div key={day} style={{
              borderRadius: 6, padding: "5px 2px", textAlign: "center",
              background: bg,
              border: isToday ? "2px solid var(--primary)" : "1px solid var(--border)",
              minHeight: 52, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 2,
            }}>
              <span style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--primary)" : "var(--text)" }}>
                {day}
              </span>
              {hasWork ? (
                <span style={{ fontSize: 9, fontWeight: 600, color: hourColor }}>
                  {h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m}m`}
                </span>
              ) : (
                <span style={{ fontSize: 9, color: "var(--border)" }}>—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<string, string> = {
  Active: "badge--success", Inactive: "badge--neutral",
  Suspended: "badge--warning", Transferred: "badge--info", Terminated: "badge--danger",
};
const STATUS_LABEL: Record<string, string> = {
  Active: "Aktif", Inactive: "Pasif", Suspended: "Askıda",
  Transferred: "Transfer", Terminated: "İşden çykan",
};

export function WorkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [preset, setPreset] = useState<Preset>("bu-ay");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd]   = useState("");

  const { startDate, endDate } =
    preset === "custom" ? { startDate: customStart, endDate: customEnd } : getRange(preset);

  // Main query — changes with preset/dates
  const { data, isLoading } = useQuery({
    queryKey: ["workerSummary", id, startDate, endDate],
    queryFn: () => attendanceApi.getWorkerSummary(id!, startDate || undefined, endDate || undefined),
    enabled: !!id,
    staleTime: 60_000,
  });

  // Fixed stats queries (always show regardless of period)
  const r = {
    buAy:     getRange("bu-ay"),
    onkiAy:   getRange("onki-ay"),
    buYyl:    getRange("bu-yyl"),
    gecenYyl: getRange("gecen-yyl"),
  };
  const mkQuery = (s: string, e: string) => ({
    queryKey: ["workerSummary", id, s, e] as const,
    queryFn:  () => attendanceApi.getWorkerSummary(id!, s, e),
    enabled:  !!id,
    staleTime: 300_000,
  });
  const { data: statBuAy }     = useQuery(mkQuery(r.buAy.startDate,     r.buAy.endDate));
  const { data: statOnkiAy }   = useQuery(mkQuery(r.onkiAy.startDate,   r.onkiAy.endDate));
  const { data: statBuYyl }    = useQuery(mkQuery(r.buYyl.startDate,    r.buYyl.endDate));
  const { data: statGecenYyl } = useQuery(mkQuery(r.gecenYyl.startDate, r.gecenYyl.endDate));

  const worker = data?.worker;
  const days   = data?.days ?? [];

  // Calendar: show for single-month presets
  const showCalendar = preset === "bu-ay" || preset === "onki-ay";
  const calRef = preset === "onki-ay" ? shiftMonths(new Date(), -1) : new Date();

  // Worked days count
  const workedDays = (d?: DaySummary[]) => (d ?? []).filter(x => x.totalMs > 0).length;

  const STATS = [
    { label: "Bu aý",      ms: statBuAy?.totalMs,     days: workedDays(statBuAy?.days)     },
    { label: "Öňki aý",   ms: statOnkiAy?.totalMs,   days: workedDays(statOnkiAy?.days)   },
    { label: "Bu ýyl",    ms: statBuYyl?.totalMs,     days: workedDays(statBuYyl?.days)    },
    { label: "Geçen ýyl", ms: statGecenYyl?.totalMs,  days: workedDays(statGecenYyl?.days) },
  ];

  return (
    <>
      {/* ── Page header ── */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate("/workers")}>
            <ArrowLeft size={15} />
          </button>
          <h1 style={{ margin: 0 }}>{worker?.name ?? "Işçi maglumatlary"}</h1>
          {worker && (
            <span className={`badge badge--dot ${STATUS_CLASS[worker.status] ?? "badge--neutral"}`} style={{ fontSize: 12 }}>
              {STATUS_LABEL[worker.status] ?? worker.status}
            </span>
          )}
        </div>
      </div>

      {isLoading && !worker && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          Ýüklenýär…
        </div>
      )}

      {worker && (
        <>
          {/* ── Worker info card ── */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-body" style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{worker.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{worker.profession || "—"}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                  {worker.shift === "day"   && <span className="badge badge--dot badge--warning" style={{ fontSize: 11 }}><Sun size={10} /> Gündiz</span>}
                  {worker.shift === "night" && <span className="badge badge--dot badge--neutral" style={{ fontSize: 11 }}><Moon size={10} /> Gije</span>}
                  {worker.nfcCardUid && <span style={{ fontSize: 11, color: "#10B981" }}>📡 NFC</span>}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 5, columnGap: 14, fontSize: 13, alignContent: "start" }}>
                <span style={{ color: "var(--text-muted)" }}>Sicil No:</span>
                <strong className="td-mono">{worker.workerId}</strong>
                <span style={{ color: "var(--text-muted)" }}>Ekip:</span>
                <span>{worker.brigadeName || "—"}</span>
                <span style={{ color: "var(--text-muted)" }}>Mesai:</span>
                <span>{worker.mesaiSistemi}</span>
                {worker.hireDate && <>
                  <span style={{ color: "var(--text-muted)" }}>İşe giriş:</span>
                  <span>{worker.hireDate}</span>
                </>}
                {worker.phone && <>
                  <span style={{ color: "var(--text-muted)" }}>Telefon:</span>
                  <span>{worker.phone}</span>
                </>}
              </div>
            </div>
          </div>

          {/* ── Stats row ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
            {STATS.map(s => (
              <div key={s.label} className="card" style={{ padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--primary)" }}>{fmtMs(s.ms ?? 0)}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.days} gün</div>
              </div>
            ))}
            <div className="card" style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>Extra saat</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--warning, #F59E0B)" }}>
                +{Number(worker.extraSaat ?? 0)} sag
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>goşmaça</div>
            </div>
          </div>

          {/* ── Period selector ── */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-body" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {PRESETS.map(p => (
                <button
                  key={p.key}
                  className={`btn btn--sm ${preset === p.key ? "btn--primary" : "btn--secondary"}`}
                  onClick={() => setPreset(p.key)}
                >
                  {p.label}
                </button>
              ))}
              {preset === "custom" && (
                <>
                  <input type="date" className="filter-select" style={{ width: 138 }}
                    value={customStart} onChange={e => setCustomStart(e.target.value)} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                  <input type="date" className="filter-select" style={{ width: 138 }}
                    value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                </>
              )}
              {isLoading && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ýüklenýär…</span>
              )}
              {!isLoading && days.length > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>
                  Jemi: <strong style={{ color: "var(--primary)" }}>{fmtMs(data?.totalMs ?? 0)}</strong>
                  {" · "}{workedDays(days)} iş güni
                </span>
              )}
            </div>
          </div>

          {/* ── Calendar ── */}
          {showCalendar && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-header">
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {calRef.getFullYear()} — {MONTH_NAMES[calRef.getMonth()]}
                </span>
              </div>
              <div className="card-body">
                <MonthCalendar month={calRef.getMonth()} year={calRef.getFullYear()} days={days} />
              </div>
            </div>
          )}

          {/* ── Day table ── */}
          <div className="card">
            <div className="card-header">
              <span style={{ fontSize: 13, fontWeight: 600 }}>Günlük taryh</span>
            </div>
            <div className="card-body card-body--p0">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sene</th>
                      <th>Giriş</th>
                      <th>Çykyş</th>
                      <th>Jemi sag</th>
                      <th>Sessiýa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.length === 0 && !isLoading ? (
                      <tr>
                        <td colSpan={5}>
                          <div className="empty-state"><p>Bu döwürde maglumat ýok</p></div>
                        </td>
                      </tr>
                    ) : (
                      [...days].reverse().map(day => (
                        <tr key={day.date}>
                          <td className="td-mono" style={{ fontSize: 12 }}>{day.date}</td>
                          <td>
                            {day.checkIn
                              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#10B981", fontSize: 12 }}>
                                  <LogIn size={10} />{fmtTime(day.checkIn)}
                                </span>
                              : <span className="td-muted">—</span>}
                          </td>
                          <td>
                            {day.checkOut
                              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#F59E0B", fontSize: 12 }}>
                                  <LogOut size={10} />{fmtTime(day.checkOut)}
                                </span>
                              : <span className="td-muted">—</span>}
                          </td>
                          <td>
                            <strong style={{ fontSize: 13, color: day.totalMs > 0 ? "var(--primary)" : "var(--text-muted)" }}>
                              {fmtMs(day.totalMs)}
                            </strong>
                          </td>
                          <td>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {day.sessions.length} ses.
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
      )}
    </>
  );
}
