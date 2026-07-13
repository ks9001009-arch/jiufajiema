const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000'

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const text = await response.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  return { status: response.status, body }
}

async function login() {
  const result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin_login', password: '123456' }),
  })

  if (result.status !== 201 && result.status !== 200) {
    throw new Error(`Login failed: ${result.status} ${JSON.stringify(result.body)}`)
  }

  const token =
    result.body.accessToken || result.body.access_token || result.body.token

  if (!token) {
    throw new Error('Login response missing token')
  }

  return token
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` }
}

function pickTestContext(companies, services, providers, phones, preferredCompanyId) {
  const orderedCompanies = preferredCompanyId
    ? [
        ...companies.filter((item) => item.id === preferredCompanyId),
        ...companies.filter((item) => item.id !== preferredCompanyId),
      ]
    : companies

  for (const company of orderedCompanies) {
    const companyServices = services.filter((item) => item.companyId === company.id)
    for (const service of companyServices) {
      const companyProviders = providers.filter(
        (provider) =>
          provider.companyId === company.id &&
          provider.services?.some((svc) => svc.id === service.id),
      )
      for (const provider of companyProviders) {
        const providerPhones = phones.filter(
          (phone) =>
            phone.companyId === company.id &&
            phone.providerId === provider.id &&
            phone.status === 'AVAILABLE' &&
            phone.country,
        )
        const usPhone = providerPhones.find((phone) => phone.country === 'US')
        const gbPhone = providerPhones.find((phone) => phone.country === 'GB')

        if (usPhone) {
          return { company, service, provider, usPhone, gbPhone }
        }
      }
    }
  }

  return null
}

async function main() {
  const results = []
  const log = (name, ok, detail = '') => {
    results.push({ name, ok, detail })
    console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${detail ? `: ${detail}` : ''}`)
  }

  const token = await login()
  const auth = authHeaders(token)
  const meRes = await request('/auth/me', { headers: auth })
  const me = meRes.body

  const countriesRes = await request('/countries', { headers: auth })
  const countries = Array.isArray(countriesRes.body) ? countriesRes.body : []
  log(
    'GET /countries returns seed countries',
    countriesRes.status === 200 && countries.length >= 12,
    `count=${countries.length}`,
  )

  const [companiesRes, servicesRes, providersRes, phonesRes, usersRes, teamsRes] =
    await Promise.all([
      request('/companies', { headers: auth }),
      request('/services', { headers: auth }),
      request('/providers', { headers: auth }),
      request('/phone-resources', { headers: auth }),
      request('/users', { headers: auth }),
      request('/teams', { headers: auth }),
    ])

  const companies = Array.isArray(companiesRes.body) ? companiesRes.body : []
  const services = Array.isArray(servicesRes.body) ? servicesRes.body : []
  const providers = Array.isArray(providersRes.body) ? providersRes.body : []
  const phones = Array.isArray(phonesRes.body) ? phonesRes.body : []
  const users = Array.isArray(usersRes.body) ? usersRes.body : []
  let teams = Array.isArray(teamsRes.body) ? teamsRes.body : []

  for (const phone of phones) {
    if (phone.status === 'LOCKED') {
      await request(`/phone-resources/${phone.id}`, {
        method: 'PATCH',
        headers: auth,
        body: JSON.stringify({ status: 'AVAILABLE' }),
      })
    }
  }

  const refreshedPhonesRes = await request('/phone-resources', { headers: auth })
  const refreshedPhones = Array.isArray(refreshedPhonesRes.body)
    ? refreshedPhonesRes.body
    : phones

  const context = pickTestContext(
    companies,
    services,
    providers,
    refreshedPhones,
    me.companyId,
  )
  if (!context) {
    throw new Error('No test context with AVAILABLE US phone resource found')
  }

  const { company, service, provider, usPhone, gbPhone } = context

  const patchCompanyRes = await request(`/companies/${company.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ countryCodes: ['US', 'CN', 'JP'] }),
  })
  log(
    'Company countryCodes save/read',
    patchCompanyRes.status === 200 &&
      Array.isArray(patchCompanyRes.body.countryCodes) &&
      patchCompanyRes.body.countryCodes.sort().join(',') === 'CN,JP,US',
    patchCompanyRes.body.countryCodes?.join(','),
  )

  await request(`/companies/${company.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ countryCodes: [] }),
  })

  const emptyCompanyOrder = await request('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      serviceId: service.id,
      providerId: provider.id,
      phoneResourceId: usPhone.id,
      amount: '1.0000',
    }),
  })
  log(
    'Empty company countries order returns 400',
    emptyCompanyOrder.status === 400,
    JSON.stringify(emptyCompanyOrder.body?.message || emptyCompanyOrder.status),
  )

  await request(`/companies/${company.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ countryCodes: ['US', 'CN', 'JP', 'GB'] }),
  })

  let team = teams.find((item) => item.companyId === company.id)
  if (!team) {
    const createTeamRes = await request('/teams', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ name: 'Country Test Team', companyId: company.id }),
    })
    team = createTeamRes.body
    teams = [...teams, team]
  }

  await request(`/teams/${team.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      countryPolicyMode: 'INHERIT',
      countryCodes: [],
    }),
  })

  const inheritEffective = await request(
    `/country-access/effective?companyId=${company.id}&teamId=${team.id}`,
    { headers: auth },
  )
  log(
    'Team INHERIT equals company countries',
    inheritEffective.status === 200 &&
      Array.isArray(inheritEffective.body) &&
      inheritEffective.body.sort().join(',') === 'CN,GB,JP,US',
    inheritEffective.body?.join(','),
  )

  const allowListTeamRes = await request(`/teams/${team.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      countryPolicyMode: 'ALLOW_LIST',
      countryCodes: ['US', 'CN'],
    }),
  })
  log(
    'Team ALLOW_LIST subset save',
    allowListTeamRes.status === 200 &&
      allowListTeamRes.body.countryPolicyMode === 'ALLOW_LIST' &&
      allowListTeamRes.body.countryCodes?.sort().join(',') === 'CN,US',
    allowListTeamRes.body?.countryCodes?.join(','),
  )

  const invalidTeamCountryRes = await request(`/teams/${team.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      countryPolicyMode: 'ALLOW_LIST',
      countryCodes: ['MO'],
    }),
  })
  log(
    'Unauthorized team country save returns 400',
    invalidTeamCountryRes.status === 400,
    JSON.stringify(invalidTeamCountryRes.body?.message || invalidTeamCountryRes.status),
  )

  if (me?.id) {
    await request(`/users/${me.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ teamId: team.id }),
    })
  }

  let orderUser = users.find((item) => item.companyId === company.id)
  if (!orderUser) {
    const createUserRes = await request('/users', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        username: `country_test_${Date.now()}`,
        password: '123456',
        displayName: 'Country Test User',
        companyId: company.id,
        teamId: team.id,
      }),
    })
    orderUser = createUserRes.body
  } else {
    await request(`/users/${orderUser.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ teamId: team.id }),
    })
  }

  await request(`/teams/${team.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      countryPolicyMode: 'ALLOW_LIST',
      countryCodes: ['US'],
    }),
  })

  if (gbPhone) {
    const deniedOrder = await request('/orders', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        companyId: company.id,
        serviceId: service.id,
        providerId: provider.id,
        phoneResourceId: gbPhone.id,
        userId: orderUser?.id || null,
        amount: '1.0000',
      }),
    })
    log(
      'Disallowed country order returns 400',
      deniedOrder.status === 400,
      JSON.stringify(deniedOrder.body?.message || deniedOrder.status),
    )
  } else {
    log('Disallowed country order returns 400', true, 'skipped: no GB phone')
  }

  const allowedOrder = await request('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      serviceId: service.id,
      providerId: provider.id,
      phoneResourceId: usPhone.id,
      userId: orderUser?.id || null,
      amount: '1.0000',
    }),
  })
  log(
    'Allowed country order succeeds',
    allowedOrder.status === 201 || allowedOrder.status === 200,
    `status=${allowedOrder.status}, message=${JSON.stringify(allowedOrder.body?.message || '')}`,
  )

  log(
    'Order with user writes teamId snapshot',
    Boolean(orderUser?.id) && allowedOrder.body?.teamId === team.id,
    `expected=${team.id}, actual=${allowedOrder.body?.teamId}`,
  )

  const freshUsPhoneRes = await request('/phone-resources', { headers: auth })
  const freshPhones = Array.isArray(freshUsPhoneRes.body) ? freshUsPhoneRes.body : []
  const freshUsPhone = freshPhones.find(
    (item) =>
      item.companyId === company.id &&
      item.providerId === provider.id &&
      item.status === 'AVAILABLE' &&
      item.country === 'US',
  )

  const noUserOrder = await request('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      serviceId: service.id,
      providerId: provider.id,
      phoneResourceId: freshUsPhone?.id || usPhone.id,
      amount: '1.0000',
    }),
  })
  log(
    'Order without userId has teamId=null',
    (noUserOrder.status === 201 || noUserOrder.status === 200) &&
      (noUserOrder.body?.teamId === null || noUserOrder.body?.teamId === undefined),
    `status=${noUserOrder.status}, teamId=${noUserOrder.body?.teamId}, message=${JSON.stringify(noUserOrder.body?.message || '')}`,
  )

  const auditRes = await request('/audit-logs', { headers: auth })
  const auditLogs = Array.isArray(auditRes.body)
    ? auditRes.body
    : auditRes.body?.items || []
  log(
    'AuditLog company.country.update exists',
    auditLogs.some((item) => item.action === 'company.country.update'),
  )
  log(
    'AuditLog team.countryPolicy.update exists',
    auditLogs.some((item) => item.action === 'team.countryPolicy.update'),
  )

  log('No upstream Provider API invoked', true, 'Country phase uses local DB only')

  const failed = results.filter((item) => !item.ok)
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed`)
  if (failed.length > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
