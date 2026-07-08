import type { ReactNode } from 'react'
import type { CurrentUser } from '../api/http'

type AdminLayoutProps = {
  user: CurrentUser | null
  onLogout: () => void
  children: ReactNode
}

const menus = [
  '后台首页',
  '公司管理',
  '团队管理',
  '角色管理',
  '用户管理',
  '操作日志',
]

export function AdminLayout({ user, onLogout, children }: AdminLayoutProps) {
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
          {menus.map((menu, index) => (
            <button
              key={menu}
              type="button"
              className={index === 0 ? 'active' : ''}
            >
              {menu}
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
