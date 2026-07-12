import type { CurrentUser } from '../api/http'

type DashboardPageProps = {
  user: CurrentUser | null
}

type StatCard = {
  title: string
  desc: string
}

// 统计 API 尚未接入，统一使用占位符，不展示伪造数据
const PLACEHOLDER_VALUE = '—'

const baseStats: StatCard[] = [
  { title: '公司', desc: '系统内公司主体' },
  { title: '团队', desc: '已创建业务团队' },
  { title: '用户', desc: '后台与员工账号' },
  { title: '角色', desc: '后台权限角色' },
]

const businessStats: StatCard[] = [
  { title: '可用号码', desc: '号码池可用数量' },
  { title: '今日订单', desc: '今日接码订单量' },
  { title: '等待短信', desc: '等待接收的短信' },
  { title: '钱包余额', desc: '平台账户余额' },
]

export function DashboardPage({ user }: DashboardPageProps) {
  const displayName = user?.displayName || user?.username || '管理员'

  return (
    <div className="dashboard-page">
      <section className="dashboard-welcome">
        <h2>欢迎回来，{displayName}</h2>
        <p>这里是玖发接码平台管理后台，运营数据概览将随统计接口逐步接入。</p>
      </section>

      <div className="dashboard-section-title">
        <h3>基础统计</h3>
        <span>统计接口接入后自动更新</span>
      </div>

      <div className="stats-grid">
        {baseStats.map((item) => (
          <section className="stat-card" key={item.title}>
            <p>{item.title}</p>
            <strong>{PLACEHOLDER_VALUE}</strong>
            <span>{item.desc}</span>
          </section>
        ))}
      </div>

      <div className="dashboard-section-title">
        <h3>业务统计</h3>
        <span>待接入</span>
      </div>

      <div className="stats-grid">
        {businessStats.map((item) => (
          <section className="stat-card" key={item.title}>
            <p>{item.title}</p>
            <strong>{PLACEHOLDER_VALUE}</strong>
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

          <div className="empty-state">操作日志接口接入后在此展示最近记录</div>
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
