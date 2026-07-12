import { useEffect, useState } from 'react'
import { createTeam, getCompanies, getTeams, updateTeam } from '../api/http'
import type { Company, Team } from '../api/http'

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

function getCompanyName(team: Team, companies: Company[]) {
  if (team.company?.name) {
    return team.company.name
  }

  const company = companies.find((item) => item.id === team.companyId)
  return company?.name || team.companyId || '-'
}

export function TeamPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [name, setName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const isEditing = Boolean(editingTeam)

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [teamResult, companyResult] = await Promise.all([
        getTeams(),
        getCompanies(),
      ])

      setTeams(teamResult)
      setCompanies(companyResult)

      if (!companyId && companyResult.length > 0) {
        setCompanyId(companyResult[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载团队列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function openCreateModal() {
    setEditingTeam(null)
    setName('')
    setCompanyId(companies[0]?.id || '')
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(team: Team) {
    setEditingTeam(team)
    setName(team.name)
    setCompanyId(team.companyId)
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) {
      return
    }

    setModalOpen(false)
  }

  async function handleSubmitTeam() {
    const trimmedName = name.trim()

    if (!trimmedName) {
      setFormError('请输入团队名称')
      return
    }

    if (!companyId) {
      setFormError('请选择所属公司')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      if (editingTeam) {
        await updateTeam(editingTeam.id, {
          name: trimmedName,
          companyId,
        })
      } else {
        await createTeam({
          name: trimmedName,
          companyId,
        })
      }

      setModalOpen(false)
      await loadData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : isEditing ? '编辑团队失败' : '新增团队失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="manage-page">
      <div className="page-header">
        <div>
          <h2>团队管理</h2>
          <p>管理公司下的业务团队，当前页面已经接入列表、新增和编辑接口。</p>
        </div>

        <div className="page-actions">
          <button className="secondary-button" type="button" onClick={loadData}>
            刷新
          </button>

          <button className="primary-button" type="button" onClick={openCreateModal}>
            新增团队
          </button>
        </div>
      </div>

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>团队列表</strong>
          <span>
            {loading
              ? '正在加载...'
              : `共 ${teams.length} 条团队记录`}
          </span>
        </div>

        {error ? <div className="table-error">{error}</div> : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>团队名称</th>
              <th>所属公司</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>正在加载团队列表...</td>
              </tr>
            ) : teams.length > 0 ? (
              teams.map((team) => (
                <tr key={team.id}>
                  <td>{team.name}</td>
                  <td>{getCompanyName(team, companies)}</td>
                  <td>{formatDate(team.createdAt)}</td>
                  <td>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => openEditModal(team)}
                    >
                      编辑
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>暂无团队数据</td>
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
                <h3>{isEditing ? '编辑团队' : '新增团队'}</h3>
                <p>{isEditing ? '修改业务团队信息' : '创建一个新的业务团队'}</p>
              </div>

              <button className="modal-close" type="button" onClick={closeModal}>
                ×
              </button>
            </div>

            <div className="modal-form">
              <label>
                <span>所属公司</span>
                <select
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value)}
                >
                  {companies.length > 0 ? (
                    companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))
                  ) : (
                    <option value="">请先创建公司</option>
                  )}
                </select>
              </label>

              <label>
                <span>团队名称</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：运营一组"
                />
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
                onClick={handleSubmitTeam}
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
