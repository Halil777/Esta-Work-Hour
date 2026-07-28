import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, RefreshCw, Eye, EyeOff, Building2 } from 'lucide-react'
import { superAdminApi, type TenantDto, type CreateTenantPayload, type UpdateTenantPayload } from '../api/superAdminApi'

type ModalMode = 'create' | 'edit'

const EMPTY_FORM: CreateTenantPayload = {
  name: '',
  adminUsername: '',
  adminPassword: '',
  logoUrl: '',
  isActive: true,
}

export function TenantsPage() {
  const [tenants, setTenants] = useState<TenantDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateTenantPayload & UpdateTenantPayload>(EMPTY_FORM)
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await superAdminApi.tenants.list()
      setTenants(data)
    } catch (e: any) {
      setError(e.message || 'Ýalňyşlyk ýüze çykdy')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setModalMode('create')
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setFormError('')
    setShowPass(false)
    setModalOpen(true)
  }

  const openEdit = (t: TenantDto) => {
    setModalMode('edit')
    setEditingId(t.id)
    setForm({
      name: t.name,
      adminUsername: t.adminUsername,
      adminPassword: '',
      logoUrl: t.logoUrl ?? '',
      isActive: t.isActive,
    })
    setFormError('')
    setShowPass(false)
    setModalOpen(true)
  }

  const handleSave = async () => {
    setFormError('')
    if (!form.name?.trim()) { setFormError('Tenant ady hökmany'); return }
    if (!form.adminUsername?.trim()) { setFormError('Username hökmany'); return }
    if (modalMode === 'create' && !form.adminPassword?.trim()) { setFormError('Parol hökmany'); return }
    if (form.adminPassword && form.adminPassword.length < 6) { setFormError('Parol azyndan 6 harp bolmaly'); return }

    setSaving(true)
    try {
      if (modalMode === 'create') {
        const payload: CreateTenantPayload = {
          name: form.name!.trim(),
          adminUsername: form.adminUsername!.trim(),
          adminPassword: form.adminPassword!,
          logoUrl: form.logoUrl?.trim() || undefined,
          isActive: form.isActive ?? true,
        }
        await superAdminApi.tenants.create(payload)
      } else if (editingId) {
        const payload: UpdateTenantPayload = {}
        if (form.name?.trim()) payload.name = form.name.trim()
        if (form.adminUsername?.trim()) payload.adminUsername = form.adminUsername.trim()
        if (form.adminPassword?.trim()) payload.adminPassword = form.adminPassword.trim()
        if (form.logoUrl !== undefined) payload.logoUrl = form.logoUrl?.trim() || undefined
        if (form.isActive !== undefined) payload.isActive = form.isActive
        await superAdminApi.tenants.update(editingId, payload)
      }
      setModalOpen(false)
      await load()
    } catch (e: any) {
      setFormError(e.message || 'Ýalňyşlyk ýüze çykdy')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (t: TenantDto) => {
    try {
      await superAdminApi.tenants.update(t.id, { isActive: !t.isActive })
      await load()
    } catch (e: any) {
      alert(e.message || 'Ýalňyşlyk')
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(null)
    try {
      await superAdminApi.tenants.remove(id)
      await load()
    } catch (e: any) {
      alert(e.message || 'Ýalňyşlyk')
    }
  }

  return (
    <>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 size={20} />
          Tenant Adminleri
        </h1>
        <div className="page-actions">
          <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Täzele
          </button>
          <button className="btn btn--primary btn--sm" onClick={openCreate}>
            <Plus size={13} />
            Täze Tenant
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', background: 'var(--danger-light)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', fontSize: 13 }}>
          Ýüklenýär...
        </div>
      ) : tenants.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: 'var(--text-secondary)', fontSize: 13,
          background: 'var(--bg-surface)', borderRadius: 12, border: '1px dashed var(--border)',
        }}>
          Heniz hiç tenant döredilmedi.<br />
          <button className="btn btn--primary btn--sm" onClick={openCreate} style={{ marginTop: 14 }}>
            <Plus size={13} />
            Ilkinji Tenant döret
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {tenants.map(t => (
            <div key={t.id} style={{
              background: 'var(--bg-surface)',
              border: `1px solid ${t.isActive ? 'var(--border)' : 'var(--danger)'}`,
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              opacity: t.isActive ? 1 : 0.7,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {t.logoUrl ? (
                    <img
                      src={t.logoUrl}
                      alt={t.name}
                      style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain', background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, color: '#fff',
                    }}>
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      @{t.adminUsername}
                    </div>
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 12,
                  background: t.isActive ? 'var(--success-light, rgba(34,197,94,.15))' : 'var(--danger-light)',
                  color: t.isActive ? 'var(--success, #22c55e)' : 'var(--danger)',
                }}>
                  {t.isActive ? 'Işjeň' : 'Öçürilen'}
                </span>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Döredilen: {new Date(t.createdAt).toLocaleDateString('tr-TR')}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  className="btn btn--ghost btn--sm"
                  style={{ flex: 1 }}
                  onClick={() => openEdit(t)}
                >
                  <Pencil size={12} />
                  Üýtget
                </button>
                <button
                  className={`btn btn--sm ${t.isActive ? 'btn--warning' : 'btn--success'}`}
                  style={{ flex: 1, background: t.isActive ? 'rgba(245,158,11,.15)' : 'rgba(34,197,94,.15)', color: t.isActive ? 'var(--warning)' : 'var(--success)', border: 'none' }}
                  onClick={() => handleToggleActive(t)}
                >
                  {t.isActive ? <ToggleLeft size={12} /> : <ToggleRight size={12} />}
                  {t.isActive ? 'Öçür' : 'Aç'}
                </button>
                <button
                  className="btn btn--danger btn--sm"
                  style={{ background: 'rgba(239,68,68,.1)', color: 'var(--danger)', border: 'none' }}
                  onClick={() => setDeletingId(t.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
        }}>
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 14, padding: 28,
            width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>
              {modalMode === 'create' ? 'Täze Tenant döret' : 'Tenant üýtget'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Tenant ady *</label>
                <input
                  className="form-input"
                  value={form.name ?? ''}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Meselem: Esta Construction"
                />
              </div>

              <div>
                <label className="form-label">Admin Username *</label>
                <input
                  className="form-input"
                  value={form.adminUsername ?? ''}
                  onChange={e => setForm(f => ({ ...f, adminUsername: e.target.value }))}
                  placeholder="admin"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="form-label">
                  {modalMode === 'create' ? 'Parol *' : 'Täze parol (boş galdyrsa üýtgemeýär)'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    type={showPass ? 'text' : 'password'}
                    value={form.adminPassword ?? ''}
                    onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                    placeholder="Azyndan 6 harp"
                    autoComplete="new-password"
                    style={{ paddingRight: 38 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, display: 'flex' }}
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label">Logo URL (islege bagly)</label>
                <input
                  className="form-input"
                  value={form.logoUrl ?? ''}
                  onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive ?? true}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  style={{ width: 16, height: 16 }}
                />
                <label htmlFor="isActive" style={{ fontSize: 13, cursor: 'pointer' }}>
                  Işjeň (Admin panel açyk)
                </label>
              </div>
            </div>

            {formError && (
              <div style={{ fontSize: 12, color: 'var(--danger)', padding: '6px 10px', background: 'var(--danger-light)', borderRadius: 6 }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn btn--secondary btn--sm" onClick={() => setModalOpen(false)} disabled={saving}>
                Ýatyr
              </button>
              <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saklanýar...' : modalMode === 'create' ? 'Döret' : 'Sakla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
        }}>
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 14, padding: 28,
            width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            <h2 style={{ margin: 0, fontSize: 16, color: 'var(--danger)' }}>Tenanti öçür</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Bu tenanti we onuň ähli maglumatlaryny hakykatdan hem öçürjekmi?
              Bu amal yzyna gaýtarylyp bilinmez.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn--secondary btn--sm" onClick={() => setDeletingId(null)}>
                Ýatyr
              </button>
              <button className="btn btn--danger btn--sm" onClick={() => handleDelete(deletingId)}>
                Öçür
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
