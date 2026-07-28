import { useState } from 'react'
import { Eye, EyeOff, Sun, Moon, Globe } from 'lucide-react'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { Navigate } from 'react-router-dom'
import { superAdminApi } from '../api/superAdminApi'
import type { Language } from '../types/admin'

export function LoginPage() {
  const { user, login, theme, toggleTheme, language, setLanguage } = useUiPreferences()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, user: authUser } = await superAdminApi.login(username, password)
      localStorage.setItem('superAdminJwt', token)
      login({ name: authUser.name, role: authUser.role })
    } catch (err: any) {
      setError(err.message || 'Ýalňyş username ýa-da parol')
    } finally {
      setLoading(false)
    }
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
          <div className="login-brand__name">WorkHour</div>
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
              placeholder="superadmin"
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
            {loading ? 'Girýär...' : 'Gir'}
          </button>
        </form>
      </div>
    </div>
  )
}
