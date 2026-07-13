import { useEffect, useState } from 'react'
import {
  createOrder,
  getCompanies,
  getOrders,
  getPhoneResources,
  getProviders,
  getServices,
  getUsers,
  updateOrderStatus,
} from '../api/http'
import type {
  AdminUser,
  Company,
  Order,
  OrderStatus,
  PhoneResource,
  Provider,
  Service,
} from '../api/http'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { getCountryLabel } from '../utils/country'

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: '待处理',
  WAIT_SMS: '等待短信',
  SUCCESS: '成功',
  FAILED: '失败',
  CANCELLED: '已取消',
}

const AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,4})?$/

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

export function OrderPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [phoneResources, setPhoneResources] = useState<PhoneResource[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusTarget, setStatusTarget] = useState<Order | null>(null)
  const [nextStatus, setNextStatus] =
    useState<'SUCCESS' | 'FAILED' | 'CANCELLED'>('SUCCESS')

  const [companyId, setCompanyId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [providerId, setProviderId] = useState('')
  const [phoneResourceId, setPhoneResourceId] = useState('')
  const [userId, setUserId] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const availableServices = services.filter(
    (service) => service.companyId === companyId,
  )
  const availableProviders = providers.filter(
    (provider) =>
      provider.companyId === companyId &&
      provider.services.some((service) => service.id === serviceId),
  )
  const availablePhoneResources = phoneResources.filter(
    (resource) =>
      resource.companyId === companyId &&
      resource.providerId === providerId &&
      resource.status === 'AVAILABLE',
  )
  const availableUsers = users.filter((user) => user.companyId === companyId)

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [
        orderResult,
        companyResult,
        serviceResult,
        providerResult,
        phoneResourceResult,
        userResult,
      ] = await Promise.all([
        getOrders(),
        getCompanies(),
        getServices(),
        getProviders(),
        getPhoneResources(),
        getUsers(),
      ])

      setOrders(orderResult)
      setCompanies(companyResult)
      setServices(serviceResult)
      setProviders(providerResult)
      setPhoneResources(phoneResourceResult)
      setUsers(userResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载订单失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function resetCreateForm() {
    const initialCompanyId = companies[0]?.id || ''
    const initialService = services.find(
      (service) => service.companyId === initialCompanyId,
    )
    const initialProvider = providers.find(
      (provider) =>
        provider.companyId === initialCompanyId &&
        provider.services.some((service) => service.id === initialService?.id),
    )
    const initialPhone = phoneResources.find(
      (resource) =>
        resource.companyId === initialCompanyId &&
        resource.providerId === initialProvider?.id &&
        resource.status === 'AVAILABLE',
    )

    setCompanyId(initialCompanyId)
    setServiceId(initialService?.id || '')
    setProviderId(initialProvider?.id || '')
    setPhoneResourceId(initialPhone?.id || '')
    setUserId('')
    setAmount('')
    setFormError('')
  }

  function openCreateModal() {
    resetCreateForm()
    setCreateModalOpen(true)
  }

  function closeCreateModal() {
    if (saving) {
      return
    }

    setCreateModalOpen(false)
  }

  function openStatusModal(order: Order) {
    setStatusTarget(order)
    setNextStatus('SUCCESS')
    setFormError('')
    setStatusModalOpen(true)
  }

  function closeStatusModal() {
    if (saving) {
      return
    }

    setStatusModalOpen(false)
    setStatusTarget(null)
  }

  function handleCompanyChange(nextCompanyId: string) {
    const nextService = services.find(
      (service) => service.companyId === nextCompanyId,
    )
    const nextProvider = providers.find(
      (provider) =>
        provider.companyId === nextCompanyId &&
        provider.services.some((service) => service.id === nextService?.id),
    )
    const nextPhone = phoneResources.find(
      (resource) =>
        resource.companyId === nextCompanyId &&
        resource.providerId === nextProvider?.id &&
        resource.status === 'AVAILABLE',
    )

    setCompanyId(nextCompanyId)
    setServiceId(nextService?.id || '')
    setProviderId(nextProvider?.id || '')
    setPhoneResourceId(nextPhone?.id || '')
    setUserId('')
  }

  function handleServiceChange(nextServiceId: string) {
    const nextProvider = providers.find(
      (provider) =>
        provider.companyId === companyId &&
        provider.services.some((service) => service.id === nextServiceId),
    )
    const nextPhone = phoneResources.find(
      (resource) =>
        resource.companyId === companyId &&
        resource.providerId === nextProvider?.id &&
        resource.status === 'AVAILABLE',
    )

    setServiceId(nextServiceId)
    setProviderId(nextProvider?.id || '')
    setPhoneResourceId(nextPhone?.id || '')
  }

  function handleProviderChange(nextProviderId: string) {
    const nextPhone = phoneResources.find(
      (resource) =>
        resource.companyId === companyId &&
        resource.providerId === nextProviderId &&
        resource.status === 'AVAILABLE',
    )

    setProviderId(nextProviderId)
    setPhoneResourceId(nextPhone?.id || '')
  }

  async function handleCreateOrder() {
    const trimmedAmount = amount.trim()

    if (!companyId) {
      setFormError('请选择所属公司')
      return
    }

    if (!serviceId) {
      setFormError('请选择服务')
      return
    }

    if (!providerId) {
      setFormError('请选择供应商')
      return
    }

    if (!phoneResourceId) {
      setFormError('请选择可用号码')
      return
    }

    if (!AMOUNT_PATTERN.test(trimmedAmount)) {
      setFormError('金额必须是非负十进制字符串，最多 4 位小数')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      await createOrder({
        companyId,
        serviceId,
        providerId,
        phoneResourceId,
        userId: userId || null,
        amount: trimmedAmount,
      })

      setCreateModalOpen(false)
      await loadData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '新增订单失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateStatus() {
    if (!statusTarget) {
      return
    }

    setSaving(true)
    setFormError('')

    try {
      await updateOrderStatus(statusTarget.id, { status: nextStatus })
      setStatusModalOpen(false)
      setStatusTarget(null)
      await loadData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '更新订单状态失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="manage-page">
      <PageHeader
        title="订单管理"
        subtitle="创建接码订单并手工推进状态，号码锁定与释放由后端事务保证。"
        actions={
          <>
            <button className="secondary-button" type="button" onClick={loadData}>
              刷新
            </button>

            <button className="primary-button" type="button" onClick={openCreateModal}>
              新建订单
            </button>
          </>
        }
      />

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>订单列表</strong>
          <span>
            {loading ? '正在加载...' : `共 ${orders.length} 条订单`}
          </span>
        </div>

        {error ? <div className="table-error">{error}</div> : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>订单 ID</th>
              <th>公司</th>
              <th>服务</th>
              <th>供应商</th>
              <th>号码</th>
              <th>用户</th>
              <th>状态</th>
              <th>金额</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10}>正在加载订单...</td>
              </tr>
            ) : orders.length > 0 ? (
              orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.id.slice(0, 8)}...</td>
                  <td>{order.company?.name || '-'}</td>
                  <td>{order.service?.name || '-'}</td>
                  <td>{order.provider?.name || '-'}</td>
                  <td>
                    {order.phoneResource?.phone || '-'}
                    {order.phoneResource?.country ? (
                      <span className="table-meta">
                        {' '}
                        ({getCountryLabel(
                          order.phoneResource.country,
                          order.phoneResource.region,
                        )})
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {order.user?.displayName || order.user?.username || '-'}
                  </td>
                  <td>
                    <StatusBadge
                      status={order.status}
                      labelMap={ORDER_STATUS_LABELS}
                    />
                  </td>
                  <td>{order.amount}</td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td>
                    {order.status === 'WAIT_SMS' ? (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => openStatusModal(order)}
                      >
                        变更状态
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10}>暂无订单</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {createModalOpen ? (
        <div className="modal-mask">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>新建订单</h3>
                <p>创建后订单进入等待短信状态，并锁定所选号码。</p>
              </div>

              <button
                className="modal-close"
                type="button"
                onClick={closeCreateModal}
              >
                ×
              </button>
            </div>

            <div className="modal-form">
              <label>
                <span>所属公司</span>
                <select
                  value={companyId}
                  onChange={(event) => handleCompanyChange(event.target.value)}
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
                <span>服务</span>
                <select
                  value={serviceId}
                  onChange={(event) => handleServiceChange(event.target.value)}
                >
                  <option value="">请选择服务</option>
                  {availableServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}（{service.code}）
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>供应商</span>
                <select
                  value={providerId}
                  onChange={(event) => handleProviderChange(event.target.value)}
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
                <span>号码资源</span>
                <select
                  value={phoneResourceId}
                  onChange={(event) => setPhoneResourceId(event.target.value)}
                >
                  <option value="">请选择可用号码</option>
                  {availablePhoneResources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.phone}
                      {resource.country
                        ? ` (${getCountryLabel(resource.country, resource.region)})`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>用户（可选）</span>
                <select
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                >
                  <option value="">不指定用户</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName || user.username}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>金额</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.1000"
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
                onClick={handleCreateOrder}
                disabled={saving}
              >
                {saving ? '创建中...' : '确认创建'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {statusModalOpen && statusTarget ? (
        <div className="modal-mask">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>变更订单状态</h3>
                <p>
                  订单 {statusTarget.id.slice(0, 8)}... 当前状态：
                  {ORDER_STATUS_LABELS[statusTarget.status]}
                </p>
              </div>

              <button
                className="modal-close"
                type="button"
                onClick={closeStatusModal}
              >
                ×
              </button>
            </div>

            <div className="modal-form">
              <label>
                <span>目标状态</span>
                <select
                  value={nextStatus}
                  onChange={(event) =>
                    setNextStatus(
                      event.target.value as 'SUCCESS' | 'FAILED' | 'CANCELLED',
                    )
                  }
                >
                  <option value="SUCCESS">成功</option>
                  <option value="FAILED">失败</option>
                  <option value="CANCELLED">已取消</option>
                </select>
              </label>

              {formError ? <div className="form-error">{formError}</div> : null}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                type="button"
                onClick={closeStatusModal}
                disabled={saving}
              >
                取消
              </button>

              <button
                className="primary-button"
                type="button"
                onClick={handleUpdateStatus}
                disabled={saving}
              >
                {saving ? '保存中...' : '确认变更'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
