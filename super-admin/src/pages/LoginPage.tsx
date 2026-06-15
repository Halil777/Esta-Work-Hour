import { useState } from 'react'
import { Eye, EyeOff, Sun, Moon, Globe } from 'lucide-react'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { Navigate } from 'react-router-dom'
import type { AuthUser, Language } from '../types/admin'

const DEMO_USERS: Array<{ username: string; password: string } & AuthUser> = [
  { username: 'admin', password: 'admin123', role: 'SuperAdmin', name: 'Alexander Ivanov', email: 'admin@esta.build' },
  { username: 'hr', password: 'hr123', role: 'CentralHR', name: 'Elena Smirnova', email: 'hr@esta.build' },
  { username: 'auditor', password: 'audit123', role: 'Auditor', name: 'Maria Kuznetsova', email: 'audit@esta.build' },
]

export function LoginPage() {
  const { user, login, theme, toggleTheme, language, setLanguage } = useUiPreferences()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setTimeout(() => {
      const found = DEMO_USERS.find(u => u.username === username && u.password === password)
      if (found) {
        login({ name: found.name, role: found.role, email: found.email ?? undefined })
      } else {
        setError('Invalid credentials. Try admin / admin123')
      }
      setLoading(false)
    }, 600)
  }

  const LANGS: { code: Language; label: string }[] = [
    { code: 'ru', label: 'RU' },
    { code: 'en', label: 'EN' },
    { code: 'tr', label: 'TR' },
  ]

  return (
    <div className="login-page">
      <div style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        {LANGS.map(l => (
          <button
            key={l.code}
            className={`btn btn--sm ${language === l.code ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setLanguage(l.code)}
          >
            {l.label}
          </button>
        ))}
        <button className="btn btn--ghost btn--sm" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      <div className="login-box">
        <div className="login-brand">
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <Globe size={22} color="#fff" />
          </div>
          <div className="login-brand__name">Esta Construction</div>
          <div className="login-brand__sub">Super Admin Portal</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label">Username</label>
            <input
              className="form-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                style={{ paddingRight: 38 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                  padding: 0, display: 'flex',
                }}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--danger)', padding: '6px 10px', background: 'var(--danger-light)', borderRadius: 6 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading}
            style={{ marginTop: 4, justifyContent: 'center' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: 16, padding: '10px 12px',
          background: 'var(--bg-surface-2)', borderRadius: 8,
          border: '1px solid var(--border)',
        }}>
          <div className="text-xs text-muted" style={{ marginBottom: 6, fontWeight: 600 }}>Demo credentials</div>
          {DEMO_USERS.map(u => (
            <div key={u.username} className="text-xs text-muted" style={{ marginBottom: 2 }}>
              <span className="fw-600" style={{ color: 'var(--text)' }}>{u.username}</span> / {u.password}
              <span style={{ marginLeft: 6, color: 'var(--primary)' }}>({u.role})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
