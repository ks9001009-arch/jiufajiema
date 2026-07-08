export function RolePage() {
  return (
    <div className="manage-page">
      <div className="page-header">
        <div>
          <h2>角色管理</h2>
          <p>管理后台角色和权限分组，后续会接入角色列表、新增、编辑、权限配置等功能。</p>
        </div>

        <button className="primary-button" type="button">
          新增角色
        </button>
      </div>

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>角色列表</strong>
          <span>当前为页面框架，下一步接真实接口数据</span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>角色名称</th>
              <th>角色编码</th>
              <th>描述</th>
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
