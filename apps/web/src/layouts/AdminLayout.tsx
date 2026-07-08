import type { ReactNode } from 'react'
import type { CurrentUser } from '../api/http'

export type AdminPageKey =
  | 'dashboard'
  | 'companies'
  | 'teams'
  | 'roles'
  | 'users'
  | 'auditLogs'

type AdminLayoutProps = {
  user: CurrentUser | null
  activePage: AdminPageKey
  onPageChange: (page: AdminPageKey) => void
  onLogout: () => void
  children: ReactNode
}

const menus: Array<{ key: AdminPageKey; label: string }> = [
  { key: 'dashboard', label: '后台首页' },
  { key: 'companies', label: '公司管理' },
  { key: 'teams', label: '团队管理' },
  { key: 'roles', label: '角色管理' },
  { key: 'users', label: '用户管理' },
  { key: 'auditLogs', label: '操作日志' },
]

export function AdminLayout({
  user,
  activePage,
  onPageChange,
  onLogout,
  children,
}: AdminLayoutProps) {
  const displayName = user?.name || user?.username || user?.phone || '管理员'

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">玖</div>
          <div>
            <strong>玖发接码</strong>
            <span>Admin Console</span>
          </div>
        </div>

        <nav className="sidebar-menu">
          {menus.map((menu) => (
            <button
              key={menu.key}
              type="button"
              className={activePage === menu.key ? 'active' : ''}
              onClick={() => onPageChange(menu.key)}
            >
              {menu.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>管理后台</h1>
            <p>当前登录：{displayName}</p>
          </div>

          <button className="logout-button" type="button" onClick={onLogout}>
            退出登录
          </button>
        </header>

        <main className="admin-content">{children}</main>
      </div>
    </div>
  )
}
