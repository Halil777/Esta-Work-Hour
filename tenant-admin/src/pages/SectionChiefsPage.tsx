import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HardHat, KeyRound, X, Eye, EyeOff, Search } from 'lucide-react'
import { workersApi, type WorkerApi } from '../api/workers'
import { useUiPreferences } from '../app/providers/useUiPreferences'

function Badge({ variant, children }: { variant: string; children: React.ReactNode }) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}

function CredentialModal({ worker, onClose }: { worker: WorkerApi; onClose: () => void }) {
  const qc = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [msg, setMsg] = useState('')

  const { data: cred } = useQuery({
    queryKey: ['credential', worker.id],
    queryFn: () => workersApi.getCredential(worker.id),
  })

  const setMut = useMutation({
    mutationFn: () => workersApi.setCredential(worker.id, username, password),
    onSuccess: () => {
      setMsg('Credential bellendi')
      setUsername(''); setPassword('')
      qc.invalidateQueries({ queryKey: ['credential', worker.id] })
    },
    onError: (e: any) => setMsg(e.message),
  })

  const deactivateMut = useMutation({
    mutationFn: () => workersApi.deactivateCredential(worker.id),
    onSuccess: () => {
      setMsg('Deaktiwirlendi')
      qc.invalidateQueries({ queryKey: ['credential', worker.id] })
    },
    onError: (e: any) => setMsg(e.message),
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>{worker.name} — Giriş maglumatlary</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cred ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>@{cred.username}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Rol: {cred.role}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge variant={cred.isActive ? 'success' : 'neutral'}>{cred.isActive ? 'Aktif' : 'Öçürilen'}</Badge>
                {cred.isActive && (
                  <button className="btn btn-sm btn-danger" onClick={() => deactivateMut.mutate()} disabled={deactivateMut.isPending}>
                    Öçür
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Credential ýok</p>
          )}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{cred ? 'Täzele / Täze parol' : 'Täze credential'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input className="input" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
              <div style={{ position: 'relative' }}>
                <input
                  className="input" type={showPass ? 'text' : 'password'} placeholder="Parol"
                  value={password} onChange={e => setPassword(e.target.value)} style={{ paddingRight: 36 }}
                />
                <button type="button" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowPass(v => !v)}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button className="btn btn-primary" onClick={() => setMut.mutate()} disabled={setMut.isPending || !username || !password}>
                {setMut.isPending ? 'Ýazylýar...' : 'Belleý'}
              </button>
            </div>
          </div>
          {msg && <p style={{ fontSize: 12, color: 'var(--success)' }}>{msg}</p>}
        </div>
      </div>
    </div>
  )
}

export function SectionChiefsPage() {
  const [credWorker, setCredWorker] = useState<WorkerApi | null>(null)
  const [search, setSearch] = useState('')

  const { data: sectionChiefs = [], isLoading } = useQuery({
    queryKey: ['workers', 'section_chief'],
    queryFn: () => workersApi.list({ mobileRole: 'section_chief' }),
  })

  const filtered = (sectionChiefs as WorkerApi[]).filter(sc =>
    !search || sc.name.toLowerCase().includes(search.toLowerCase()) ||
    sc.workerId.toLowerCase().includes(search.toLowerCase()) ||
    sc.profession.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-left">
          <HardHat size={20} />
          <h1>Bölüm Başlyklary</h1>
          <span className="badge badge-warning">{sectionChiefs.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input" style={{ width: 240, paddingLeft: 32 }} placeholder="Gözle..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ padding: '0 0 12px', fontSize: 13, color: 'var(--text-muted)' }}>
        Excel import wagtynda Görev meýdany <strong>SEFI</strong> ýa-da <strong>ŞEFI</strong> bilen gutarýan işçiler awtomatik bu topara girýär. Olar formenlere birikdirilip bilinmez.
      </div>

      {isLoading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <HardHat size={40} />
          <p>{search ? 'Netije ýok' : 'Bölüm başlygy ýok. Excel import wagtynda Görev: "... SEFI" ýazgylary awtomatik bu topara girýär.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Ady</th>
                <th>Sicil No</th>
                <th>Wezipesi</th>
                <th>Ekip</th>
                <th>Status</th>
                <th>Credential</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sc, i) => (
                <tr key={sc.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{i + 1}</td>
                  <td><span style={{ fontWeight: 600 }}>{sc.name}</span></td>
                  <td><code style={{ fontSize: 11 }}>{sc.workerId}</code></td>
                  <td>
                    <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>{sc.profession || '—'}</span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sc.brigadeName || '—'}</td>
                  <td>
                    <Badge variant={sc.status === 'Active' ? 'success' : 'neutral'}>{sc.status}</Badge>
                  </td>
                  <td>
                    <CredentialBadge workerId={sc.id} />
                  </td>
                  <td>
                    <button className="btn-icon" title="Credential belleý" onClick={() => setCredWorker(sc)}>
                      <KeyRound size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {credWorker && <CredentialModal worker={credWorker} onClose={() => setCredWorker(null)} />}
    </div>
  )
}

function CredentialBadge({ workerId }: { workerId: string }) {
  const { data: cred } = useQuery({
    queryKey: ['credential', workerId],
    queryFn: () => workersApi.getCredential(workerId),
  })
  if (!cred) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ýok</span>
  return <Badge variant={cred.isActive ? 'success' : 'neutral'}>@{cred.username}</Badge>
}
