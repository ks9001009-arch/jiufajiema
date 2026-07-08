export function UserPage() {
  return (
    <div className="manage-page">
      <div className="page-header">
        <div>
          <h2>用户管理</h2>
          <p>管理后台账号、员工账号、所属公司团队和角色，后续会接入新增、编辑、重置密码等功能。</p>
        </div>

        <button className="primary-button" type="button">
          新增用户
        </button>
      </div>

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>用户列表</strong>
          <span>当前为页面框架，下一步接真实接口数据</span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>账号</th>
              <th>姓名</th>
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
