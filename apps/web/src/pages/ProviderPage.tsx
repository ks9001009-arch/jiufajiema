import { useEffect, useState } from 'react'
import {
  createProvider,
  getCompanies,
  getProviders,
  getServices,
  updateProvider,
} from '../api/http'
import type {
  Company,
  Provider,
  ProviderStatus,
  Service,
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

export function ProviderPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [companyId, setCompanyId] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [adapter, setAdapter] = useState('')
  const [status, setStatus] = useState<ProviderStatus>('ACTIVE')
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const isEditing = Boolean(editingProvider)
  const availableServices = services.filter(
    (service) => service.companyId === companyId,
  )

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [providerResult, companyResult, serviceResult] = await Promise.all([
        getProviders(),
        getCompanies(),
        getServices(),
      ])

      setProviders(providerResult)
      setCompanies(companyResult)
      setServices(serviceResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载供应商列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function openCreateModal() {
    setEditingProvider(null)
    setCompanyId(companies[0]?.id || '')
    setName('')
    setCode('')
    setAdapter('')
    setStatus('ACTIVE')
    setServiceIds([])
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(provider: Provider) {
    setEditingProvider(provider)
    setCompanyId(provider.companyId)
    setName(provider.name)
    setCode(provider.code)
    setAdapter(provider.adapter)
    setStatus(provider.status)
    setServiceIds(provider.services.map((service) => service.id))
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
    setServiceIds([])
  }

  function toggleService(serviceId: string) {
    setServiceIds((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    )
  }

  async function handleSubmitProvider() {
    const trimmedName = name.trim()
    const trimmedCode = code.trim()
    const trimmedAdapter = adapter.trim()

    if (!companyId) {
      setFormError('请选择所属公司')
      return
    }

    if (!trimmedName) {
      setFormError('请输入供应商名称')
      return
    }

    if (!trimmedCode) {
      setFormError('请输入供应商编码')
      return
    }

    if (!trimmedAdapter) {
      setFormError('请输入 Adapter 标识')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      if (editingProvider) {
        await updateProvider(editingProvider.id, {
          name: trimmedName,
          code: trimmedCode,
          adapter: trimmedAdapter,
          status,
          serviceIds,
        })
      } else {
        await createProvider({
          companyId,
          name: trimmedName,
          code: trimmedCode,
          adapter: trimmedAdapter,
          serviceIds,
        })
      }

      setModalOpen(false)
      await loadData()
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : isEditing
            ? '编辑供应商失败'
            : '新增供应商失败',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="manage-page">
      <PageHeader
        title="供应商管理"
        subtitle="管理供应商基础信息、Adapter 标识和支持的服务。"
        actions={
          <>
            <button className="secondary-button" type="button" onClick={loadData}>
              刷新
            </button>

            <button className="primary-button" type="button" onClick={openCreateModal}>
              新增供应商
            </button>
          </>
        }
      />

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>供应商列表</strong>
          <span>
            {loading
              ? '正在加载...'
              : `共 ${providers.length} 条供应商记录`}
          </span>
        </div>

        {error ? <div className="table-error">{error}</div> : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>供应商名称</th>
              <th>供应商编码</th>
              <th>Adapter</th>
              <th>所属公司</th>
              <th>支持服务</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>正在加载供应商列表...</td>
              </tr>
            ) : providers.length > 0 ? (
              providers.map((provider) => (
                <tr key={provider.id}>
                  <td>{provider.name}</td>
                  <td>{provider.code}</td>
                  <td>{provider.adapter}</td>
                  <td>{provider.company?.name || '-'}</td>
                  <td>
                    {provider.services.length > 0
                      ? provider.services.map((service) => service.name).join('、')
                      : '-'}
                  </td>
                  <td>
                    <StatusBadge status={provider.status} />
                  </td>
                  <td>{formatDate(provider.createdAt)}</td>
                  <td>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => openEditModal(provider)}
                    >
                      编辑
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>暂无供应商数据</td>
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
                <h3>{isEditing ? '编辑供应商' : '新增供应商'}</h3>
                <p>{isEditing ? '修改供应商基础信息' : '创建一个新的供应商'}</p>
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
                <span>供应商名称</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：示例供应商"
                />
              </label>

              <label>
                <span>供应商编码</span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="例如：DEMO_PROVIDER"
                />
              </label>

              <label>
                <span>Adapter 标识</span>
                <input
                  value={adapter}
                  onChange={(event) => setAdapter(event.target.value)}
                  placeholder="例如：demo"
                />
              </label>

              <div className="form-field">
                <span>支持服务</span>
                <div className="provider-service-options">
                  {availableServices.length > 0 ? (
                    availableServices.map((service) => (
                      <label key={service.id}>
                        <input
                          type="checkbox"
                          checked={serviceIds.includes(service.id)}
                          onChange={() => toggleService(service.id)}
                        />
                        <span>
                          {service.name}（{service.code}）
                        </span>
                      </label>
                    ))
                  ) : (
                    <div className="provider-service-empty">
                      当前公司暂无可关联服务
                    </div>
                  )}
                </div>
              </div>

              {isEditing ? (
                <label>
                  <span>状态</span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as ProviderStatus)}
                  >
                    <option value="ACTIVE">启用</option>
                    <option value="DISABLED">停用</option>
                  </select>
                </label>
              ) : null}

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
                onClick={handleSubmitProvider}
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
