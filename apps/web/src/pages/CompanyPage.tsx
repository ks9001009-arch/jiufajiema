export function CompanyPage() {
  return (
    <div className="manage-page">
      <div className="page-header">
        <div>
          <h2>公司管理</h2>
          <p>管理平台内的公司主体，后续会接入公司列表、新增、编辑、停用等功能。</p>
        </div>

        <button className="primary-button" type="button">
          新增公司
        </button>
      </div>

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>公司列表</strong>
          <span>当前为页面框架，下一步接真实接口数据</span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>公司名称</th>
              <th>状态</th>
              <th>创建时间</th>
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
