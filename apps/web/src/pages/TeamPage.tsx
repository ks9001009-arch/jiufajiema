import { useEffect, useMemo, useState } from 'react'
import { createTeam, getCompanies, getCountries, getTeams, updateTeam } from '../api/http'
import type {
  Company,
  Country,
  Team,
  TeamCountryPolicyMode,
} from '../api/http'
import { PageHeader } from '../components/PageHeader'

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

function getPolicyLabel(mode?: TeamCountryPolicyMode) {
  if (mode === 'ALLOW_LIST') {
    return '指定国家'
  }

  return '继承公司'
}

export function TeamPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [name, setName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [countryPolicyMode, setCountryPolicyMode] =
    useState<TeamCountryPolicyMode>('INHERIT')
  const [countryCodes, setCountryCodes] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const isEditing = Boolean(editingTeam)

  const selectedCompany = companies.find((item) => item.id === companyId)
  const companyCountryOptions = useMemo(() => {
    const allowed = new Set(selectedCompany?.countryCodes || [])
    return countries.filter((country) => allowed.has(country.code))
  }, [countries, selectedCompany?.countryCodes])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [teamResult, companyResult, countryResult] = await Promise.all([
        getTeams(),
        getCompanies(),
        getCountries(),
      ])

      setTeams(teamResult)
      setCompanies(companyResult)
      setCountries(countryResult)

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
    setCountryPolicyMode('INHERIT')
    setCountryCodes([])
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(team: Team) {
    setEditingTeam(team)
    setName(team.name)
    setCompanyId(team.companyId)
    setCountryPolicyMode(team.countryPolicyMode || 'INHERIT')
    setCountryCodes(team.countryCodes || [])
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) {
      return
    }

    setModalOpen(false)
  }

  function handleCompanyChange(nextCompanyId: string) {
    setCompanyId(nextCompanyId)
    setCountryCodes((current) => {
      const allowed = new Set(
        companies.find((item) => item.id === nextCompanyId)?.countryCodes || [],
      )
      return current.filter((code) => allowed.has(code))
    })
  }

  function toggleCountryCode(code: string) {
    setCountryCodes((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code].sort(),
    )
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

    if (countryPolicyMode === 'ALLOW_LIST' && countryCodes.length === 0) {
      setFormError('指定国家模式下请至少选择一个国家')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      const payload = {
        name: trimmedName,
        companyId,
        countryPolicyMode,
        ...(countryPolicyMode === 'ALLOW_LIST' ? { countryCodes } : {}),
      }

      if (editingTeam) {
        await updateTeam(editingTeam.id, payload)
      } else {
        await createTeam(payload)
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
      <PageHeader
        title="团队管理"
        subtitle="管理公司下的业务团队，当前页面已经接入列表、新增和编辑接口。"
        actions={
          <>
            <button className="secondary-button" type="button" onClick={loadData}>
              刷新
            </button>

            <button className="primary-button" type="button" onClick={openCreateModal}>
              新增团队
            </button>
          </>
        }
      />

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
              <th>国家策略</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>正在加载团队列表...</td>
              </tr>
            ) : teams.length > 0 ? (
              teams.map((team) => (
                <tr key={team.id}>
                  <td>{team.name}</td>
                  <td>{getCompanyName(team, companies)}</td>
                  <td>{getPolicyLabel(team.countryPolicyMode)}</td>
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
                <td colSpan={5}>暂无团队数据</td>
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
                  onChange={(event) => handleCompanyChange(event.target.value)}
                  disabled={isEditing}
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

              <label>
                <span>国家访问策略</span>
                <select
                  value={countryPolicyMode}
                  onChange={(event) =>
                    setCountryPolicyMode(event.target.value as TeamCountryPolicyMode)
                  }
                >
                  <option value="INHERIT">继承公司</option>
                  <option value="ALLOW_LIST">指定国家</option>
                </select>
              </label>

              {countryPolicyMode === 'ALLOW_LIST' ? (
                <div className="form-field">
                  <span>允许的国家/地区</span>
                  {companyCountryOptions.length > 0 ? (
                    <div className="checkbox-grid">
                      {companyCountryOptions.map((country) => (
                        <label key={country.code} className="checkbox-option">
                          <input
                            type="checkbox"
                            checked={countryCodes.includes(country.code)}
                            onChange={() => toggleCountryCode(country.code)}
                          />
                          <span>
                            {country.emoji ? `${country.emoji} ` : ''}
                            {country.nameZh}（{country.code}）
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="form-hint form-hint-warning">
                      所属公司尚未配置开放国家，无法指定团队国家。
                    </p>
                  )}
                </div>
              ) : (
                <p className="form-hint">
                  继承模式下，团队使用所属公司的开放国家列表。
                </p>
              )}

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
