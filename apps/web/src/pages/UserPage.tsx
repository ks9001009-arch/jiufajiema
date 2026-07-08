import { useEffect, useState } from 'react'
import { getUsers } from '../api/http'
import type { AdminUser, AdminUserStatus } from '../api/http'

function formatDate(value?: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusText(status?: AdminUserStatus) {
  if (status === 'ACTIVE') {
    return '启用'
  }

  if (status === 'DISABLED') {
    return '停用'
  }

  return status || '-'
}

function getStatusClass(status?: AdminUserStatus) {
  if (status === 'ACTIVE') {
    return 'active'
  }

  if (status === 'DISABLED') {
    return 'disabled'
  }

  return 'disabled'
}

function getDisplayName(user: AdminUser) {
  return user.displayName || user.name || '-'
}

function getCompanyName(user: AdminUser) {
  return user.company?.name || user.companyId || '-'
}

function getTeamName(user: AdminUser) {
  return user.team?.name || user.teamId || '-'
}

function getRoleName(user: AdminUser) {
  return user.role?.name || user.roleId || '-'
}

export function UserPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadUsers() {
    setLoading(true)
    setError('')

    try {
      const result = await getUsers()
      setUsers(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  return (
    <div className="manage-page">
      <div className="page-header">
        <div>
          <h2>用户管理</h2>
          <p>管理后台账号、员工账号、所属公司团队和角色，当前页面已经接入后端用户列表接口。</p>
        </div>

        <div className="page-actions">
          <button className="secondary-button" type="button" onClick={loadUsers}>
            刷新
          </button>

          <button className="primary-button" type="button">
            新增用户
          </button>
        </div>
      </div>

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>用户列表</strong>
          <span>
            {loading
              ? '正在加载...'
              : `共 ${users.length} 条用户记录`}
          </span>
        </div>

        {error ? <div className="table-error">{error}</div> : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>账号</th>
              <th>姓名</th>
              <th>公司</th>
              <th>团队</th>
              <th>角色</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>正在加载用户列表...</td>
              </tr>
            ) : users.length > 0 ? (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{getDisplayName(user)}</td>
                  <td>{getCompanyName(user)}</td>
                  <td>{getTeamName(user)}</td>
                  <td>{getRoleName(user)}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(user.status)}`}>
                      {getStatusText(user.status)}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <button className="text-button" type="button">
                      编辑
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>暂无用户数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
