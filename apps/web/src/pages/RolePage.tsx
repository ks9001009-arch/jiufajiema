import { useEffect, useState } from 'react'
import { getRoles } from '../api/http'
import type { Role } from '../api/http'

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

export function RolePage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadRoles() {
    setLoading(true)
    setError('')

    try {
      const result = await getRoles()
      setRoles(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载角色列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoles()
  }, [])

  return (
    <div className="manage-page">
      <div className="page-header">
        <div>
          <h2>角色管理</h2>
          <p>管理后台角色和权限分组，当前页面已经接入后端角色列表接口。</p>
        </div>

        <div className="page-actions">
          <button className="secondary-button" type="button" onClick={loadRoles}>
            刷新
          </button>

          <button className="primary-button" type="button">
            新增角色
          </button>
        </div>
      </div>

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>角色列表</strong>
          <span>
            {loading
              ? '正在加载...'
              : `共 ${roles.length} 条角色记录`}
          </span>
        </div>

        {error ? <div className="table-error">{error}</div> : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>角色名称</th>
              <th>角色编码</th>
              <th>描述</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>正在加载角色列表...</td>
              </tr>
            ) : roles.length > 0 ? (
              roles.map((role) => (
                <tr key={role.id}>
                  <td>{role.name}</td>
                  <td>{role.code}</td>
                  <td>{role.description || '-'}</td>
                  <td>{formatDate(role.createdAt)}</td>
                  <td>
                    <button className="text-button" type="button">
                      编辑
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>暂无角色数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
