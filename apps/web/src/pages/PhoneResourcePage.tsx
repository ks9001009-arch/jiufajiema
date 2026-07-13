import { useEffect, useState } from 'react'
import {
  createPhoneResource,
  getCompanies,
  getPhoneResources,
  getProviders,
  updatePhoneResource,
} from '../api/http'
import type {
  Company,
  PhoneResource,
  PhoneResourceStatus,
  Provider,
} from '../api/http'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { getCountryLabel } from '../utils/country'

const PHONE_STATUS_LABELS: Record<PhoneResourceStatus, string> = {
  AVAILABLE: '可用',
  LOCKED: '锁定',
  USED: '已使用',
  EXPIRED: '已过期',
  DISABLED: '禁用',
}

const E164_PHONE_PATTERN = /^\+[1-9]\d{1,14}$/
const COUNTRY_PATTERN = /^[A-Z]{2}$/
const COST_PATTERN = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,4})?$/

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

export function PhoneResourcePage() {
  const [resources, setResources] = useState<PhoneResource[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingResource, setEditingResource] =
    useState<PhoneResource | null>(null)
  const [companyId, setCompanyId] = useState('')
  const [providerId, setProviderId] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('')
  const [cost, setCost] = useState('')
  const [status, setStatus] =
    useState<PhoneResourceStatus>('AVAILABLE')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const isEditing = Boolean(editingResource)
  const availableProviders = providers.filter(
    (provider) => provider.companyId === companyId,
  )

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [resourceResult, companyResult, providerResult] =
        await Promise.all([
          getPhoneResources(),
          getCompanies(),
          getProviders(),
        ])

      setResources(resourceResult)
      setCompanies(companyResult)
      setProviders(providerResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载号码资源失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function openCreateModal() {
    const initialCompanyId = companies[0]?.id || ''
    const initialProvider = providers.find(
      (provider) => provider.companyId === initialCompanyId,
    )

    setEditingResource(null)
    setCompanyId(initialCompanyId)
    setProviderId(initialProvider?.id || '')
    setPhone('')
    setCountry('')
    setCost('')
    setStatus('AVAILABLE')
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(resource: PhoneResource) {
    setEditingResource(resource)
    setCompanyId(resource.companyId)
    setProviderId(resource.providerId)
    setPhone(resource.phone)
    setCountry(resource.country || '')
    setCost(resource.cost)
    setStatus(resource.status)
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
    const initialProvider = providers.find(
      (provider) => provider.companyId === nextCompanyId,
    )

    setCompanyId(nextCompanyId)
    setProviderId(initialProvider?.id || '')
  }

  async function handleSubmitResource() {
    const trimmedPhone = phone.trim()
    const normalizedCountry = country.trim().toUpperCase()
    const trimmedCost = cost.trim()

    if (!companyId) {
      setFormError('请选择所属公司')
      return
    }

    if (!providerId) {
      setFormError('请选择供应商')
      return
    }

    if (!E164_PHONE_PATTERN.test(trimmedPhone)) {
      setFormError('号码必须符合 E.164 格式，例如 +14155552671')
      return
    }

    if (normalizedCountry && !COUNTRY_PATTERN.test(normalizedCountry)) {
      setFormError('国家必须是两个大写英文字母，例如 US')
      return
    }

    if (!COST_PATTERN.test(trimmedCost)) {
      setFormError('成本必须是非负十进制字符串，最多 4 位小数')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      if (editingResource) {
        await updatePhoneResource(editingResource.id, {
          providerId,
          phone: trimmedPhone,
          country: normalizedCountry || null,
          cost: trimmedCost,
          status,
        })
      } else {
        await createPhoneResource({
          companyId,
          providerId,
          phone: trimmedPhone,
          country: normalizedCountry || null,
          cost: trimmedCost,
          status,
        })
      }

      setModalOpen(false)
      await loadData()
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : isEditing
            ? '编辑号码资源失败'
            : '新增号码资源失败',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="manage-page">
      <PageHeader
        title="号码资源"
        subtitle="管理平台号码库存、供应商归属、状态和成本。"
        actions={
          <>
            <button className="secondary-button" type="button" onClick={loadData}>
              刷新
            </button>

            <button className="primary-button" type="button" onClick={openCreateModal}>
              新增号码
            </button>
          </>
        }
      />

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>号码资源列表</strong>
          <span>
            {loading
              ? '正在加载...'
              : `共 ${resources.length} 条号码资源`}
          </span>
        </div>

        {error ? <div className="table-error">{error}</div> : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>号码</th>
              <th>国家</th>
              <th>所属公司</th>
              <th>供应商</th>
              <th>状态</th>
              <th>成本</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>正在加载号码资源...</td>
              </tr>
            ) : resources.length > 0 ? (
              resources.map((resource) => (
                <tr key={resource.id}>
                  <td>{resource.phone}</td>
                  <td>{getCountryLabel(resource.country)}</td>
                  <td>{resource.company?.name || '-'}</td>
                  <td>{resource.provider?.name || '-'}</td>
                  <td>
                    <StatusBadge
                      status={resource.status}
                      labelMap={PHONE_STATUS_LABELS}
                    />
                  </td>
                  <td>{resource.cost}</td>
                  <td>{formatDate(resource.createdAt)}</td>
                  <td>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => openEditModal(resource)}
                    >
                      编辑
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>暂无号码资源</td>
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
                <h3>{isEditing ? '编辑号码资源' : '新增号码资源'}</h3>
                <p>{isEditing ? '修改号码基础信息' : '手工录入一个号码资源'}</p>
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
                  <option value="">请选择公司</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>供应商</span>
                <select
                  value={providerId}
                  onChange={(event) => setProviderId(event.target.value)}
                >
                  <option value="">请选择供应商</option>
                  {availableProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}（{provider.code}）
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>号码</span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+14155552671"
                />
              </label>

              <label>
                <span>国家</span>
                <input
                  value={country}
                  onChange={(event) => setCountry(event.target.value.toUpperCase())}
                  placeholder="US"
                  maxLength={2}
                />
              </label>

              <label>
                <span>成本</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                  placeholder="0.1000"
                />
              </label>

              <label>
                <span>状态</span>
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as PhoneResourceStatus)
                  }
                >
                  {Object.entries(PHONE_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
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
                onClick={handleSubmitResource}
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
