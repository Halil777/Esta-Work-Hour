import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Download, Sun, Moon, X, AlertCircle } from "lucide-react";
import { attendanceApi } from "../api/attendance";
import { absenceNotesApi } from "../api/absenceNotes";
import { useUiPreferences } from "../app/providers/useUiPreferences";

type StaffFilter = "all" | "staff" | "workers";

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function NoteModal({ workerEntityId, workerName, date, existingNote, onClose, adminName }: {
  workerEntityId: string;
  workerName: string;
  date: string;
  existingNote?: string;
  onClose: () => void;
  adminName: string;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState(existingNote ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!note.trim()) { setErr("Sebäp ýazyň"); return; }
    setSaving(true);
    try {
      await absenceNotesApi.upsert(workerEntityId, date, note.trim(), adminName);
      qc.invalidateQueries({ queryKey: ["late-arrivals"] });
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3>Sebäp — {workerName}</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          {err && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "var(--danger-light)", borderRadius: 6, marginBottom: 10, color: "var(--danger)", fontSize: 13 }}>
              <AlertCircle size={14} /> {err}
            </div>
          )}
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
            Kart ýitdi, kesel, ýadyndan çykdy...
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Gelip bilmedik sebäbi..."
            rows={4}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card2)", color: "var(--text)", fontSize: 13, resize: "vertical" }}
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn--secondary btn--sm" onClick={onClose}>Ýap</button>
          <button className="btn btn--primary btn--sm" onClick={save} disabled={saving}>
            {saving ? "Saklanýar…" : "Sakla"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LateArrivalsPage() {
  const navigate = useNavigate();
  const { user } = useUiPreferences();
  const qc = useQueryClient();
  const adminName = user?.name ?? "Admin";

  const [staffFilter, setStaffFilter] = useState<StaffFilter>("all");
  const [noteModal, setNoteModal] = useState<{ workerEntityId: string; workerName: string; existingNote?: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["late-arrivals", staffFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (staffFilter !== "all") qs.set("staffFilter", staffFilter);
      return fetch(`/api/attendance/late-arrivals?${qs}`).then(r => r.json());
    },
    staleTime: 60_000,
    refetchInterval: 3 * 60_000,
  });

  const workers: any[] = data?.workers ?? [];
  const daySettings  = data?.daySettings  ?? { startTime: "07:00", graceMinutes: 60 };
  const nightSettings = data?.nightSettings ?? { startTime: "18:00", graceMinutes: 60 };
  const date = data?.date ?? new Date().toISOString().split("T")[0];

  function addMinutes(time: string, mins: number): string {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + Number(mins);
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  const exportExcel = () => {
    const qs = staffFilter !== "all" ? `?staffFilter=${staffFilter}` : "";
    window.location.href = `/api/attendance/late-arrivals/export${qs}`;
  };

  const dayWorkers   = workers.filter(w => w.shift === "day");
  const nightWorkers = workers.filter(w => w.shift === "night");

  const STAFF_FILTERS: { key: StaffFilter; label: string }[] = [
    { key: "all",     label: "Ähli" },
    { key: "workers", label: "Işçiler" },
    { key: "staff",   label: "Staff" },
  ];

  const renderRow = (w: any) => (
    <tr key={w.workerEntityId}>
      <td
        className="td-mono"
        style={{ fontSize: 11 }}
        onClick={() => navigate(`/workers/${w.workerEntityId}`)}
        title="Detail açmak"
      >
        {w.workerId}
      </td>
      <td>
        <div
          style={{ fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--primary)" }}
          onClick={() => navigate(`/workers/${w.workerEntityId}`)}
        >
          {w.workerName}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{w.profession || "—"}</div>
        {w.isStaff && (
          <span className="badge badge--dot badge--info" style={{ fontSize: 10, marginTop: 2 }}>Staff</span>
        )}
      </td>
      <td style={{ fontSize: 12 }}>{w.brigadeName || "—"}</td>
      <td>
        {w.shift === "day"
          ? <span className="badge badge--dot badge--warning" style={{ fontSize: 11 }}><Sun size={10} /> Gündiz</span>
          : <span className="badge badge--dot badge--neutral" style={{ fontSize: 11 }}><Moon size={10} /> Gije</span>}
      </td>
      <td>
        {w.absenceNote ? (
          <div>
            <div style={{ fontSize: 12, color: "var(--text)" }}>"{w.absenceNote.note}"</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{w.absenceNote.createdByName}</div>
          </div>
        ) : (
          <span className="td-muted" style={{ fontSize: 12 }}>—</span>
        )}
      </td>
      <td>
        <button
          className="btn btn--ghost btn--sm"
          style={{ fontSize: 11 }}
          onClick={() => setNoteModal({ workerEntityId: w.workerEntityId, workerName: w.workerName, existingNote: w.absenceNote?.note })}
        >
          {w.absenceNote ? "Üýtget" : "+ Sebäp"}
        </button>
      </td>
    </tr>
  );

  const renderTable = (rows: any[], title: string, settings: any, shiftKey: "day" | "night") => {
    if (rows.length === 0) return null;
    const deadline = addMinutes(settings.startTime, settings.graceMinutes);
    return (
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {shiftKey === "day" ? <Sun size={14} style={{ color: "var(--warning)" }} /> : <Moon size={14} />}
            <span style={{ fontWeight: 600, fontSize: 13 }}>{title}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              (başlangyjy {settings.startTime}, çäk {deadline})
            </span>
            <span className="badge badge--dot badge--danger" style={{ fontSize: 12 }}>{rows.length} işçi</span>
          </div>
        </div>
        <div className="card-body card-body--p0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sicil No</th>
                  <th>İşçi</th>
                  <th>Ekip</th>
                  <th>Shift</th>
                  <th>Sebäp</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>{rows.map(renderRow)}</tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="page-header">
        <h1>Gelmedi — {date}</h1>
        <div className="page-actions">
          <button className="btn btn--secondary btn--sm" onClick={exportExcel}>
            <Download size={13} /> Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {STAFF_FILTERS.map(f => (
          <button
            key={f.key}
            className={`btn btn--sm ${staffFilter === f.key ? "btn--primary" : "btn--secondary"}`}
            onClick={() => setStaffFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)", alignSelf: "center" }}>
          Jemi: <strong style={{ color: "var(--danger)" }}>{workers.length}</strong> işçi
        </span>
      </div>

      {isLoading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Ýüklenýär…</div>
      ) : workers.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Ähli işçiler geldi ýa-da heniz iş başlangy wagty geçmedi.</p>
        </div>
      ) : (
        <>
          {renderTable(dayWorkers,   "Gündiz shift — gelmänler",   daySettings,   "day")}
          {renderTable(nightWorkers, "Gije shift — gelmänler",     nightSettings, "night")}
        </>
      )}

      {noteModal && (
        <NoteModal
          workerEntityId={noteModal.workerEntityId}
          workerName={noteModal.workerName}
          date={date}
          existingNote={noteModal.existingNote}
          onClose={() => setNoteModal(null)}
          adminName={adminName}
        />
      )}
    </>
  );
}
