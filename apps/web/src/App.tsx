import { useEffect, useState } from 'react'
import './App.css'

const TOKEN_KEY = 'accessToken'
const API_BASE = 'http://127.0.0.1:3000'

type AuthUser = {
  username: string
  displayName: string | null
  companyId: string | null
  teamId: string | null
  roleId: string | null
}

function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)

    if (!token) {
      setLoading(false)
      return
    }

    fetchMe(token)
      .then((currentUser) => {
        setUser(currentUser)
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  async function fetchMe(token: string): Promise<AuthUser> {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error('fetch me failed')
    }

    return response.json()
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        setError('登录失败')
        return
      }

      const data = await response.json()
      localStorage.setItem(TOKEN_KEY, data.accessToken)

      const currentUser = await fetchMe(data.accessToken)
      setUser(currentUser)
      setPassword('')
    } catch {
      setError('登录失败')
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
    setUsername('')
    setPassword('')
    setError('')
  }

  if (loading) {
    return (
      <main className="page">
        <h1 className="title">玖发接码平台</h1>
        <p className="subtitle">后台管理登录</p>
        <p className="hint">加载中...</p>
      </main>
    )
  }

  return (
    <main className="page">
      <h1 className="title">玖发接码平台</h1>
      <p className="subtitle">后台管理登录</p>

      {user ? (
        <section className="card">
          <h2 className="card-title">当前用户</h2>
          <dl className="info-list">
            <div className="info-row">
              <dt>username</dt>
              <dd>{user.username}</dd>
            </div>
            <div className="info-row">
              <dt>displayName</dt>
              <dd>{user.displayName ?? '-'}</dd>
            </div>
            <div className="info-row">
              <dt>companyId</dt>
              <dd>{user.companyId ?? '-'}</dd>
            </div>
            <div className="info-row">
              <dt>teamId</dt>
              <dd>{user.teamId ?? '-'}</dd>
            </div>
            <div className="info-row">
              <dt>roleId</dt>
              <dd>{user.roleId ?? '-'}</dd>
            </div>
          </dl>
          <button type="button" className="button" onClick={handleLogout}>
            退出登录
          </button>
        </section>
      ) : (
        <form className="card form" onSubmit={handleLogin}>
          <label className="field">
            <span>username</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="field">
            <span>password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <p className="error">{error}</p> : null}

          <button type="submit" className="button">
            登录
          </button>
        </form>
      )}
    </main>
  )
}

export default App
