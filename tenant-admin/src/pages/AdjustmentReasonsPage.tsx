import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Plus, Edit2, ToggleLeft, ToggleRight } from 'lucide-react'
import { reasonsApi, type AdjustmentReason } from '../api/workTime'

export function AdjustmentReasonsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [editReason, setEditReason] = useState<AdjustmentReason | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const { data: reasons = [], isLoading } = useQuery({
    queryKey: ['adjustment-reasons'],
    queryFn: reasonsApi.getAll,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof reasonsApi.update>[1] }) =>
      reasonsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adjustment-reasons'] }),
  })

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <button onClick={() => navigate('/work-time')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13, marginBottom: 16, padding: 0 }}>
        <ChevronLeft size={16} /> Back to Work Time
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Adjustment Reasons</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Manage reasons used when adding work time adjustments</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Add Reason
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Description</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reasons.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < reasons.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{r.name}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{r.description || '—'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                      background: r.isActive ? '#dcfce7' : '#fee2e2',
                      color: r.isActive ? '#166534' : '#991b1b',
                    }}>
                      {r.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button onClick={() => setEditReason(r)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => updateMut.mutate({ id: r.id, data: { isActive: !r.isActive } })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: r.isActive ? '#ef4444' : '#22c55e', padding: 4 }}
                        title={r.isActive ? 'Disable' : 'Enable'}
                      >
                        {r.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {(showAdd || editReason) && (
        <ReasonModal
          existing={editReason}
          onClose={() => { setShowAdd(false); setEditReason(null) }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['adjustment-reasons'] }); setShowAdd(false); setEditReason(null) }}
        />
      )}
    </div>
  )
}

function ReasonModal({ existing, onClose, onSaved }: {
  existing: AdjustmentReason | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [error, setError] = useState('')

  const createMut = useMutation({
    mutationFn: () => reasonsApi.create({ name, description: description || undefined }),
    onSuccess: onSaved,
    onError: (e: any) => setError(e.message),
  })

  const updateMut = useMutation({
    mutationFn: () => reasonsApi.update(existing!.id, { name, description: description || null }),
    onSuccess: onSaved,
    onError: (e: any) => setError(e.message),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 24, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{existing ? 'Edit Reason' : 'Add Reason'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Evacuation"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button
            onClick={() => existing ? updateMut.mutate() : createMut.mutate()}
            disabled={!name.trim() || createMut.isPending || updateMut.isPending}
            className="btn btn-primary"
          >
            {createMut.isPending || updateMut.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
