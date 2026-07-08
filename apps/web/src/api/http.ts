export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

export type CurrentUser = {
  id: string | number
  username?: string
  name?: string
  phone?: string
  email?: string
  role?: {
    id?: string | number
    name?: string
    code?: string
  } | null
  company?: {
    id?: string | number
    name?: string
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

export type CompanyStatus = 'ACTIVE' | 'DISABLED'

export type Company = {
  id: string
  name: string
  code: string
  status: CompanyStatus
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

export type CreateCompanyPayload = {
  name: string
  code: string
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
}

export async function updateCompany(id: string, payload: UpdateCompanyPayload) {
  return request<Company>(`/companies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export type Team = {
  id: string
  name: string
  companyId: string
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
  createdAt?: string
  updatedAt?: string
}

export async function getRoles() {
  const response = await request<ListResponse<Role>>('/roles')
  return normalizeList(response)
}
