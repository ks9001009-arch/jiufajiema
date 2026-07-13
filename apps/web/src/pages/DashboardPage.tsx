import { useEffect, useState } from 'react'
import { getDashboardStats, type CurrentUser, type DashboardStats } from '../api/http'

type DashboardPageProps = {
  user: CurrentUser | null
}

const PLACEHOLDER_VALUE = '—'

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
    'team.create': '新增团队',
    'team.update': '编辑团队',
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
  }

  return map[action] || action
}

function getActorName(log: DashboardStats['recentAuditLogs'][number]) {
  return log.actorUser?.displayName || log.actorUser?.username || '系统'
}

function formatStatValue(value: number | undefined, loading: boolean) {
  if (loading) {
    return '...'
  }

  if (value === undefined) {
    return PLACEHOLDER_VALUE
  }

  return String(value)
}

export function DashboardPage({ user }: DashboardPageProps) {
  const displayName = user?.displayName || user?.username || '管理员'
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadStats() {
    setLoading(true)
    setError('')

    try {
      const result = await getDashboardStats()
      setStats(result)
    } catch (err) {
      setStats(null)
      setError(err instanceof Error ? err.message : '加载统计数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const baseStats = [
    { title: '公司', desc: '系统内公司主体', value: stats?.companyCount },
    { title: '团队', desc: '已创建业务团队', value: stats?.teamCount },
    { title: '用户', desc: '后台与员工账号', value: stats?.userCount },
    { title: '角色', desc: '后台权限角色', value: stats?.roleCount },
  ]

  const businessStats = [
    { title: '服务', desc: '已配置接码服务', value: stats?.serviceCount },
    { title: '供应商', desc: '已接入供应商', value: stats?.providerCount },
    { title: '可用号码', desc: '号码池可用数量', value: stats?.availablePhoneCount },
    { title: '今日订单', desc: '今日接码订单量', value: stats?.todayOrderCount },
    { title: '等待短信', desc: '等待接收的订单', value: stats?.waitingSmsOrderCount },
    { title: '今日短信', desc: '今日收到短信量', value: stats?.todaySmsCount },
    { title: '钱包余额', desc: '平台账户余额', value: undefined as number | undefined },
  ]

  return (
    <div className="dashboard-page">
      <section className="dashboard-welcome">
        <div className="dashboard-welcome-content">
          <div>
            <h2>欢迎回来，{displayName}</h2>
            <p>这里是玖发接码平台管理后台，以下数据来自实时统计接口。</p>
          </div>

          <button
            className="secondary-button dashboard-refresh-button"
            type="button"
            onClick={loadStats}
            disabled={loading}
          >
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>
      </section>

      {error ? <div className="page-error dashboard-error">{error}</div> : null}

      <div className="dashboard-section-title">
        <h3>基础统计</h3>
        <span>{loading ? '加载中...' : '实时数据'}</span>
      </div>

      <div className="stats-grid">
        {baseStats.map((item) => (
          <section className="stat-card" key={item.title}>
            <p>{item.title}</p>
            <strong>{formatStatValue(item.value, loading)}</strong>
            <span>{item.desc}</span>
          </section>
        ))}
      </div>

      <div className="dashboard-section-title">
        <h3>业务统计</h3>
        <span>{loading ? '加载中...' : '实时数据'}</span>
      </div>

      <div className="stats-grid">
        {businessStats.map((item) => (
          <section className="stat-card" key={item.title}>
            <p>{item.title}</p>
            <strong>
              {item.title === '钱包余额'
                ? PLACEHOLDER_VALUE
                : formatStatValue(item.value, loading)}
            </strong>
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

          {loading ? (
            <div className="empty-state">正在加载最近操作...</div>
          ) : stats?.recentAuditLogs.length ? (
            <div className="recent-log-list">
              {stats.recentAuditLogs.map((log) => (
                <div className="recent-log-item" key={log.id}>
                  <div>
                    <strong>{getActionText(log.action)}</strong>
                    <p>
                      {getActorName(log)}
                      {log.company?.name ? ` · ${log.company.name}` : ''}
                    </p>
                  </div>
                  <span>{formatDate(log.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">暂无操作日志</div>
          )}
        </section>

        <section className="panel-card">
          <div className="panel-title">
            <h3>当前登录</h3>
            <span>Session</span>
          </div>

          <div className="status-list">
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
