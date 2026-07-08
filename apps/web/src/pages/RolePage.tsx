import { useEffect, useState } from 'react'
import { createRole, getRoles } from '../api/http'
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

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

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

  function openCreateModal() {
    setName('')
    setCode('')
    setDescription('')
    setFormError('')
    setModalOpen(true)
  }

  function closeCreateModal() {
    if (saving) {
      return
    }

    setModalOpen(false)
  }

  async function handleCreateRole() {
    const trimmedName = name.trim()
    const trimmedCode = code.trim()
    const trimmedDescription = description.trim()

    if (!trimmedName) {
      setFormError('请输入角色名称')
      return
    }

    if (!trimmedCode) {
      setFormError('请输入角色编码')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      await createRole({
        name: trimmedName,
        code: trimmedCode,
        description: trimmedDescription || undefined,
      })

      setModalOpen(false)
      await loadRoles()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '新增角色失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="manage-page">
      <div className="page-header">
        <div>
          <h2>角色管理</h2>
          <p>管理后台角色和权限分组，当前页面已经接入角色列表和新增接口。</p>
        </div>

        <div className="page-actions">
          <button className="secondary-button" type="button" onClick={loadRoles}>
            刷新
          </button>

          <button className="primary-button" type="button" onClick={openCreateModal}>
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

      {modalOpen ? (
        <div className="modal-mask">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>新增角色</h3>
                <p>创建一个新的后台角色</p>
              </div>

              <button className="modal-close" type="button" onClick={closeCreateModal}>
                ×
              </button>
            </div>

            <div className="modal-form">
              <label>
                <span>角色名称</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：管理员"
                />
              </label>

              <label>
                <span>角色编码</span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="例如：ADMIN"
                />
              </label>

              <label>
                <span>描述</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="例如：拥有后台管理权限"
                  rows={4}
                />
              </label>

              {formError ? <div className="form-error">{formError}</div> : null}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                type="button"
                onClick={closeCreateModal}
                disabled={saving}
              >
                取消
              </button>

              <button
                className="primary-button"
                type="button"
                onClick={handleCreateRole}
                disabled={saving}
              >
                {saving ? '保存中...' : '确认新增'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
