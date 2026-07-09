import { useEffect, useState } from 'react'
import { createRole, getRoles, updateRole } from '../api/http'
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


const PERMISSION_GROUPS = [
  {
    title: '首页与日志',
    items: [
      { key: 'dashboard.view', label: '查看后台首页' },
      { key: 'auditLog.view', label: '查看操作日志' },
    ],
  },
  {
    title: '公司管理',
    items: [
      { key: 'company.view', label: '查看公司' },
      { key: 'company.create', label: '新增公司' },
      { key: 'company.update', label: '编辑公司' },
      { key: 'company.toggleStatus', label: '启用/停用公司' },
    ],
  },
  {
    title: '团队管理',
    items: [
      { key: 'team.view', label: '查看团队' },
      { key: 'team.create', label: '新增团队' },
      { key: 'team.update', label: '编辑团队' },
    ],
  },
  {
    title: '角色管理',
    items: [
      { key: 'role.view', label: '查看角色' },
      { key: 'role.create', label: '新增角色' },
      { key: 'role.update', label: '编辑角色' },
    ],
  },
  {
    title: '用户管理',
    items: [
      { key: 'user.view', label: '查看用户' },
      { key: 'user.create', label: '新增用户' },
      { key: 'user.update', label: '编辑用户' },
      { key: 'user.toggleStatus', label: '启用/停用用户' },
      { key: 'user.resetPassword', label: '重置用户密码' },
    ],
  },
]
export function RolePage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const isEditing = Boolean(editingRole)

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
    setEditingRole(null)
    setName('')
    setCode('')
    setDescription('')
    setSelectedPermissions([])
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(role: Role) {
    setEditingRole(role)
    setName(role.name)
    setCode(role.code)
    setDescription(role.description || '')
    setSelectedPermissions(role.permissions ?? [])
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) {
      return
    }

    setModalOpen(false)
  }


  function togglePermission(permission: string) {
    setSelectedPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    )
  }
  async function handleSubmitRole() {
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
      if (editingRole) {
        await updateRole(editingRole.id, {
          name: trimmedName,
          code: trimmedCode,
          description: trimmedDescription || undefined,
        permissions: selectedPermissions,
        })
      } else {
        await createRole({
          name: trimmedName,
          code: trimmedCode,
          description: trimmedDescription || undefined,
        permissions: selectedPermissions,
        })
      }

      setModalOpen(false)
      await loadRoles()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : isEditing ? '编辑角色失败' : '新增角色失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="manage-page">
      <div className="page-header">
        <div>
          <h2>角色管理</h2>
          <p>管理后台角色和权限分组，当前页面已经接入列表、新增和编辑接口。</p>
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
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => openEditModal(role)}
                    >
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
                <h3>{isEditing ? '编辑角色' : '新增角色'}</h3>
                <p>{isEditing ? '修改后台角色信息' : '创建一个新的后台角色'}</p>
              </div>

              <button className="modal-close" type="button" onClick={closeModal}>
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
              <div className="form-field">
                <span>权限配置</span>
                <div
                  style={{
                    display: 'grid',
                    gap: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 12,
                    maxHeight: 260,
                    overflow: 'auto',
                  }}
                >
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.title}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>{group.title}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                        {group.items.map((item) => (
                          <label
                            key={item.key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 13,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedPermissions.includes(item.key)}
                              onChange={() => togglePermission(item.key)}
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {formError ? <div className="form-error">{formError}</div> : null}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                type="button"
                onClick={closeModal}
                disabled={saving}
              >
                取消
              </button>

              <button
                className="primary-button"
                type="button"
                onClick={handleSubmitRole}
                disabled={saving}
              >
                {saving ? '保存中...' : isEditing ? '保存修改' : '确认新增'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

