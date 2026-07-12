import { useEffect, useState } from 'react'
import {
  createUser,
  getCompanies,
  getRoles,
  getTeams,
  getUsers,
  updateUser,
  resetUserPassword,
} from '../api/http'
import type {
  AdminUser,
  AdminUserStatus,
  Company,
  Role,
  Team,
} from '../api/http'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'

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

function getDisplayName(user: AdminUser) {
  return user.displayName || user.name || '-'
}

function getCompanyName(user: AdminUser, companies: Company[]) {
  if (user.company?.name) {
    return user.company.name
  }

  const company = companies.find((item) => item.id === user.companyId)
  return company?.name || user.companyId || '-'
}

function getTeamName(user: AdminUser, teams: Team[]) {
  if (user.team?.name) {
    return user.team.name
  }

  const team = teams.find((item) => item.id === user.teamId)
  return team?.name || user.teamId || '-'
}

function getRoleName(user: AdminUser, roles: Role[]) {
  if (user.role?.name) {
    return user.role.name
  }

  const role = roles.find((item) => item.id === user.roleId)
  return role?.name || user.roleId || '-'
}

export function UserPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [status, setStatus] = useState<AdminUserStatus>('ACTIVE')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetUser, setResetUser] = useState<AdminUser | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  const [resetError, setResetError] = useState('')

  const isEditing = Boolean(editingUser)

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [userResult, companyResult, teamResult, roleResult] = await Promise.all([
        getUsers(),
        getCompanies(),
        getTeams(),
        getRoles(),
      ])

      setUsers(userResult)
      setCompanies(companyResult)
      setTeams(teamResult)
      setRoles(roleResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function openCreateModal() {
    setEditingUser(null)
    setUsername('')
    setPassword('')
    setDisplayName('')
    setCompanyId(companies[0]?.id || '')
    setTeamId('')
    setRoleId(roles[0]?.id || '')
    setStatus('ACTIVE')
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(user: AdminUser) {
    setEditingUser(user)
    setUsername(user.username)
    setPassword('')
    setDisplayName(user.displayName || user.name || '')
    setCompanyId(user.companyId || '')
    setTeamId(user.teamId || '')
    setRoleId(user.roleId || '')
    setStatus(user.status || 'ACTIVE')
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) {
      return
    }

    setModalOpen(false)
  }


  function openResetPasswordModal(user: AdminUser) {
    setResetUser(user)
    setResetPassword('')
    setResetError('')
    setResetModalOpen(true)
  }

  function closeResetPasswordModal() {
    if (resetSaving) {
      return
    }

    setResetModalOpen(false)
  }

  async function handleResetPassword() {
    if (!resetUser) {
      return
    }

    const trimmedPassword = resetPassword.trim()

    if (!trimmedPassword) {
      setResetError('请输入新密码')
      return
    }

    if (trimmedPassword.length < 6) {
      setResetError('密码至少 6 位')
      return
    }

    setResetSaving(true)
    setResetError('')

    try {
      await resetUserPassword(resetUser.id, trimmedPassword)
      setResetModalOpen(false)
      setResetUser(null)
      setResetPassword('')
      await loadData()
    } catch (err) {
      setResetError(err instanceof Error ? err.message : '重置密码失败')
    } finally {
      setResetSaving(false)
    }
  }
  async function handleSubmitUser() {
    const trimmedUsername = username.trim()
    const trimmedPassword = password.trim()
    const trimmedDisplayName = displayName.trim()

    if (!trimmedUsername) {
      setFormError('请输入账号')
      return
    }

    if (!isEditing && !trimmedPassword) {
      setFormError('请输入密码')
      return
    }

    if (!isEditing && trimmedPassword.length < 6) {
      setFormError('密码至少 6 位')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          username: trimmedUsername,
          displayName: trimmedDisplayName || undefined,
          companyId: companyId || undefined,
          teamId: teamId || undefined,
          roleId: roleId || undefined,
          status,
        })
      } else {
        await createUser({
          username: trimmedUsername,
          password: trimmedPassword,
          displayName: trimmedDisplayName || undefined,
          companyId: companyId || undefined,
          teamId: teamId || undefined,
          roleId: roleId || undefined,
          status,
        })
      }

      setModalOpen(false)
      await loadData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : isEditing ? '编辑用户失败' : '新增用户失败')
    } finally {
      setSaving(false)
    }
  }

  const selectableTeams = companyId
    ? teams.filter((team) => team.companyId === companyId)
    : teams

  return (
    <div className="manage-page">
      <PageHeader
        title="用户管理"
        subtitle="管理后台账号、员工账号、所属公司团队和角色，当前页面已经接入列表、新增和编辑接口。"
        actions={
          <>
            <button className="secondary-button" type="button" onClick={loadData}>
              刷新
            </button>

            <button className="primary-button" type="button" onClick={openCreateModal}>
              新增用户
            </button>
          </>
        }
      />

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>用户列表</strong>
          <span>
            {loading
              ? '正在加载...'
              : `共 ${users.length} 条用户记录`}
          </span>
        </div>

        {error ? <div className="table-error">{error}</div> : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>账号</th>
              <th>姓名</th>
              <th>公司</th>
              <th>团队</th>
              <th>角色</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>正在加载用户列表...</td>
              </tr>
            ) : users.length > 0 ? (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{getDisplayName(user)}</td>
                  <td>{getCompanyName(user, companies)}</td>
                  <td>{getTeamName(user, teams)}</td>
                  <td>{getRoleName(user, roles)}</td>
                  <td>
                    <StatusBadge status={user.status ?? ''} />
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => openEditModal(user)}
                    >
                      编辑
                    </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => openResetPasswordModal(user)}
                  style={{ marginLeft: 12 }}
                >
                  重置密码
                </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>暂无用户数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {resetModalOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>重置密码</h3>
                <p>
                  为用户「{resetUser?.username}」设置新的登录密码
                </p>
              </div>

              <button className="modal-close" type="button" onClick={closeResetPasswordModal}>
                ×
              </button>
            </div>

            <div className="modal-form">
              <label>
                <span>新密码</span>
                <input
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  placeholder="至少 6 位"
                  type="password"
                  autoComplete="new-password"
                />
              </label>

              {resetError ? <div className="form-error">{resetError}</div> : null}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                type="button"
                onClick={closeResetPasswordModal}
                disabled={resetSaving}
              >
                取消
              </button>

              <button
                className="primary-button"
                type="button"
                onClick={handleResetPassword}
                disabled={resetSaving}
              >
                {resetSaving ? '重置中...' : '确认重置'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {modalOpen ? (
        <div className="modal-mask">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>{isEditing ? '编辑用户' : '新增用户'}</h3>
                <p>{isEditing ? '修改账号基础信息' : '创建一个新的后台或员工账号'}</p>
              </div>

              <button className="modal-close" type="button" onClick={closeModal}>
                ×
              </button>
            </div>

            <div className="modal-form">
              <label>
                <span>账号</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="例如：user001"
                  autoComplete="off"
                />
              </label>

              {!isEditing ? (
                <label>
                  <span>密码</span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="至少 6 位"
                    type="password"
                    autoComplete="new-password"
                  />
                </label>
              ) : null}

              <label>
                <span>姓名</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="例如：张三"
                />
              </label>

              <label>
                <span>所属公司</span>
                <select
                  value={companyId}
                  onChange={(event) => {
                    setCompanyId(event.target.value)
                    setTeamId('')
                  }}
                >
                  <option value="">不选择公司</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>所属团队</span>
                <select
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                >
                  <option value="">不选择团队</option>
                  {selectableTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>角色</span>
                <select
                  value={roleId}
                  onChange={(event) => setRoleId(event.target.value)}
                >
                  <option value="">不选择角色</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>状态</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as AdminUserStatus)}
                >
                  <option value="ACTIVE">启用</option>
                  <option value="DISABLED">停用</option>
                </select>
              </label>

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
                onClick={handleSubmitUser}
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




