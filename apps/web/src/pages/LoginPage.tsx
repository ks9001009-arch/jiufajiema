import { useState } from 'react'
import type { FormEvent } from 'react'
import { login, setAccessToken } from '../api/http'

type LoginPageProps = {
  onLogin: (token: string) => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await login(username, password)
      const token = result.accessToken || result.access_token || result.token

      if (!token) {
        throw new Error('登录成功，但后端没有返回 Token')
      }

      setAccessToken(token)
      onLogin(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-logo">玖</div>
          <div>
            <h1>玖发接码平台</h1>
            <p>后台管理系统</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>账号</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="请输入管理员账号"
              autoComplete="username"
            />
          </label>

          <label>
            <span>密码</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
              type="password"
              autoComplete="current-password"
            />
          </label>

          {error ? <div className="form-error">{error}</div> : null}

          <button type="submit" disabled={loading}>
            {loading ? '登录中...' : '登录后台'}
          </button>
        </form>
      </section>
    </main>
  )
}
