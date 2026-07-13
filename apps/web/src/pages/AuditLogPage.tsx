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
  Role,
  Team,
} from '../api/http'
import { PageHeader } from '../components/PageHeader'

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

function getActionText(action: string) {
  const map: Record<string, string> = {
    'company.create': '新增公司',
    'company.update': '编辑公司',
    'company.country.update': '公司开放国家变更',
    'team.create': '新增团队',
    'team.update': '编辑团队',
    'team.countryPolicy.update': '团队国家策略变更',
    'role.create': '新增角色',
    'role.update': '编辑角色',
    'user.create': '新增用户',
    'user.update': '编辑用户',
    'user.resetPassword': '重置用户密码',
    'provider.create': '新增供应商',
    'provider.update': '编辑供应商',
    'phoneResource.create': '新增号码资源',
    'phoneResource.update': '编辑号码资源',
    'order.create': '新增订单',
    'order.status': '订单状态变更',
    'order.force_success': '手工完成订单',
    'sms.create': '收到短信',
    'wallet.recharge': '钱包充值',
    'wallet.adjustment': '钱包调账',
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

function getTargetTypeText(targetType?: string | null) {
  const map: Record<string, string> = {
    Company: '公司',
    Team: '团队',
    Role: '角色',
    User: '用户',
    company: '公司',
    team: '团队',
    role: '角色',
    user: '用户',
  }

  if (!targetType) {
    return '-'
  }

  return map[targetType] || targetType
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

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadLogs() {
    setLoading(true)
    setError('')

    try {
      const [logResult, userResult, companyResult, teamResult, roleResult] =
        await Promise.all([
          getAuditLogs(),
          getUsers(),
          getCompanies(),
          getTeams(),
          getRoles(),
        ])

      setLogs(logResult)
      setUsers(userResult)
      setCompanies(companyResult)
      setTeams(teamResult)
      setRoles(roleResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载操作日志失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  return (
    <div className="manage-page">
      <PageHeader
        title="操作日志"
        subtitle="查看后台用户操作记录，当前页面已优化操作人、动作和目标显示。"
        actions={
          <button className="secondary-button" type="button" onClick={loadLogs}>
            刷新
          </button>
        }
      />

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>日志列表</strong>
          <span>
            {loading
              ? '正在加载...'
              : `共 ${logs.length} 条操作日志`}
          </span>
        </div>

        {error ? <div className="table-error">{error}</div> : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>操作人</th>
              <th>动作</th>
              <th>目标类型</th>
              <th>目标名称</th>
              <th>IP</th>
              <th>时间</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>正在加载操作日志...</td>
              </tr>
            ) : logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{getActorName(log, users)}</td>
                  <td>{getActionText(log.action)}</td>
                  <td>{getTargetTypeText(log.targetType)}</td>
                  <td>{getTargetName(log, companies, teams, roles, users)}</td>
                  <td>{log.ipAddress || '-'}</td>
                  <td>{formatDate(log.createdAt)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>暂无操作日志</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}

