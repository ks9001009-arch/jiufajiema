import { useEffect, useState } from 'react'
import {
  getAuditLogs,
  getCompanies,
  getRoles,
  getTeams,
  getUsers,
} from '../api/http'
import type {
  AdminUser,
  AuditLog,
  Company,
  CurrentUser,
  Role,
  Team,
} from '../api/http'

type DashboardPageProps = {
  user: CurrentUser | null
}

function formatDate(value?: string) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getActionText(action: string) {
  const map: Record<string, string> = {
    'company.create': '新增公司',
    'company.update': '编辑公司',
    'team.create': '新增团队',
    'team.update': '编辑团队',
    'role.create': '新增角色',
    'role.update': '编辑角色',
    'user.create': '新增用户',
    'user.update': '编辑用户',
    CREATE: '新增',
    UPDATE: '编辑',
    DELETE: '删除',
    LOGIN: '登录',
    LOGOUT: '退出',
  }

  return map[action] || action
}

function getActorName(log: AuditLog, users: AdminUser[]) {
  if (log.actorUser?.displayName) {
    return log.actorUser.displayName
  }

  if (log.actorUser?.username) {
    return log.actorUser.username
  }

  const user = users.find((item) => item.id === log.actorUserId)

  if (user) {
    return user.displayName || user.username
  }

  return log.actorUserId || '系统'
}

function getTargetName(
  log: AuditLog,
  companies: Company[],
  teams: Team[],
  roles: Role[],
  users: AdminUser[],
) {
  if (!log.targetId) {
    return '-'
  }

  if (log.targetType === 'Company' || log.targetType === 'company') {
    const company = companies.find((item) => item.id === log.targetId)
    return company?.name || log.targetId
  }

  if (log.targetType === 'Team' || log.targetType === 'team') {
    const team = teams.find((item) => item.id === log.targetId)
    return team?.name || log.targetId
  }

  if (log.targetType === 'Role' || log.targetType === 'role') {
    const role = roles.find((item) => item.id === log.targetId)
    return role?.name || log.targetId
  }

  if (log.targetType === 'User' || log.targetType === 'user') {
    const user = users.find((item) => item.id === log.targetId)
    return user?.displayName || user?.username || log.targetId
  }

  return log.targetId
}

export function DashboardPage({ user }: DashboardPageProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadDashboard() {
    setLoading(true)
    setError('')

    try {
      const [companyResult, teamResult, roleResult, userResult, logResult] =
        await Promise.all([
          getCompanies(),
          getTeams(),
          getRoles(),
          getUsers(),
          getAuditLogs(),
        ])

      setCompanies(companyResult)
      setTeams(teamResult)
      setRoles(roleResult)
      setUsers(userResult)
      setLogs(logResult.slice(0, 8))
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载后台首页数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const statCards = [
    {
      title: '公司数量',
      value: companies.length,
      desc: '当前系统内公司主体',
    },
    {
      title: '团队数量',
      value: teams.length,
      desc: '已创建的业务团队',
    },
    {
      title: '角色数量',
      value: roles.length,
      desc: '后台权限角色',
    },
    {
      title: '用户数量',
      value: users.length,
      desc: '后台账号与员工账号',
    },
  ]

  const displayName = user?.name || user?.username || user?.phone || '管理员'

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h2>后台首页</h2>
          <p>系统运营概览、最近操作记录和当前登录状态</p>
        </div>

        <button className="secondary-button" type="button" onClick={loadDashboard}>
          刷新首页
        </button>
      </div>

      {error ? <div className="table-error dashboard-error">{error}</div> : null}

      <div className="stats-grid">
        {statCards.map((item) => (
          <section className="stat-card" key={item.title}>
            <p>{item.title}</p>
            <strong>{loading ? '...' : item.value}</strong>
            <span>{item.desc}</span>
          </section>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel-card">
          <div className="panel-title">
            <h3>最近操作日志</h3>
            <span>Recent Activity</span>
          </div>

          <div className="recent-log-list">
            {loading ? (
              <div className="empty-state">正在加载最近操作...</div>
            ) : logs.length > 0 ? (
              logs.map((log) => (
                <div className="recent-log-item" key={log.id}>
                  <div>
                    <strong>{getActionText(log.action)}</strong>
                    <p>
                      {getActorName(log, users)} 操作了{' '}
                      {getTargetName(log, companies, teams, roles, users)}
                    </p>
                  </div>

                  <span>{formatDate(log.createdAt)}</span>
                </div>
              ))
            ) : (
              <div className="empty-state">暂无操作日志</div>
            )}
          </div>
        </section>

        <section className="panel-card">
          <div className="panel-title">
            <h3>系统状态</h3>
            <span>System</span>
          </div>

          <div className="status-list">
            <div>
              <span>后端接口</span>
              <strong>已接入</strong>
            </div>
            <div>
              <span>数据库</span>
              <strong>PostgreSQL</strong>
            </div>
            <div>
              <span>缓存</span>
              <strong>Redis</strong>
            </div>
            <div>
              <span>认证方式</span>
              <strong>JWT</strong>
            </div>
            <div>
              <span>当前账号</span>
              <strong>{displayName}</strong>
            </div>
            <div>
              <span>当前角色</span>
              <strong>{user?.role?.name || user?.role?.code || '-'}</strong>
            </div>
            <div>
              <span>当前公司</span>
              <strong>{user?.company?.name || '-'}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
