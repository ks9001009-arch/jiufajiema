export function TeamPage() {
  return (
    <div className="manage-page">
      <div className="page-header">
        <div>
          <h2>团队管理</h2>
          <p>管理公司下的业务团队，后续会接入团队列表、新增、编辑、成员分配等功能。</p>
        </div>

        <button className="primary-button" type="button">
          新增团队
        </button>
      </div>

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>团队列表</strong>
          <span>当前为页面框架，下一步接真实接口数据</span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>团队名称</th>
              <th>所属公司</th>
              <th>状态</th>
              <th>操作</th>
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
