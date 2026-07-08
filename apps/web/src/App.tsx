import { useEffect, useState } from 'react'
import './index.css'
import {
  clearAccessToken,
  getAccessToken,
  getMe,
  type CurrentUser,
} from './api/http'
import { AdminLayout } from './layouts/AdminLayout'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'

function App() {
  const [token, setToken] = useState<string | null>(() => getAccessToken())
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [checking, setChecking] = useState(Boolean(getAccessToken()))

  useEffect(() => {
    if (!token) {
      setUser(null)
      setChecking(false)
      return
    }

    let cancelled = false
    setChecking(true)

    getMe()
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser)
        }
      })
      .catch(() => {
        clearAccessToken()
        if (!cancelled) {
          setToken(null)
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setChecking(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [token])

  function handleLogin(newToken: string) {
    setToken(newToken)
  }

  function handleLogout() {
    clearAccessToken()
    setToken(null)
    setUser(null)
  }

  if (checking) {
    return (
      <main className="loading-page">
        <div className="loading-card">正在进入后台...</div>
      </main>
    )
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <AdminLayout user={user} onLogout={handleLogout}>
      <DashboardPage />
    </AdminLayout>
  )
}

export default App
