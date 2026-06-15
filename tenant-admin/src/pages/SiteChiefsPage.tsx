import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, KeyRound, X, Eye, EyeOff } from 'lucide-react'
import { workersApi, type WorkerApi } from '../api/workers'
import { extraHoursApi, type ExtraHoursRequest } from '../api/extraHours'
import { useUiPreferences } from '../app/providers/useUiPreferences'

function Badge({ variant, children }: { variant: string; children: React.ReactNode }) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}

function CredentialModal({
  worker,
  onClose,
}: {
  worker: WorkerApi
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { user } = useUiPreferences()
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
            <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'var(--card2)', border: '1px solid var(--border)' }}>
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
              <input
                className="input"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Parol"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingRight: 36 }}
                />
                <button
                  type="button"
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  onClick={() => setShowPass(v => !v)}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setMut.mutate()}
                disabled={setMut.isPending || !username || !password}
              >
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

export function SiteChiefsPage() {
  const [credWorker, setCredWorker] = useState<WorkerApi | null>(null)
  const [search, setSearch] = useState('')

  const { data: siteChiefs = [], isLoading } = useQuery({
    queryKey: ['workers', 'site_chief'],
    queryFn: () => workersApi.list({ mobileRole: 'site_chief' }),
  })

  const { data: extraRequests = [] } = useQuery({
    queryKey: ['extra-hours', 'all'],
    queryFn: () => extraHoursApi.list(),
  })

  // Build stats per site chief
  const statsMap = new Map<string, { total: number; pending: number; approved: number; rejected: number; totalHrs: number }>()
  for (const req of extraRequests as ExtraHoursRequest[]) {
    const key = req.siteChiefWorkerEntityId
    const s = statsMap.get(key) ?? { total: 0, pending: 0, approved: 0, rejected: 0, totalHrs: 0 }
    s.total++
    if (req.status === 'pending' || req.status === 'seen') s.pending++
    if (req.status === 'approved') {
      s.approved++
      s.totalHrs += req.items.reduce((a, i) => a + Number(i.extraHours), 0)
    }
    if (req.status === 'rejected') s.rejected++
    statsMap.set(key, s)
  }

  const filtered = (siteChiefs as WorkerApi[]).filter(sc =>
    !search || sc.name.toLowerCase().includes(search.toLowerCase()) || sc.workerId.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-left">
          <ShieldCheck size={20} />
          <h1>Site Chiefs</h1>
          <span className="badge badge-info">{siteChiefs.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            style={{ width: 240 }}
            placeholder="Gözle..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <ShieldCheck size={40} />
          <p>{search ? 'Netije ýok' : 'Site Chief ýok. Workers sahypasynda mobileRole = site_chief belli ediň.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Işçi</th>
                <th>Sicil No</th>
                <th>Görev</th>
                <th>Jemi sorag</th>
                <th>Garaşylýar</th>
                <th>Tassyklandy</th>
                <th>Ret edildi</th>
                <th>Tassykl. sagat</th>
                <th>Credential</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sc => {
                const stats = statsMap.get(sc.id) ?? { total: 0, pending: 0, approved: 0, rejected: 0, totalHrs: 0 }
                return (
                  <tr key={sc.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{sc.name}</div>
                    </td>
                    <td><code style={{ fontSize: 11 }}>{sc.workerId}</code></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{sc.profession || '—'}</td>
                    <td>
                      <span style={{ fontWeight: 700 }}>{stats.total}</span>
                    </td>
                    <td>
                      {stats.pending > 0
                        ? <Badge variant="warning">{stats.pending}</Badge>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>
                      }
                    </td>
                    <td>
                      {stats.approved > 0
                        ? <Badge variant="success">{stats.approved}</Badge>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>
                      }
                    </td>
                    <td>
                      {stats.rejected > 0
                        ? <Badge variant="danger">{stats.rejected}</Badge>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>
                      }
                    </td>
                    <td>
                      {stats.totalHrs > 0
                        ? <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{stats.totalHrs}h</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>
                      }
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
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {credWorker && (
        <CredentialModal worker={credWorker} onClose={() => setCredWorker(null)} />
      )}
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
