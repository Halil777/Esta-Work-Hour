import { Plus, Edit2, Shield, Globe, Building2, Users } from 'lucide-react'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { getTranslation } from '../i18n/translations'
import { permissionRows } from '../data/mock-data'

const roleColors: Record<string, string> = {
  'Super Admin': 'var(--primary)',
  'Central HR': 'var(--success)',
  'Regional Manager': 'var(--info)',
  'System Administrator': 'var(--warning)',
  'Auditor': 'var(--neutral)',
  'Object Admin': 'var(--text-secondary)',
}

const scopeIcon = (scope: string) => {
  if (scope === 'Global') return <Globe size={12} />
  if (scope.includes('region')) return <Building2 size={12} />
  return <Users size={12} />
}

export function RolesPage() {
  const { language } = useUiPreferences()
  const t = getTranslation(language)

  return (
    <>
      <div className="page-header">
        <h1>{t.roles.title}</h1>
        <div className="page-actions">
          <button className="btn btn--primary btn--sm"><Plus size={13} />{t.roles.createUser}</button>
        </div>
      </div>

      <div className="roles-grid">
        {permissionRows.map(row => {
          const color = roleColors[row.role] ?? 'var(--text-secondary)'
          return (
            <div key={row.role} className="role-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Shield size={14} color={color} />
                    </div>
                    <span className="role-card__name">{row.role}</span>
                  </div>
                  <div className="role-card__scope">
                    {scopeIcon(row.scope)}<span style={{ marginLeft: 4 }}>{row.scope}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-xs text-muted" style={{ marginBottom: 2 }}>{t.roles.userCount}</div>
                  <div className="fw-700" style={{ fontSize: 18 }}>{row.userCount}</div>
                </div>
              </div>

              <div className="role-card__perms">
                {[
                  { key: t.roles.exportLevel, val: row.exportLevel },
                  { key: t.roles.approvalFlow, val: row.approvalFlow },
                  { key: t.roles.auditAccess, val: row.auditAccess },
                ].map(p => (
                  <div key={p.key} className="role-perm">
                    <span className="role-perm__key">{p.key}</span>
                    <span className="role-perm__val">{p.val}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn--ghost btn--sm"><Edit2 size={12} />{t.roles.editRole}</button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="card-header"><h3>{t.roles.permissions} Matrix</h3></div>
        <div className="card-body card-body--p0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.roles.role}</th>
                  <th>{t.roles.scope}</th>
                  <th>{t.roles.exportLevel}</th>
                  <th>{t.roles.approvalFlow}</th>
                  <th>{t.roles.auditAccess}</th>
                  <th>{t.roles.userCount}</th>
                  <th>{t.roles.actions}</th>
                </tr>
              </thead>
              <tbody>
                {permissionRows.map(row => (
                  <tr key={row.role}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: roleColors[row.role] ?? 'var(--neutral)', flexShrink: 0 }} />
                        <span className="fw-600">{row.role}</span>
                      </div>
                    </td>
                    <td className="td-muted">{row.scope}</td>
                    <td>
                      <span className={`badge badge--${row.exportLevel === 'Full' ? 'success' : row.exportLevel === 'None' ? 'neutral' : 'info'}`}>
                        {row.exportLevel}
                      </span>
                    </td>
                    <td className="td-muted">{row.approvalFlow}</td>
                    <td>
                      <span className={`badge badge--${row.auditAccess === 'Full' ? 'primary' : row.auditAccess === 'Read' ? 'info' : 'neutral'}`}>
                        {row.auditAccess}
                      </span>
                    </td>
                    <td className="fw-600">{row.userCount}</td>
                    <td>
                      <button className="btn btn--ghost btn--sm"><Edit2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
