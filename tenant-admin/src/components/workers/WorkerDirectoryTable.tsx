import { AlertCircle, Edit2, KeyRound, LogIn, LogOut, Moon, Search, Sun, Trash2 } from 'lucide-react'
import type { MobileRole, WorkerApi } from '../../api/workers'
import { ROLE_LABELS, ROLE_VARIANTS, statusBadge } from '../../domain/workerMeta'
import { fmtHours, fmtTime, fmtToplamSaat } from '../../utils/dateTime'
import { Badge } from '../ui/Badge'

type WorkerDirectoryTableProps = {
  workers: WorkerApi[]
  isLoading: boolean
  error: unknown
  loadingText: string
  noDataText: string
  onOpenDetail: (workerId: string) => void
  onCredential: (worker: WorkerApi) => void
  onEdit: (worker: WorkerApi) => void
  onTerminate: (worker: WorkerApi) => void
}

export function WorkerDirectoryTable({
  workers,
  isLoading,
  error,
  loadingText,
  noDataText,
  onOpenDetail,
  onCredential,
  onEdit,
  onTerminate,
}: WorkerDirectoryTableProps) {
  return (
    <div className="card-body card-body--p0">
      {Boolean(error) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', color: 'var(--danger)', fontSize: 13 }}>
          <AlertCircle size={14} /> {String(error)} - Backend işleýärmi? (port 3002)
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sicil No</th>
              <th>Işçi</th>
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
              <tr><td colSpan={8}><div className="empty-state"><p>{loadingText}</p></div></td></tr>
            ) : workers.length === 0 ? (
              <tr><td colSpan={8}><div className="empty-state"><Search size={32} /><p>{noDataText}</p></div></td></tr>
            ) : workers.map(worker => (
              <WorkerDirectoryRow
                key={worker.id}
                worker={worker}
                onOpenDetail={onOpenDetail}
                onCredential={onCredential}
                onEdit={onEdit}
                onTerminate={onTerminate}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type WorkerDirectoryRowProps = {
  worker: WorkerApi
  onOpenDetail: (workerId: string) => void
  onCredential: (worker: WorkerApi) => void
  onEdit: (worker: WorkerApi) => void
  onTerminate: (worker: WorkerApi) => void
}

function WorkerDirectoryRow({
  worker,
  onOpenDetail,
  onCredential,
  onEdit,
  onTerminate,
}: WorkerDirectoryRowProps) {
  const status = statusBadge(worker.status)
  const mesai = worker.mesaiSistemi ?? 'Saatlik'
  const toplamSaat = fmtToplamSaat(worker.todayHoursMs, mesai)
  const hakykyInfo = fmtHours(worker.todayHoursMs)
  const role = (worker.mobileRole ?? 'worker') as MobileRole
  const extraSaat = Number(worker.extraSaat ?? 0)
  const checkIn = fmtTime(worker.lastCheckIn)
  const checkOut = fmtTime(worker.lastCheckOut)
  const avatarText = worker.name.trim().slice(0, 1).toUpperCase() || 'I'

  return (
    <tr>
      <td className="td-mono" style={{ fontSize: 11 }}>{worker.workerId}</td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              overflow: 'hidden',
              background: 'var(--border)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-muted)',
            }}
          >
            {worker.photoUrl
              ? <img src={worker.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : avatarText
            }
          </div>
          <div>
            <button
              type="button"
              className="link-button"
              style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary)' }}
              onClick={() => onOpenDetail(worker.id)}
            >
              {worker.name}
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {worker.profession || '-'}
            </div>
            {(worker.nfcCardUid || extraSaat > 0) && (
              <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                {worker.nfcCardUid && (
                  <Badge variant="success" style={{ fontSize: 10 }} title={worker.nfcCardUid}>
                    NFC
                  </Badge>
                )}
                {extraSaat > 0 && (
                  <Badge variant="warning" style={{ fontSize: 10 }}>
                    +{extraSaat}h
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
      <td>
        {checkIn
          ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--success)', fontSize: 12 }}><LogIn size={10} />{checkIn}</div>
          : <span className="td-muted" style={{ fontSize: 12 }}>-</span>
        }
        {checkOut && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--warning)', fontSize: 12, marginTop: 2 }}>
            <LogOut size={10} />{checkOut}
          </div>
        )}
      </td>
      <td>
        <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: 13 }}>{toplamSaat}</div>
        {hakykyInfo && toplamSaat !== hakykyInfo && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hakykyInfo}</div>
        )}
      </td>
      <td>
        <div style={{ fontSize: 12 }}>{worker.brigadeName || '-'}</div>
        <Badge dot variant={mesai === 'Aylık' ? 'info' : 'success'} style={{ fontSize: 10, marginTop: 2 }}>
          {mesai}
        </Badge>
      </td>
      <td>
        {worker.shift === 'day'
          ? <Badge dot variant="warning" style={{ fontSize: 11 }}><Sun size={10} /> Gündiz</Badge>
          : worker.shift === 'night'
          ? <Badge dot variant="neutral" style={{ fontSize: 11 }}><Moon size={10} /> Gije</Badge>
          : <span className="td-muted">-</span>
        }
      </td>
      <td>
        <Badge dot variant={status.variant} style={{ fontSize: 11 }}>{status.label}</Badge>
        {role !== 'worker' && (
          <div style={{ marginTop: 3 }}>
            <Badge dot variant={ROLE_VARIANTS[role]} style={{ fontSize: 10 }}>
              {ROLE_LABELS[role]}
            </Badge>
          </div>
        )}
      </td>
      <td>
        <div className="td-actions">
          <button
            className="btn btn--ghost btn--sm"
            type="button"
            title="Login/Parol"
            onClick={() => onCredential(worker)}
            style={{ color: role !== 'worker' ? 'var(--warning)' : undefined }}
          >
            <KeyRound size={13} />
          </button>
          <button className="btn btn--ghost btn--sm" type="button" title="Edit" onClick={() => onEdit(worker)}>
            <Edit2 size={13} />
          </button>
          <button
            className="btn btn--ghost btn--sm"
            type="button"
            title="Delete"
            onClick={() => onTerminate(worker)}
            style={{ color: 'var(--danger)' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}
