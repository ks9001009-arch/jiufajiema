const statCards = [
  {
    title: '公司数量',
    value: '0',
    desc: '当前系统内公司主体',
  },
  {
    title: '团队数量',
    value: '0',
    desc: '已创建的业务团队',
  },
  {
    title: '用户数量',
    value: '0',
    desc: '后台账号与员工账号',
  },
  {
    title: '今日操作日志',
    value: '0',
    desc: '今日后台操作记录',
  },
]

const quickActions = [
  '公司管理',
  '团队管理',
  '角色管理',
  '用户管理',
  '操作日志',
]

export function DashboardPage() {
  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h2>后台首页</h2>
          <p>欢迎进入玖发接码平台管理后台</p>
        </div>
      </div>

      <div className="stats-grid">
        {statCards.map((item) => (
          <section className="stat-card" key={item.title}>
            <p>{item.title}</p>
            <strong>{item.value}</strong>
            <span>{item.desc}</span>
          </section>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel-card">
          <div className="panel-title">
            <h3>快捷入口</h3>
            <span>Management</span>
          </div>

          <div className="quick-actions">
            {quickActions.map((item) => (
              <button key={item} type="button">
                {item}
              </button>
            ))}
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
          </div>
        </section>
      </div>
    </div>
  )
}
