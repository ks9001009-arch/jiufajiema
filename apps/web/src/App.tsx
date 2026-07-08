import { useEffect, useState } from 'react'
import './index.css'
import {
  clearAccessToken,
  getAccessToken,
  getMe,
  type CurrentUser,
} from './api/http'
import { AdminLayout, type AdminPageKey } from './layouts/AdminLayout'
import { AuditLogPage } from './pages/AuditLogPage'
import { CompanyPage } from './pages/CompanyPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { RolePage } from './pages/RolePage'
import { TeamPage } from './pages/TeamPage'
import { UserPage } from './pages/UserPage'

function App() {
  const [token, setToken] = useState<string | null>(() => getAccessToken())
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [checking, setChecking] = useState(Boolean(getAccessToken()))
  const [activePage, setActivePage] = useState<AdminPageKey>('dashboard')

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
    setActivePage('dashboard')
  }

  function handleLogout() {
    clearAccessToken()
    setToken(null)
    setUser(null)
    setActivePage('dashboard')
  }

  function renderPage() {
    switch (activePage) {
      case 'companies':
        return <CompanyPage />
      case 'teams':
        return <TeamPage />
      case 'roles':
        return <RolePage />
      case 'users':
        return <UserPage />
      case 'auditLogs':
        return <AuditLogPage />
      case 'dashboard':
      default:
        return <DashboardPage user={user} />
    }
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
    <AdminLayout
      user={user}
      activePage={activePage}
      onPageChange={setActivePage}
      onLogout={handleLogout}
    >
      {renderPage()}
    </AdminLayout>
  )
}

export default App

