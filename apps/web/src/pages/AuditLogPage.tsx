export function AuditLogPage() {
  return (
    <div className="manage-page">
      <div className="page-header">
        <div>
          <h2>操作日志</h2>
          <p>查看后台用户操作记录，后续会接入日志查询、筛选、详情查看等功能。</p>
        </div>
      </div>

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>日志列表</strong>
          <span>当前为页面框架，下一步接真实接口数据</span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>操作人</th>
              <th>动作</th>
              <th>目标类型</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4}>暂无数据</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}
