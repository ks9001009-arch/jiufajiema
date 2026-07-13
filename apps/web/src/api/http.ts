export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

export type CurrentUser = {
  id: string | number
  username?: string
  displayName?: string | null
  name?: string
  phone?: string
  email?: string
  status?: string
  companyId?: string | null
  teamId?: string | null
  roleId?: string | null
  role?: {
    id?: string | number
    name?: string
    code?: string
    permissions?: string[]
  } | null
  company?: {
    id?: string | number
    name?: string
    code?: string
  } | null
  team?: {
    id?: string | number
    name?: string
  } | null
}
export type LoginResponse = {
  accessToken?: string
  access_token?: string
  token?: string
  user?: CurrentUser
}

export function getAccessToken() {
  return localStorage.getItem('accessToken')
}

export function setAccessToken(token: string) {
  localStorage.setItem('accessToken', token)
}

export function clearAccessToken() {
  localStorage.removeItem('accessToken')
}

async function readErrorMessage(response: Response) {
  try {
    const data = await response.json()
    return data.message || data.error || '请求失败'
  } catch {
    return '请求失败'
  }
}

export async function request<T>(path: string, options: RequestInit = {}) {
  const token = getAccessToken()

  const headers = new Headers(options.headers)

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(Array.isArray(message) ? message.join('，') : message)
  }

  if (response.status === 204) {
    return null as T
  }

  return response.json() as Promise<T>
}

export async function login(username: string, password: string) {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
    }),
  })
}

export async function getMe() {
  return request<CurrentUser>('/auth/me')
}

export type AuditLogSummary = {
  id: string
  action: string
  targetType?: string | null
  targetId?: string | null
  createdAt: string
  actorUser?: {
    id: string
    username: string
    displayName?: string | null
  } | null
  company?: {
    id: string
    name: string
  } | null
}

export type DashboardStats = {
  companyCount: number
  teamCount: number
  userCount: number
  roleCount: number
  serviceCount: number
  providerCount: number
  availablePhoneCount: number
  todayOrderCount: number
  waitingSmsOrderCount: number
  successOrderCount: number
  failedOrderCount: number
  todaySmsCount: number
  recentAuditLogs: AuditLogSummary[]
}

export async function getDashboardStats() {
  return request<DashboardStats>('/dashboard/stats')
}

export type CompanyStatus = 'ACTIVE' | 'DISABLED'

export type Country = {
  code: string
  nameZh: string
  nameEn: string
  emoji?: string | null
  sortOrder: number
}

export type Company = {
  id: string
  name: string
  code: string
  status: CompanyStatus
  countryCodes?: string[]
  createdAt?: string
  updatedAt?: string
}

type ListResponse<T> =
  | T[]
  | {
      data?: T[]
      items?: T[]
      list?: T[]
      total?: number
    }

function normalizeList<T>(response: ListResponse<T>) {
  if (Array.isArray(response)) {
    return response
  }

  return response.data || response.items || response.list || []
}

export async function getCompanies() {
  const response = await request<ListResponse<Company>>('/companies')
  return normalizeList(response)
}

export async function getCountries() {
  const response = await request<ListResponse<Country>>('/countries')
  return normalizeList(response)
}

export async function getEffectiveCountries(
  companyId: string,
  teamId?: string | null,
) {
  const search = new URLSearchParams({ companyId })

  if (teamId) {
    search.set('teamId', teamId)
  }

  return request<string[]>(`/country-access/effective?${search.toString()}`)
}

export type CreateCompanyPayload = {
  name: string
  code: string
  countryCodes?: string[]
}

export async function createCompany(payload: CreateCompanyPayload) {
  return request<Company>('/companies', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type UpdateCompanyPayload = {
  name?: string
  code?: string
  status?: CompanyStatus
  countryCodes?: string[]
}

export async function updateCompany(id: string, payload: UpdateCompanyPayload) {
  return request<Company>(`/companies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export type ServiceStatus = 'ACTIVE' | 'DISABLED'

export type Service = {
  id: string
  companyId: string
  name: string
  code: string
  description?: string | null
  status: ServiceStatus
  company?: {
    id: string
    name: string
    code?: string
  } | null
  createdAt?: string
  updatedAt?: string
}

export async function getServices() {
  const response = await request<ListResponse<Service>>('/services')
  return normalizeList(response)
}

export async function getService(id: string) {
  return request<Service>(`/services/${id}`)
}

export type CreateServicePayload = {
  companyId: string
  name: string
  code: string
  description?: string
}

export async function createService(payload: CreateServicePayload) {
  return request<Service>('/services', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type UpdateServicePayload = {
  name?: string
  code?: string
  description?: string
  status?: ServiceStatus
}

export async function updateService(id: string, payload: UpdateServicePayload) {
  return request<Service>(`/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export type ProviderStatus = 'ACTIVE' | 'DISABLED'

export type Provider = {
  id: string
  companyId: string
  name: string
  code: string
  adapter: string
  status: ProviderStatus
  company?: {
    id: string
    name: string
    code?: string
  } | null
  services: Array<{
    id: string
    companyId: string
    name: string
    code: string
  }>
  createdAt?: string
  updatedAt?: string
}

export async function getProviders() {
  const response = await request<ListResponse<Provider>>('/providers')
  return normalizeList(response)
}

export async function getProvider(id: string) {
  return request<Provider>(`/providers/${id}`)
}

export type CreateProviderPayload = {
  companyId: string
  name: string
  code: string
  adapter: string
  serviceIds?: string[]
}

export async function createProvider(payload: CreateProviderPayload) {
  return request<Provider>('/providers', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type UpdateProviderPayload = {
  name?: string
  code?: string
  adapter?: string
  status?: ProviderStatus
  serviceIds?: string[]
}

export async function updateProvider(
  id: string,
  payload: UpdateProviderPayload,
) {
  return request<Provider>(`/providers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export type PhoneResourceStatus =
  | 'AVAILABLE'
  | 'LOCKED'
  | 'USED'
  | 'EXPIRED'
  | 'DISABLED'

export type PhoneResource = {
  id: string
  companyId: string
  providerId: string
  phone: string
  country?: string | null
  region?: string | null
  status: PhoneResourceStatus
  cost: string
  company?: {
    id: string
    name: string
    code?: string
  } | null
  provider?: {
    id: string
    companyId: string
    name: string
    code?: string
    status?: ProviderStatus
  } | null
  createdAt?: string
  updatedAt?: string
}

export async function getPhoneResources() {
  const response =
    await request<ListResponse<PhoneResource>>('/phone-resources')
  return normalizeList(response)
}

export async function getPhoneResource(id: string) {
  return request<PhoneResource>(`/phone-resources/${id}`)
}

export type CreatePhoneResourcePayload = {
  companyId: string
  providerId: string
  phone: string
  country?: string | null
  status?: PhoneResourceStatus
  cost: string
}

export async function createPhoneResource(
  payload: CreatePhoneResourcePayload,
) {
  return request<PhoneResource>('/phone-resources', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type UpdatePhoneResourcePayload = {
  providerId?: string
  phone?: string
  country?: string | null
  status?: PhoneResourceStatus
  cost?: string
}

export async function updatePhoneResource(
  id: string,
  payload: UpdatePhoneResourcePayload,
) {
  return request<PhoneResource>(`/phone-resources/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export type OrderStatus =
  | 'PENDING'
  | 'WAIT_SMS'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'

export type Order = {
  id: string
  companyId: string
  userId?: string | null
  teamId?: string | null
  serviceId: string
  providerId: string
  phoneResourceId: string
  status: OrderStatus
  amount: string
  company?: {
    id: string
    name: string
    code?: string
  } | null
  service?: {
    id: string
    companyId: string
    name: string
    code?: string
  } | null
  provider?: {
    id: string
    companyId: string
    name: string
    code?: string
    status?: ProviderStatus
  } | null
  phoneResource?: {
    id: string
    companyId: string
    providerId: string
    phone: string
    country?: string | null
    region?: string | null
    status?: PhoneResourceStatus
  } | null
  user?: {
    id: string
    username: string
    displayName?: string | null
  } | null
  createdAt?: string
  updatedAt?: string
}

export type PaginatedResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type OrderListParams = {
  companyId?: string
  status?: OrderStatus
  serviceId?: string
  providerId?: string
  phoneResourceId?: string
  userId?: string
  phone?: string
  createdFrom?: string
  createdTo?: string
  page?: number
  pageSize?: number
}

export async function getOrders(params?: OrderListParams) {
  const search = new URLSearchParams()

  if (params?.companyId) {
    search.set('companyId', params.companyId)
  }

  if (params?.status) {
    search.set('status', params.status)
  }

  if (params?.serviceId) {
    search.set('serviceId', params.serviceId)
  }

  if (params?.providerId) {
    search.set('providerId', params.providerId)
  }

  if (params?.phoneResourceId) {
    search.set('phoneResourceId', params.phoneResourceId)
  }

  if (params?.userId) {
    search.set('userId', params.userId)
  }

  if (params?.phone) {
    search.set('phone', params.phone)
  }

  if (params?.createdFrom) {
    search.set('createdFrom', params.createdFrom)
  }

  if (params?.createdTo) {
    search.set('createdTo', params.createdTo)
  }

  if (params?.page !== undefined) {
    search.set('page', String(params.page))
  }

  if (params?.pageSize !== undefined) {
    search.set('pageSize', String(params.pageSize))
  }

  const query = search.toString()
  const path = query ? `/orders?${query}` : '/orders'
  return request<PaginatedResponse<Order>>(path)
}

export async function getOrder(id: string) {
  return request<Order>(`/orders/${id}`)
}

export type CreateOrderPayload = {
  companyId: string
  serviceId: string
  providerId: string
  phoneResourceId: string
  userId?: string | null
  amount: string
}

export async function createOrder(payload: CreateOrderPayload) {
  return request<Order>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type UpdateOrderStatusPayload = {
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED'
}

export async function updateOrderStatus(
  id: string,
  payload: UpdateOrderStatusPayload,
) {
  return request<Order>(`/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export type SmsStatus = 'RECEIVED' | 'FAILED'

export type Sms = {
  id: string
  orderId: string
  code?: string | null
  content?: string | null
  status: SmsStatus
  receivedAt?: string | null
  createdAt?: string
  order?: {
    id: string
    companyId: string
    status: OrderStatus
    company?: {
      id: string
      name: string
      code?: string
    } | null
    service?: {
      id: string
      name: string
      code?: string
    } | null
    provider?: {
      id: string
      name: string
      code?: string
      status?: ProviderStatus
    } | null
    phoneResource?: {
      id: string
      phone: string
      country?: string | null
      status?: PhoneResourceStatus
    } | null
  } | null
}

export type SmsListParams = {
  companyId?: string
  orderId?: string
  phone?: string
  code?: string
  status?: SmsStatus
  orderStatus?: OrderStatus
  createdFrom?: string
  createdTo?: string
  page?: number
  pageSize?: number
}

export async function getSmsList(params?: SmsListParams) {
  const search = new URLSearchParams()

  if (params?.companyId) {
    search.set('companyId', params.companyId)
  }

  if (params?.orderId) {
    search.set('orderId', params.orderId)
  }

  if (params?.phone) {
    search.set('phone', params.phone)
  }

  if (params?.code) {
    search.set('code', params.code)
  }

  if (params?.status) {
    search.set('status', params.status)
  }

  if (params?.orderStatus) {
    search.set('orderStatus', params.orderStatus)
  }

  if (params?.createdFrom) {
    search.set('createdFrom', params.createdFrom)
  }

  if (params?.createdTo) {
    search.set('createdTo', params.createdTo)
  }

  if (params?.page !== undefined) {
    search.set('page', String(params.page))
  }

  if (params?.pageSize !== undefined) {
    search.set('pageSize', String(params.pageSize))
  }

  const query = search.toString()
  const path = query ? `/sms?${query}` : '/sms'
  return request<PaginatedResponse<Sms>>(path)
}

export async function getOrderSms(orderId: string) {
  return request<Sms[]>(`/orders/${orderId}/sms`)
}

export type CreateOrderSmsPayload = {
  companyId: string
  code?: string
  content?: string
  receivedAt?: string
}

export async function createOrderSms(
  orderId: string,
  payload: CreateOrderSmsPayload,
) {
  return request<Sms>(`/orders/${orderId}/sms`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type TeamCountryPolicyMode = 'INHERIT' | 'ALLOW_LIST'

export type Team = {
  id: string
  name: string
  companyId: string
  countryPolicyMode?: TeamCountryPolicyMode
  countryCodes?: string[]
  company?: {
    id: string
    name: string
    code?: string
  } | null
  createdAt?: string
  updatedAt?: string
}

export async function getTeams() {
  const response = await request<ListResponse<Team>>('/teams')
  return normalizeList(response)
}

export type CreateTeamPayload = {
  name: string
  companyId: string
  countryPolicyMode?: TeamCountryPolicyMode
  countryCodes?: string[]
}

export async function createTeam(payload: CreateTeamPayload) {
  return request<Team>('/teams', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type UpdateTeamPayload = {
  name?: string
  companyId?: string
  countryPolicyMode?: TeamCountryPolicyMode
  countryCodes?: string[]
}

export async function updateTeam(id: string, payload: UpdateTeamPayload) {
  return request<Team>(`/teams/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export type Role = {
  id: string
  name: string
  code: string
  description?: string | null
  permissions: string[]
  createdAt?: string
  updatedAt?: string
}

export async function getRoles() {
  const response = await request<ListResponse<Role>>('/roles')
  return normalizeList(response)
}

export type CreateRolePayload = {
  name: string
  code: string
  description?: string
  permissions?: string[]
}

export async function createRole(payload: CreateRolePayload) {
  return request<Role>('/roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type UpdateRolePayload = {
  name?: string
  code?: string
  description?: string
  permissions?: string[]
}

export async function updateRole(id: string, payload: UpdateRolePayload) {
  return request<Role>(`/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export type AdminUserStatus = 'ACTIVE' | 'DISABLED'

export type AdminUser = {
  id: string
  username: string
  displayName?: string | null
  name?: string | null
  phone?: string | null
  email?: string | null
  status?: AdminUserStatus
  companyId?: string | null
  teamId?: string | null
  roleId?: string | null
  company?: {
    id: string
    name: string
    code?: string
  } | null
  team?: {
    id: string
    name: string
  } | null
  role?: {
    id: string
    name: string
    code?: string
  } | null
  createdAt?: string
  updatedAt?: string
}

export async function getUsers() {
  const response = await request<ListResponse<AdminUser>>('/users')
  return normalizeList(response)
}

export type CreateUserPayload = {
  username: string
  password: string
  displayName?: string
  companyId?: string
  teamId?: string
  roleId?: string
  status?: AdminUserStatus
}

export async function createUser(payload: CreateUserPayload) {
  return request<AdminUser>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type UpdateUserPayload = {
  username?: string
  displayName?: string
  companyId?: string
  teamId?: string
  roleId?: string
  status?: AdminUserStatus
}

export async function updateUser(id: string, payload: UpdateUserPayload) {
  return request<AdminUser>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}


export async function resetUserPassword(id: string, password: string) {
  return request<AdminUser>(`/users/${id}/reset-password`, {
    method: 'PATCH',
    body: JSON.stringify({ password }),
  })
}
export type AuditLog = {
  id: string
  actorUserId?: string | null
  actorUser?: {
    id: string
    username: string
    displayName?: string | null
  } | null
  companyId?: string | null
  company?: {
    id: string
    name: string
  } | null
  action: string
  targetType?: string | null
  targetId?: string | null
  beforeData?: unknown
  afterData?: unknown
  ipAddress?: string | null
  userAgent?: string | null
  createdAt?: string
}

export async function getAuditLogs() {
  const response = await request<ListResponse<AuditLog>>('/audit-logs')
  return normalizeList(response)
}




