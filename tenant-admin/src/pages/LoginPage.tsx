import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Eye, EyeOff, Sun, Moon } from 'lucide-react'
import { useUiPreferences } from '../app/providers/useUiPreferences'
import { adminAuthApi } from '../api/adminAuth'

export function LoginPage() {
  const { login, theme, toggleTheme } = useUiPreferences()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!username || !password) { setError('Username we paroly giriziň'); return }
    setLoading(true)
    setError('')
    try {
      const { token, user } = await adminAuthApi.login(username, password)
      localStorage.setItem('adminJwt', token)
      login(user)
      navigate('/dashboard', { replace: true })
    } catch (e: any) {
      setError(e.message ?? 'Giriş başartmady')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page" style={{ position: 'relative' }}>
      <button
        className="icon-btn"
        style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="login-box">
        <div className="login-logo">
          <div className="login-logo-icon"><Building2 size={20} /></div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Tenant Admin</h1>
            <p style={{ fontSize: 11, margin: 0, marginTop: 2, color: 'var(--text-muted)' }}>Esta Construction Platform</p>
          </div>
        </div>

        <div className="login-form">
          <div className="form-row">
            <label className="form-label">Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
              placeholder="admin"
              autoFocus
            />
          </div>
          <div className="form-row">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
                placeholder="••••••••"
                style={{ paddingRight: 36 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  display: 'flex', padding: 0,
                }}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '8px 12px', background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 8, fontSize: 12, color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <button
            className="btn btn--primary w-full"
            style={{ justifyContent: 'center', padding: '10px', marginTop: 4 }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Girýär…' : 'Giriş'}
          </button>
        </div>
      </div>
    </div>
  )
}
