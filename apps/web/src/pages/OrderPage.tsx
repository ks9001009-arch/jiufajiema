import { useEffect, useState } from 'react'
import {
  createOrder,
  createOrderSms,
  getCompanies,
  getCountries,
  getEffectiveCountries,
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
  Country,
  Order,
  OrderStatus,
  PhoneResource,
  Provider,
  Service,
} from '../api/http'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { Pagination } from '../components/Pagination'
import { StatusBadge } from '../components/StatusBadge'
import { TableToolbar } from '../components/TableToolbar'
import { getCountryLabel } from '../utils/country'

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: '待处理',
  WAIT_SMS: '等待短信',
  SUCCESS: '成功',
  FAILED: '失败',
  CANCELLED: '已取消',
}

const AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,4})?$/

type OrderFilterState = {
  companyId: string
  status: string
  serviceId: string
  providerId: string
  userId: string
  phone: string
  createdFrom: string
  createdTo: string
}

const emptyOrderFilters: OrderFilterState = {
  companyId: '',
  status: '',
  serviceId: '',
  providerId: '',
  userId: '',
  phone: '',
  createdFrom: '',
  createdTo: '',
}

function toOrderQueryParams(
  filters: OrderFilterState,
  page: number,
  pageSize: number,
) {
  return {
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(filters.status ? { status: filters.status as OrderStatus } : {}),
    ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
    ...(filters.providerId ? { providerId: filters.providerId } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.phone.trim() ? { phone: filters.phone.trim() } : {}),
    ...(filters.createdFrom
      ? { createdFrom: new Date(filters.createdFrom).toISOString() }
      : {}),
    ...(filters.createdTo
      ? { createdTo: new Date(filters.createdTo).toISOString() }
      : {}),
    page,
    pageSize,
  }
}

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
  const [countries, setCountries] = useState<Country[]>([])
  const [effectiveCountries, setEffectiveCountries] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<OrderFilterState>(emptyOrderFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusTarget, setStatusTarget] = useState<Order | null>(null)
  const [smsModalOpen, setSmsModalOpen] = useState(false)
  const [smsTarget, setSmsTarget] = useState<Order | null>(null)
  const [smsCode, setSmsCode] = useState('')
  const [smsContent, setSmsContent] = useState('')
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

  const effectiveCountrySet = new Set(
    effectiveCountries.map((code) => code.toUpperCase()),
  )

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
      resource.status === 'AVAILABLE' &&
      resource.country &&
      effectiveCountrySet.has(resource.country.toUpperCase()),
  )
  const availableUsers = users.filter((user) => user.companyId === companyId)

  const filterServices = services.filter(
    (service) => !filters.companyId || service.companyId === filters.companyId,
  )
  const filterProviders = providers.filter((provider) => {
    if (filters.companyId && provider.companyId !== filters.companyId) {
      return false
    }

    if (
      filters.serviceId &&
      !provider.services.some((service) => service.id === filters.serviceId)
    ) {
      return false
    }

    return true
  })
  const filterUsers = users.filter(
    (user) => !filters.companyId || user.companyId === filters.companyId,
  )

  function resolveCountryLabel(code?: string | null) {
    if (!code) {
      return '-'
    }

    const normalized = code.toUpperCase()
    const country = countries.find((item) => item.code === normalized)
    return country?.nameZh || getCountryLabel(normalized)
  }

  async function refreshEffectiveCountries(
    nextCompanyId: string,
    nextUserId: string,
  ) {
    if (!nextCompanyId) {
      setEffectiveCountries([])
      return
    }

    const selectedUser = users.find((user) => user.id === nextUserId)
    const teamId = selectedUser?.teamId || null

    try {
      const result = await getEffectiveCountries(nextCompanyId, teamId)
      setEffectiveCountries(result)
    } catch {
      setEffectiveCountries([])
    }
  }

  async function loadOrders(
    nextFilters = filters,
    nextPage = page,
    nextPageSize = pageSize,
  ) {
    setLoading(true)
    setError('')

    try {
      const orderResult = await getOrders(
        toOrderQueryParams(nextFilters, nextPage, nextPageSize),
      )
      setOrders(orderResult.items)
      setTotal(orderResult.total)
      setPage(orderResult.page)
      setPageSize(orderResult.pageSize)
      setTotalPages(orderResult.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载订单失败')
    } finally {
      setLoading(false)
    }
  }

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [orderResult, companyResult, serviceResult, providerResult, phoneResourceResult, userResult, countryResult] =
        await Promise.all([
          getOrders({ page: 1, pageSize: 20 }),
          getCompanies(),
          getServices(),
          getProviders(),
          getPhoneResources(),
          getUsers(),
          getCountries(),
        ])

      setOrders(orderResult.items)
      setTotal(orderResult.total)
      setPage(orderResult.page)
      setPageSize(orderResult.pageSize)
      setTotalPages(orderResult.totalPages)
      setCompanies(companyResult)
      setServices(serviceResult)
      setProviders(providerResult)
      setPhoneResources(phoneResourceResult)
      setUsers(userResult)
      setCountries(countryResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载订单失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!createModalOpen || !companyId) {
      return
    }

    void refreshEffectiveCountries(companyId, userId)
  }, [createModalOpen, companyId, userId, users])

  useEffect(() => {
    if (!createModalOpen) {
      return
    }

    if (availablePhoneResources.length === 0) {
      setPhoneResourceId('')
      return
    }

    const stillValid = availablePhoneResources.some(
      (resource) => resource.id === phoneResourceId,
    )

    if (!stillValid) {
      setPhoneResourceId(availablePhoneResources[0]?.id || '')
    }
  }, [createModalOpen, availablePhoneResources, phoneResourceId])

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

    setCompanyId(initialCompanyId)
    setServiceId(initialService?.id || '')
    setProviderId(initialProvider?.id || '')
    setPhoneResourceId('')
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

  function openSmsModal(order: Order) {
    setSmsTarget(order)
    setSmsCode('')
    setSmsContent('')
    setFormError('')
    setSmsModalOpen(true)
  }

  function closeSmsModal() {
    if (saving) {
      return
    }

    setSmsModalOpen(false)
    setSmsTarget(null)
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

    setCompanyId(nextCompanyId)
    setServiceId(nextService?.id || '')
    setProviderId(nextProvider?.id || '')
    setPhoneResourceId('')
    setUserId('')
  }

  function handleServiceChange(nextServiceId: string) {
    const nextProvider = providers.find(
      (provider) =>
        provider.companyId === companyId &&
        provider.services.some((service) => service.id === nextServiceId),
    )

    setServiceId(nextServiceId)
    setProviderId(nextProvider?.id || '')
    setPhoneResourceId('')
  }

  function handleProviderChange(nextProviderId: string) {
    setProviderId(nextProviderId)
    setPhoneResourceId('')
  }

  function handleUserChange(nextUserId: string) {
    setUserId(nextUserId)
    setPhoneResourceId('')
  }

  function handleFilterCompanyChange(nextCompanyId: string) {
    setFilters((current) => ({
      ...current,
      companyId: nextCompanyId,
      serviceId: '',
      providerId: '',
      userId: '',
    }))
  }

  function handleFilterServiceChange(nextServiceId: string) {
    setFilters((current) => ({
      ...current,
      serviceId: nextServiceId,
      providerId: '',
    }))
  }

  function handleSearch() {
    setPage(1)
    loadOrders(filters, 1, pageSize)
  }

  function handleResetFilters() {
    setFilters(emptyOrderFilters)
    setPage(1)
    loadOrders(emptyOrderFilters, 1, pageSize)
  }

  function handlePageSizeChange(nextPageSize: number) {
    setPage(1)
    setPageSize(nextPageSize)
    loadOrders(filters, 1, nextPageSize)
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
      await loadOrders(filters, page, pageSize)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '新增订单失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateSms() {
    if (!smsTarget) {
      return
    }

    const trimmedCode = smsCode.trim()
    const trimmedContent = smsContent.trim()

    if (!trimmedCode && !trimmedContent) {
      setFormError('验证码和短信内容至少填写一项')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      await createOrderSms(smsTarget.id, {
        companyId: smsTarget.companyId,
        code: trimmedCode || undefined,
        content: trimmedContent || undefined,
      })

      setSmsModalOpen(false)
      setSmsTarget(null)
      await loadOrders(filters, page, pageSize)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '录入短信失败')
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
      await loadOrders(filters, page, pageSize)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '更新订单状态失败')
    } finally {
      setSaving(false)
    }
  }

  const orderColumns: DataTableColumn<Order>[] = [
    {
      key: 'id',
      header: '订单 ID',
      render: (order) => `${order.id.slice(0, 8)}...`,
    },
    {
      key: 'company',
      header: '公司',
      render: (order) => order.company?.name || '-',
    },
    {
      key: 'service',
      header: '服务',
      render: (order) => order.service?.name || '-',
    },
    {
      key: 'provider',
      header: '供应商',
      render: (order) => order.provider?.name || '-',
    },
    {
      key: 'phone',
      header: '号码',
      render: (order) => (
        <>
          {order.phoneResource?.phone || '-'}
          {order.phoneResource?.country ? (
            <span className="table-meta">
              {' '}
              ({resolveCountryLabel(order.phoneResource.country)})
            </span>
          ) : null}
        </>
      ),
    },
    {
      key: 'user',
      header: '用户',
      render: (order) => order.user?.displayName || order.user?.username || '-',
    },
    {
      key: 'status',
      header: '状态',
      render: (order) => (
        <StatusBadge status={order.status} labelMap={ORDER_STATUS_LABELS} />
      ),
    },
    {
      key: 'amount',
      header: '金额',
      render: (order) => order.amount,
    },
    {
      key: 'createdAt',
      header: '创建时间',
      render: (order) => formatDate(order.createdAt),
    },
    {
      key: 'actions',
      header: '操作',
      render: (order) =>
        order.status === 'WAIT_SMS' ? (
          <div className="table-actions">
            <button
              className="text-button"
              type="button"
              onClick={() => openSmsModal(order)}
            >
              录入短信
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => openStatusModal(order)}
            >
              变更状态
            </button>
          </div>
        ) : (
          '-'
        ),
    },
  ]

  return (
    <div className="manage-page">
      <PageHeader
        title="订单管理"
        subtitle="创建接码订单并手工推进状态，号码锁定与释放由后端事务保证。"
        actions={
          <>
            <button
              className="secondary-button"
              type="button"
              onClick={() => loadOrders(filters, page, pageSize)}
            >
              刷新
            </button>

            <button className="primary-button" type="button" onClick={openCreateModal}>
              新建订单
            </button>
          </>
        }
      />

      <TableToolbar
        actions={
          <>
            <button className="secondary-button" type="button" onClick={handleResetFilters}>
              重置
            </button>

            <button className="primary-button" type="button" onClick={handleSearch}>
              查询
            </button>
          </>
        }
      >
          <label>
            <span>公司</span>
            <select
              value={filters.companyId}
              onChange={(event) => handleFilterCompanyChange(event.target.value)}
            >
              <option value="">全部公司</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>状态</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
            >
              <option value="">全部状态</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>服务</span>
            <select
              value={filters.serviceId}
              onChange={(event) => handleFilterServiceChange(event.target.value)}
            >
              <option value="">全部服务</option>
              {filterServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>供应商</span>
            <select
              value={filters.providerId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  providerId: event.target.value,
                }))
              }
            >
              <option value="">全部供应商</option>
              {filterProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>用户</span>
            <select
              value={filters.userId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  userId: event.target.value,
                }))
              }
            >
              <option value="">全部用户</option>
              {filterUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName || user.username}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>号码关键字</span>
            <input
              value={filters.phone}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              placeholder="支持模糊匹配，如 +1415"
            />
          </label>

          <label>
            <span>开始时间</span>
            <input
              type="datetime-local"
              value={filters.createdFrom}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  createdFrom: event.target.value,
                }))
              }
            />
          </label>

          <label>
            <span>结束时间</span>
            <input
              type="datetime-local"
              value={filters.createdTo}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  createdTo: event.target.value,
                }))
              }
            />
          </label>
      </TableToolbar>

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>订单列表</strong>
          <span>
            {loading ? '正在加载...' : `共 ${total} 条订单`}
          </span>
        </div>

        {error ? <div className="table-error">{error}</div> : null}

        <DataTable
          columns={orderColumns}
          rows={orders}
          rowKey={(order) => order.id}
          loading={loading}
          loadingText="正在加载订单..."
          emptyText="暂无订单"
        />

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={(nextPage) => loadOrders(filters, nextPage, pageSize)}
          onPageSizeChange={handlePageSizeChange}
          disabled={loading}
        />
      </section>

      {createModalOpen ? (
        <div className="modal-mask">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>新建订单</h3>
                <p>
                  创建后订单进入等待短信状态，锁定所选号码，并从公司钱包冻结订单金额。
                </p>
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
                        ? ` (${resolveCountryLabel(resource.country)})`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>用户（可选）</span>
                <select
                  value={userId}
                  onChange={(event) => handleUserChange(event.target.value)}
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
                <h3>手工变更订单状态</h3>
                <p>
                  订单 {statusTarget.id.slice(0, 8)}... 当前状态：
                  {ORDER_STATUS_LABELS[statusTarget.status]}。正常完成请使用「录入短信」。
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
                  <option value="SUCCESS">手工完成（成功）</option>
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

      {smsModalOpen && smsTarget ? (
        <div className="modal-mask">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>内部测试录入短信</h3>
                <p>
                  订单 {smsTarget.id.slice(0, 8)}... 号码：
                  {smsTarget.phoneResource?.phone || '-'}
                </p>
              </div>

              <button
                className="modal-close"
                type="button"
                onClick={closeSmsModal}
              >
                ×
              </button>
            </div>

            <div className="modal-form">
              <label>
                <span>验证码</span>
                <input
                  value={smsCode}
                  onChange={(event) => setSmsCode(event.target.value)}
                  placeholder="可选"
                />
              </label>

              <label>
                <span>短信内容</span>
                <textarea
                  value={smsContent}
                  onChange={(event) => setSmsContent(event.target.value)}
                  placeholder="可选，验证码与内容至少填写一项"
                  rows={4}
                />
              </label>

              {formError ? <div className="form-error">{formError}</div> : null}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                type="button"
                onClick={closeSmsModal}
                disabled={saving}
              >
                取消
              </button>

              <button
                className="primary-button"
                type="button"
                onClick={handleCreateSms}
                disabled={saving}
              >
                {saving ? '录入中...' : '确认录入'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
