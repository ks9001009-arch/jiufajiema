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

type AdminMenuItem = {
  key: AdminPageKey
  label: string
  permission: string
}

const menus: AdminMenuItem[] = [
  { key: 'dashboard', label: '后台首页', permission: 'dashboard.view' },
  { key: 'companies', label: '公司管理', permission: 'company.view' },
  { key: 'teams', label: '团队管理', permission: 'team.view' },
  { key: 'roles', label: '角色管理', permission: 'role.view' },
  { key: 'users', label: '用户管理', permission: 'user.view' },
  { key: 'auditLogs', label: '操作日志', permission: 'auditLog.view' },
]

function getRolePermissions(user: CurrentUser | null) {
  return Array.isArray(user?.role?.permissions) ? user.role.permissions : []
}

function canViewMenu(user: CurrentUser | null, permission: string) {
  const permissions = getRolePermissions(user)

  // 临时兜底：角色还没有配置任何权限时，默认显示全部菜单，避免管理员看不到菜单
  if (permissions.length === 0) {
    return true
  }

  return permissions.includes(permission)
}

export function AdminLayout({
  user,
  activePage,
  onPageChange,
  onLogout,
  children,
}: AdminLayoutProps) {
  const displayName = user?.displayName || user?.name || user?.username || user?.phone || '管理员'
  const visibleMenus = menus.filter((menu) => canViewMenu(user, menu.permission))

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
          {visibleMenus.map((menu) => (
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
