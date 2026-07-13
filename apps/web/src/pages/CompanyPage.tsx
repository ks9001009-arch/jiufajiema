import { useEffect, useState } from 'react'
import {
  createCompany,
  getCompanies,
  getCountries,
  updateCompany,
} from '../api/http'
import type { Company, CompanyStatus, Country } from '../api/http'
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

function formatCountrySummary(codes: string[] | undefined, countries: Country[]) {
  if (!codes || codes.length === 0) {
    return '未开放（无法创建订单）'
  }

  const labels = codes.map((code) => {
    const country = countries.find((item) => item.code === code)
    return country ? country.nameZh : code
  })

  if (labels.length <= 3) {
    return labels.join('、')
  }

  return `${labels.slice(0, 3).join('、')} 等 ${labels.length} 个`
}

export function CompanyPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<CompanyStatus>('ACTIVE')
  const [countryCodes, setCountryCodes] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const isEditing = Boolean(editingCompany)

  async function loadCompanies() {
    setLoading(true)
    setError('')

    try {
      const [companyResult, countryResult] = await Promise.all([
        getCompanies(),
        getCountries(),
      ])
      setCompanies(companyResult)
      setCountries(countryResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载公司列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCompanies()
  }, [])

  function openCreateModal() {
    setEditingCompany(null)
    setName('')
    setCode('')
    setStatus('ACTIVE')
    setCountryCodes([])
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(company: Company) {
    setEditingCompany(company)
    setName(company.name)
    setCode(company.code)
    setStatus(company.status)
    setCountryCodes(company.countryCodes || [])
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) {
      return
    }

    setModalOpen(false)
  }

  function toggleCountryCode(code: string) {
    setCountryCodes((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code].sort(),
    )
  }

  async function handleSubmitCompany() {
    const trimmedName = name.trim()
    const trimmedCode = code.trim()

    if (!trimmedName) {
      setFormError('请输入公司名称')
      return
    }

    if (!trimmedCode) {
      setFormError('请输入公司编码')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      if (editingCompany) {
        await updateCompany(editingCompany.id, {
          name: trimmedName,
          code: trimmedCode,
          status,
          countryCodes,
        })
      } else {
        await createCompany({
          name: trimmedName,
          code: trimmedCode,
          countryCodes,
        })
      }

      setModalOpen(false)
      await loadCompanies()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : isEditing ? '编辑公司失败' : '新增公司失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="manage-page">
      <PageHeader
        title="公司管理"
        subtitle="管理平台内的公司主体，当前页面已经接入列表、新增和编辑接口。"
        actions={
          <>
            <button className="secondary-button" type="button" onClick={loadCompanies}>
              刷新
            </button>

            <button className="primary-button" type="button" onClick={openCreateModal}>
              新增公司
            </button>
          </>
        }
      />

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>公司列表</strong>
          <span>
            {loading
              ? '正在加载...'
              : `共 ${companies.length} 条公司记录`}
          </span>
        </div>

        {error ? <div className="table-error">{error}</div> : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>公司名称</th>
              <th>公司编码</th>
              <th>开放国家/地区</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>正在加载公司列表...</td>
              </tr>
            ) : companies.length > 0 ? (
              companies.map((company) => (
                <tr key={company.id}>
                  <td>{company.name}</td>
                  <td>{company.code}</td>
                  <td>{formatCountrySummary(company.countryCodes, countries)}</td>
                  <td>
                    <StatusBadge status={company.status} />
                  </td>
                  <td>{formatDate(company.createdAt)}</td>
                  <td>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => openEditModal(company)}
                    >
                      编辑
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>暂无公司数据</td>
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
                <h3>{isEditing ? '编辑公司' : '新增公司'}</h3>
                <p>{isEditing ? '修改公司主体信息' : '创建一个新的公司主体'}</p>
              </div>

              <button className="modal-close" type="button" onClick={closeModal}>
                ×
              </button>
            </div>

            <div className="modal-form">
              <label>
                <span>公司名称</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：玖发科技"
                />
              </label>

              <label>
                <span>公司编码</span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="例如：JIUFA"
                />
              </label>

              <label>
                <span>状态</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as CompanyStatus)}
                  disabled={!isEditing}
                >
                  <option value="ACTIVE">启用</option>
                  <option value="DISABLED">停用</option>
                </select>
              </label>

              <div className="form-field">
                <span>开放国家/地区</span>
                <div className="checkbox-grid">
                  {countries.map((country) => (
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
                {countryCodes.length === 0 ? (
                  <p className="form-hint form-hint-warning">
                    未选择开放国家/地区时，该公司无法创建订单。
                  </p>
                ) : (
                  <p className="form-hint">
                    已选择 {countryCodes.length} 个国家/地区。
                  </p>
                )}
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
                onClick={handleSubmitCompany}
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
