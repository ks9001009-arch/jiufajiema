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
import { LoginPage } from './pages/LoginPage'
import { RolePage } from './pages/RolePage'
import { TeamPage } from './pages/TeamPage'
import { UserPage } from './pages/UserPage'
const PAGE_PERMISSIONS: Record<AdminPageKey, string> = {
  dashboard: 'user.read',
  companies: 'company.read',
  teams: 'team.read',
  roles: 'role.read',
  users: 'user.read',
  auditLogs: 'audit.read',
}

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
useEffect(() => {
  if (!user) {
    return
  }

  const permissions = user.role?.permissions ?? []

  const currentPermission = PAGE_PERMISSIONS[activePage]

  if (
    currentPermission &&
    permissions.length > 0 &&
    !permissions.includes(currentPermission)
  ) {
    const firstAvailablePage = (
      Object.keys(PAGE_PERMISSIONS) as AdminPageKey[]
    ).find(page =>
      permissions.includes(PAGE_PERMISSIONS[page])
    )

    if (firstAvailablePage) {
      setActivePage(firstAvailablePage)
    }
  }
}, [activePage, user])

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
  return (
    <section>
      <h1>后台首页</h1>
      <p>欢迎进入玖发接码平台管理后台。</p>
    </section>
  )
default:
  return <div>页面不存在</div>  
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

