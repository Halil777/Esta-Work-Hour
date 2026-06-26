import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Upload, Download,
  Edit2, Trash2, X, AlertCircle, LogIn, LogOut, WifiOff, KeyRound, Sun, Moon,
} from "lucide-react";
import { useTranslation } from "../i18n/useTranslation";
import { useUiPreferences } from "../app/providers/useUiPreferences";
import type { WorkerStatus } from "../types/tenant";
import { workersApi, type WorkerApi, type MobileRole } from "../api/workers";
import { foremansApi } from "../api/foremans";

type StatusVariant = "success" | "warning" | "danger" | "neutral" | "info";

function statusBadge(s: WorkerStatus): { label: string; variant: StatusVariant } {
  const map: Record<WorkerStatus, { label: string; variant: StatusVariant }> = {
    Active:     { label: "Aktif",      variant: "success" },
    Inactive:   { label: "Pasif",      variant: "neutral" },
    Suspended:  { label: "Askıda",     variant: "warning" },
    Transferred:{ label: "Transfer",   variant: "info" },
    Terminated: { label: "İşden çykan",variant: "danger" },
  };
  return map[s];
}

const fmtTime = (ts: number | null | undefined) => {
  if (!ts) return null;
  return new Date(ts).toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
};

const fmtHours = (ms: number | null | undefined) => {
  if (!ms || ms <= 0) return null;
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} sag`;
  return `${h} sag ${m} min`;
};

const fmtToplamSaat = (ms: number | null | undefined, mesai: string | undefined) => {
  if (mesai === "Aylık") return "8 sag";
  return fmtHours(ms) ?? "—";
};

const STATUSES: WorkerStatus[] = ["Active", "Inactive", "Suspended", "Transferred", "Terminated"];
const MESAI_SISTEMLERI = ["Saatlik", "Aylık"];
const MOBILE_ROLES: MobileRole[] = ["worker", "foreman", "site_chief", "section_chief"];
const ROLE_LABELS: Record<MobileRole, string> = {
  worker:        "Işçi",
  foreman:       "Foremen",
  site_chief:    "Site Chief",
  section_chief: "Bölüm Başlygy",
};
const ROLE_VARIANTS: Record<MobileRole, string> = {
  worker:        "neutral",
  foreman:       "info",
  site_chief:    "warning",
  section_chief: "danger",
};

type WorkerShift = "day" | "night" | "";

type WorkerForm = {
  name: string;
  workerId: string;
  profession: string;
  brigadeId: string;
  brigadeName: string;
  zoneId: string;
  zoneName: string;
  status: WorkerStatus;
  phone: string;
  hireDate: string;
  mesaiSistemi: string;
  mobileRole: MobileRole;
  shift: WorkerShift;
  isStaff: boolean;
};

const emptyForm: WorkerForm = {
  name: "", workerId: "", profession: "",
  brigadeId: "", brigadeName: "", zoneId: "", zoneName: "",
  status: "Active", phone: "",
  hireDate: new Date().toISOString().split("T")[0],
  mesaiSistemi: "Saatlik", mobileRole: "worker", shift: "", isStaff: false,
};

// ─── Worker Modal ──────────────────────────────────────────────────────────────
function WorkerModal({ initial, onClose, onSave, t }: {
  initial?: WorkerApi | null;
  onClose: () => void;
  onSave: (form: WorkerForm) => Promise<void>;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const [form, setForm] = useState<WorkerForm>(
    initial ? {
      name: initial.name,
      workerId: initial.workerId,
      profession: initial.profession,
      brigadeId: initial.brigadeId,
      brigadeName: initial.brigadeName,
      zoneId: initial.zoneId,
      zoneName: initial.zoneName,
      status: initial.status,
      phone: initial.phone ?? "",
      hireDate: initial.hireDate ?? "",
      mesaiSistemi: initial.mesaiSistemi ?? "Saatlik",
      mobileRole: (initial.mobileRole ?? "worker") as MobileRole,
      shift: (initial.shift ?? "") as WorkerShift,
      isStaff: initial.isStaff ?? false,
    } : emptyForm,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial?.photoUrl ?? null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof WorkerForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !initial) return;
    setPhotoUploading(true);
    try {
      const res = await workersApi.uploadPhoto(initial.id, file);
      setPhotoUrl(res.photoUrl);
    } catch { /* ignore */ }
    finally { setPhotoUploading(false); }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("İşçi ady hökman"); return; }
    setSaving(true); setError("");
    try { await onSave(form); onClose(); }
    catch (e: any) { setError(e.message ?? "Ýalňyşlyk"); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <div className="modal-header">
          <h3>{initial ? t.workers.editWorkerTitle : t.workers.addWorkerTitle}</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "var(--danger-light)", borderRadius: 6, marginBottom: 10, color: "var(--danger)", fontSize: 13 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {initial && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", overflow: "hidden",
                background: "var(--border)", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {photoUrl
                  ? <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 24, color: "var(--text-muted)" }}>👤</span>
                }
              </div>
              <div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handlePhotoChange}
                />
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  style={{ fontSize: 12 }}
                >
                  {photoUploading ? "Ýüklenýär..." : "Surat ýükle"}
                </button>
                {photoUrl && (
                  <div style={{ fontSize: 11, color: "var(--success)", marginTop: 4 }}>✓ Surat bar</div>
                )}
              </div>
            </div>
          )}
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">{t.workers.name} *</label>
              <input value={form.name} onChange={set("name")} placeholder="ASHYROV BAYMYRAT" />
            </div>
            <div className="form-row">
              <label className="form-label">Sicil No</label>
              <input value={form.workerId} onChange={set("workerId")} placeholder="0007064428"
                disabled={!!initial} style={initial ? { opacity: 0.5 } : {}} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Görev</label>
              <input value={form.profession} onChange={set("profession")} placeholder="BORU MONTAJ ISCISI" />
            </div>
            <div className="form-row">
              <label className="form-label">Ekip (Brigade)</label>
              <input value={form.brigadeName} onChange={set("brigadeName")} placeholder="ALTYAPI EKIBI" />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Mesai Sistemi</label>
              <select value={form.mesaiSistemi} onChange={set("mesaiSistemi")}>
                {MESAI_SISTEMLERI.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">{t.workers.status}</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as WorkerStatus }))}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">Mobile Rol</label>
              <select value={form.mobileRole} onChange={e => setForm(p => ({ ...p, mobileRole: e.target.value as MobileRole }))}>
                {MOBILE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">Shift</label>
              <select value={form.shift} onChange={set("shift")}>
                <option value="">— Bellenilmedik —</option>
                <option value="day">☀ Gündiz</option>
                <option value="night">🌙 Gije</option>
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label className="form-label">{t.workers.phone}</label>
              <input value={form.phone} onChange={set("phone")} placeholder="+993 65 000000" />
            </div>
            <div className="form-row">
              <label className="form-label">{t.workers.hireDate}</label>
              <input type="date" value={form.hireDate} onChange={set("hireDate")} />
            </div>
          </div>
          <div className="form-row">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={form.isStaff} onChange={e => setForm(p => ({ ...p, isStaff: e.target.checked }))}
                style={{ width: 15, height: 15 }} />
              Staff işçi (Aýlyk, ofis işçisi) — aýratyn notification
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn--secondary btn--sm" onClick={onClose}>{t.common.cancel}</button>
          <button className="btn btn--primary btn--sm" onClick={handleSubmit} disabled={saving}>
            {saving ? t.common.loading : initial ? t.common.save : t.workers.addWorker}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({ onClose, onDone, t }: {
  onClose: () => void;
  onDone: () => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; updated?: number; terminated?: number } | null>(null);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setError("");
    try { const res = await workersApi.importExcel(file); setResult(res); onDone(); }
    catch (e: any) { setError(e.message ?? "Upload failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>{t.common.import} — İşçi Sanawy</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          {!result ? (
            <>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
                Excel sütunlary:
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.6 }}>
                <code>Sicil No · İnsan Adı · Görev · EKIP · Mesai Sistemi</code>
              </p>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "8px 12px", background: "var(--warning-light, #FFF7ED)", borderRadius: 6, marginBottom: 12, fontSize: 12, color: "var(--warning, #F59E0B)" }}>
                <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Täze excelda <b>ýok bolan</b> işçiler awtomatiki "İşden bosadylanlar" sahypasyna geçiriler.</span>
              </div>
              {error && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "var(--danger-light)", borderRadius: 6, marginBottom: 10, color: "var(--danger)", fontSize: 13 }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
              <div onClick={() => fileRef.current?.click()} style={{ border: "2px dashed var(--border)", borderRadius: 8, padding: "24px 16px", textAlign: "center", cursor: "pointer", color: "var(--text-muted)", fontSize: 13, background: file ? "var(--success-light)" : undefined }}>
                {file ? <span style={{ color: "var(--success)" }}>✓ {file.name}</span> : <span><Upload size={20} style={{ display: "block", margin: "0 auto 6px" }} />Excel faýlyny saýla</span>}
              </div>
            </>
          ) : (
            <div style={{ padding: "8px 0" }}>
              <div style={{ textAlign: "center", fontSize: 32, marginBottom: 12 }}>✅</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--success-light)", borderRadius: 6 }}>
                  <span style={{ fontSize: 13 }}>Täze goşulan</span>
                  <strong style={{ color: "var(--success)" }}>{result.imported} işçi</strong>
                </div>
                {(result.updated ?? 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--card2)", borderRadius: 6 }}>
                    <span style={{ fontSize: 13 }}>Täzelenen</span>
                    <strong>{result.updated} işçi</strong>
                  </div>
                )}
                {(result.terminated ?? 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--danger-light)", borderRadius: 6 }}>
                    <span style={{ fontSize: 13 }}>İşden aýrylan (awtomatiki)</span>
                    <strong style={{ color: "var(--danger)" }}>{result.terminated} işçi</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn--secondary btn--sm" onClick={onClose}>{result ? t.common.close : t.common.cancel}</button>
          {!result && (
            <button className="btn btn--primary btn--sm" onClick={handleUpload} disabled={!file || loading}>
              {loading ? t.common.loading : <><Upload size={13} /> Import</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Card Import Modal ─────────────────────────────────────────────────────────
function CardImportModal({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ linked: number; notFound: number } | null>(null);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setError("");
    try { const res = await workersApi.importCards(file); setResult(res); }
    catch (e: any) { setError(e.message ?? "Upload failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>Kart Nomerleri Import</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          {!result ? (
            <>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
                "card numbers.xlsx" — <code>Табельный номер → Карта №</code>
              </p>
              {error && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "var(--danger-light)", borderRadius: 6, marginBottom: 10, color: "var(--danger)", fontSize: 13 }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
              <div onClick={() => fileRef.current?.click()} style={{ border: "2px dashed var(--border)", borderRadius: 8, padding: "24px 16px", textAlign: "center", cursor: "pointer", color: "var(--text-muted)", fontSize: 13, background: file ? "var(--success-light)" : undefined }}>
                {file ? <span style={{ color: "var(--success)" }}>✓ {file.name}</span> : <span><Upload size={20} style={{ display: "block", margin: "0 auto 6px" }} />card numbers.xlsx saýla</span>}
              </div>
            </>
          ) : (
            <div style={{ padding: "8px 0" }}>
              <div style={{ textAlign: "center", fontSize: 32, marginBottom: 12 }}>✅</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--success-light)", borderRadius: 6 }}>
                  <span style={{ fontSize: 13 }}>Kart birikdirildi</span>
                  <strong style={{ color: "var(--success)" }}>{result.linked} işçi</strong>
                </div>
                {result.notFound > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--warning-light, #FFF7ED)", borderRadius: 6 }}>
                    <span style={{ fontSize: 13 }}>Tabeli tapylmady</span>
                    <strong style={{ color: "var(--warning, #F59E0B)" }}>{result.notFound}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn--secondary btn--sm" onClick={onClose}>{result ? "Ýap" : "Ýatyr"}</button>
          {!result && (
            <button className="btn btn--primary btn--sm" onClick={handleUpload} disabled={!file || loading}>
              {loading ? "Ýüklenýär…" : <><Upload size={13} /> Import</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Credential Modal ──────────────────────────────────────────────────────────
function CredentialModal({ worker, onClose }: { worker: WorkerApi; onClose: () => void }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { data: cred, isLoading } = useQuery({
    queryKey: ["credential", worker.id],
    queryFn: () => workersApi.getCredential(worker.id),
    staleTime: 0,
  });

  const handleSave = async () => {
    if (!username.trim()) { setError("Username zerur"); return; }
    if (!password.trim()) { setError("Parol zerur"); return; }
    setSaving(true); setError("");
    try {
      await workersApi.setCredential(worker.id, username.trim(), password);
      setSuccess(true);
      qc.invalidateQueries({ queryKey: ["credential", worker.id] });
    } catch (e: any) { setError(e.message ?? "Ýalňyşlyk"); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async () => {
    setSaving(true); setError("");
    try {
      await workersApi.deactivateCredential(worker.id);
      qc.invalidateQueries({ queryKey: ["credential", worker.id] });
    } catch (e: any) { setError(e.message ?? "Ýalňyşlyk"); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3>Mobile Giriş — {worker.name}</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          {isLoading ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Ýüklenýär…</p>
          ) : cred ? (
            <div style={{ padding: "10px 12px", background: cred.isActive ? "var(--success-light)" : "var(--danger-light)", borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: cred.isActive ? "var(--success)" : "var(--danger)", fontWeight: 600, marginBottom: 4 }}>
                {cred.isActive ? "✓ Aktiw hasap bar" : "✗ Hasap deaktiw"}
              </div>
              <div style={{ fontSize: 13 }}>Login: <strong>{cred.username}</strong></div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Rol: {ROLE_LABELS[cred.role]}</div>
              {cred.isActive && (
                <button className="btn btn--danger btn--sm" style={{ marginTop: 8 }} onClick={handleDeactivate} disabled={saving}>
                  Deaktiw et
                </button>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>Heniz hasap ýok.</p>
          )}
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "var(--danger-light)", borderRadius: 6, marginBottom: 10, color: "var(--danger)", fontSize: 13 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {success && (
            <div style={{ padding: "8px 12px", background: "var(--success-light)", borderRadius: 6, marginBottom: 10, color: "var(--success)", fontSize: 13 }}>
              ✓ Hasap üstünlikli goýuldy
            </div>
          )}
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
            {cred ? "Täze parol ber (üýtgetmek üçin):" : "Täze hasap döret:"}
          </p>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <label className="form-label">Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder={worker.workerId} />
          </div>
          <div className="form-row">
            <label className="form-label">Parol</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="min 4 nyşan" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn--secondary btn--sm" onClick={onClose}>Ýap</button>
          <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving || !username || !password}>
            {saving ? "Saklanýar…" : <><KeyRound size={13} /> Hasap ber</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function WorkersPage() {
  const { t } = useTranslation();
  const { user } = useUiPreferences();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const adminName = user?.name ?? "Admin";

  const [search, setSearch] = useState("");
  const [mesaiSistemi, setMesaiSistemi] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<WorkerStatus | "all">("all");
  const [foremanFilter, setForemanFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [noScanFilter, setNoScanFilter] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editWorker, setEditWorker] = useState<WorkerApi | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showCardImport, setShowCardImport] = useState(false);
  const [credWorker, setCredWorker] = useState<WorkerApi | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: foremans = [] } = useQuery({
    queryKey: ["foremans"],
    queryFn: foremansApi.list,
    staleTime: 60_000,
  });

  const { data: workers = [], isLoading, error } = useQuery({
    queryKey: ["workers", search, mesaiSistemi, statusFilter, foremanFilter, startDate, endDate, noScanFilter],
    queryFn: () => workersApi.list({
      search: search || undefined,
      mesaiSistemi: mesaiSistemi !== "all" ? mesaiSistemi : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      foremanId: foremanFilter !== "all" ? foremanFilter : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      noScan: noScanFilter || undefined,
    }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["workers"] });

  const buildPayload = (form: WorkerForm) => ({
    ...form,
    shift: (form.shift || null) as "day" | "night" | null,
  });

  const createMutation = useMutation({
    mutationFn: (form: WorkerForm) => workersApi.create(buildPayload(form)),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: WorkerForm }) =>
      workersApi.update(id, buildPayload(form), adminName),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workersApi.remove(id, adminName),
    onSuccess: () => { setDeleteId(null); invalidate(); },
  });

  const hasActiveFilters = mesaiSistemi !== "all" || statusFilter !== "all" || foremanFilter !== "all" || startDate || endDate || noScanFilter || search;

  const clearFilters = () => {
    setSearch(""); setMesaiSistemi("all"); setStatusFilter("all");
    setForemanFilter("all"); setStartDate(""); setEndDate(""); setNoScanFilter(false);
  };

  return (
    <>
      <div className="page-header">
        <h1>{t.workers.title}</h1>
        <div className="page-actions">
          <button className="btn btn--secondary btn--sm" onClick={() => setShowImport(true)}>
            <Upload size={13} /> {t.common.import}
          </button>
          <button className="btn btn--secondary btn--sm" onClick={() => setShowCardImport(true)}>
            <Upload size={13} /> Kart Import
          </button>
          <button className="btn btn--secondary btn--sm" onClick={() => workersApi.exportExcel()}>
            <Download size={13} /> {t.common.export}
          </button>
          <button className="btn btn--primary btn--sm" onClick={() => setShowAdd(true)}>
            <Plus size={13} /> {t.workers.addWorker}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <div className="filters-bar">
            <div className="input-wrap">
              <Search size={14} />
              <input className="search-input" placeholder={t.workers.searchPlaceholder}
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={foremanFilter} onChange={e => setForemanFilter(e.target.value)}>
              <option value="all">Ähli foremen</option>
              {foremans.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select className="filter-select" value={mesaiSistemi} onChange={e => setMesaiSistemi(e.target.value)}>
              <option value="all">Ähli mesai</option>
              <option value="Saatlik">Saatlik</option>
              <option value="Aylık">Aylık</option>
            </select>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as WorkerStatus | "all")}>
              <option value="all">{t.common.all}</option>
              {STATUSES.map(s => <option key={s} value={s}>{t.status[s.toLowerCase() as keyof typeof t.status] ?? s}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>Sene:</label>
              <input type="date" className="filter-select" style={{ width: 136 }}
                value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
              <input type="date" className="filter-select" style={{ width: 136 }}
                value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 13, userSelect: "none" }}>
              <input type="checkbox" checked={noScanFilter} onChange={e => setNoScanFilter(e.target.checked)}
                style={{ width: 14, height: 14 }} />
              <WifiOff size={13} style={{ color: noScanFilter ? "var(--danger)" : "var(--text-muted)" }} />
              <span style={{ color: noScanFilter ? "var(--danger)" : "var(--text-muted)" }}>NFC skan ýok</span>
            </label>
            {hasActiveFilters && (
              <button className="btn btn--ghost btn--sm" onClick={clearFilters} style={{ fontSize: 12, color: "var(--text-muted)" }}>
                <X size={12} /> Filtr arassala
              </button>
            )}
            <span className="text-xs text-muted" style={{ marginLeft: "auto" }}>
              {workers.length} {t.workers.totalCount}
            </span>
          </div>
        </div>

        <div className="card-body card-body--p0">
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", color: "var(--danger)", fontSize: 13 }}>
              <AlertCircle size={14} /> {String(error)} — Backend işleýärmi? (port 3002)
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sicil No</th>
                  <th>İşçi</th>
                  <th>Giriş / Çykyş</th>
                  <th>Saat</th>
                  <th>Ekip</th>
                  <th>Shift</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8}><div className="empty-state"><p>{t.common.loading}</p></div></td></tr>
                ) : workers.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><Search size={32} /><p>{t.common.noData}</p></div></td></tr>
                ) : workers.map(w => {
                  const sb = statusBadge(w.status);
                  const mesai = w.mesaiSistemi ?? "Saatlik";
                  const toplamSaat = fmtToplamSaat(w.todayHoursMs, mesai);
                  const hakykyInfo = fmtHours(w.todayHoursMs);
                  const role = (w.mobileRole ?? "worker") as MobileRole;
                  const extraSaat = Number(w.extraSaat ?? 0);
                  const checkIn = fmtTime(w.lastCheckIn);
                  const checkOut = fmtTime(w.lastCheckOut);

                  return (
                    <tr key={w.id}>
                      <td className="td-mono" style={{ fontSize: 11 }}>{w.workerId}</td>

                      {/* İşçi: surat + ady + wezipesi + NFC + extra saat */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: "50%", overflow: "hidden",
                            background: "var(--border)", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {w.photoUrl
                              ? <img src={w.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <span style={{ fontSize: 13, color: "var(--text-muted)" }}>👤</span>
                            }
                          </div>
                          <div>
                            <div
                              style={{ fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--primary)" }}
                              onClick={() => navigate(`/workers/${w.id}`)}
                            >
                              {w.name}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                              {w.profession || "—"}
                            </div>
                            {(w.nfcCardUid || extraSaat > 0) && (
                              <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                                {w.nfcCardUid && (
                                  <span title={w.nfcCardUid} style={{ fontSize: 10, color: "#10B981", display: "inline-flex", alignItems: "center", gap: 2 }}>
                                    📡 NFC
                                  </span>
                                )}
                                {extraSaat > 0 && (
                                  <span className="badge badge--warning" style={{ fontSize: 10 }}>
                                    +{extraSaat}h
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Giriş / Çykyş */}
                      <td>
                        {checkIn
                          ? <div style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#10B981", fontSize: 12 }}><LogIn size={10} />{checkIn}</div>
                          : <span className="td-muted" style={{ fontSize: 12 }}>—</span>
                        }
                        {checkOut && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#F59E0B", fontSize: 12, marginTop: 2 }}>
                            <LogOut size={10} />{checkOut}
                          </div>
                        )}
                      </td>

                      {/* Saat: toplam + hakyky */}
                      <td>
                        <div style={{ fontWeight: 600, color: "#6366F1", fontSize: 13 }}>{toplamSaat}</div>
                        {hakykyInfo && toplamSaat !== hakykyInfo && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{hakykyInfo}</div>
                        )}
                      </td>

                      {/* Ekip + Mesai */}
                      <td>
                        <div style={{ fontSize: 12 }}>{w.brigadeName || "—"}</div>
                        <span className={`badge badge--dot ${mesai === "Aylık" ? "badge--info" : "badge--success"}`} style={{ fontSize: 10, marginTop: 2 }}>
                          {mesai}
                        </span>
                      </td>

                      {/* Shift */}
                      <td>
                        {w.shift === "day"
                          ? <span className="badge badge--dot badge--warning" style={{ fontSize: 11 }}><Sun size={10} /> Gündiz</span>
                          : w.shift === "night"
                          ? <span className="badge badge--dot badge--neutral" style={{ fontSize: 11 }}><Moon size={10} /> Gije</span>
                          : <span className="td-muted">—</span>
                        }
                      </td>

                      {/* Status + Rol */}
                      <td>
                        <span className={`badge badge--dot badge--${sb.variant}`} style={{ fontSize: 11 }}>{sb.label}</span>
                        {role !== "worker" && (
                          <div style={{ marginTop: 3 }}>
                            <span className={`badge badge--dot badge--${ROLE_VARIANTS[role]}`} style={{ fontSize: 10 }}>
                              {ROLE_LABELS[role]}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Amallar */}
                      <td>
                        <div className="td-actions">
                          <button className="btn btn--ghost btn--sm" title="Login/Parol"
                            onClick={() => setCredWorker(w)}
                            style={{ color: role !== "worker" ? "var(--warning)" : undefined }}>
                            <KeyRound size={13} />
                          </button>
                          <button className="btn btn--ghost btn--sm" title={t.common.edit} onClick={() => setEditWorker(w)}>
                            <Edit2 size={13} />
                          </button>
                          <button className="btn btn--ghost btn--sm" title={t.common.delete}
                            onClick={() => setDeleteId(w.id)} style={{ color: "var(--danger)" }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAdd && <WorkerModal onClose={() => setShowAdd(false)} onSave={async form => { await createMutation.mutateAsync(form); }} t={t} />}
      {editWorker && <WorkerModal initial={editWorker} onClose={() => setEditWorker(null)} onSave={async form => { await updateMutation.mutateAsync({ id: editWorker.id, form }); }} t={t} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={invalidate} t={t} />}
      {showCardImport && <CardImportModal onClose={() => setShowCardImport(false)} />}
      {credWorker && <CredentialModal worker={credWorker} onClose={() => setCredWorker(null)} />}

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-box" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t.common.confirm}</h3>
              <button className="btn btn--ghost btn--sm" onClick={() => setDeleteId(null)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14 }}>Bu işçini pozmak isleýärsiňizmi?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary btn--sm" onClick={() => setDeleteId(null)}>{t.common.cancel}</button>
              <button className="btn btn--primary btn--sm" style={{ background: "var(--danger)" }}
                onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
                <Trash2 size={13} /> {deleteMutation.isPending ? t.common.loading : t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
