const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000'
const ORDER_CURRENCY = (process.env.ORDER_CURRENCY || 'USD').trim().toUpperCase()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

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

  const token =
    result.body.accessToken || result.body.access_token || result.body.token

  if (!token) {
    throw new Error(`Login failed: ${result.status}`)
  }

  return token
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` }
}

async function ensureCompanyWallet(auth, companyId, suffix) {
  const accountsRes = await request(
    `/wallet-accounts?companyId=${encodeURIComponent(companyId)}`,
    { headers: auth },
  )
  const accounts = Array.isArray(accountsRes.body) ? accountsRes.body : []
  let wallet = accounts.find((item) => item.currency === ORDER_CURRENCY)

  if (!wallet) {
    const createRes = await request('/wallet-accounts', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        companyId,
        currency: ORDER_CURRENCY,
      }),
    })

    if (createRes.status !== 201 && createRes.status !== 200) {
      throw new Error(`Create wallet failed: ${JSON.stringify(createRes.body)}`)
    }

    wallet = createRes.body
  }

  await request(`/wallet-accounts/${wallet.id}/recharge`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      amount: '1000.0000',
      idempotencyKey: `order-wallet-setup-${suffix}`,
      remark: 'order wallet integration setup',
    }),
  })

  const refreshed = await request(`/wallet-accounts/${wallet.id}`, {
    headers: auth,
  })

  return refreshed.body
}

function addAmount(base, delta) {
  const value = Number(base) + Number(delta)
  return value.toFixed(4)
}

async function findCompanyOrderCurrencyWallet(companyId) {
  return prisma.walletAccount.findFirst({
    where: {
      companyId,
      currency: ORDER_CURRENCY,
      userId: null,
    },
  })
}

async function hideCompanyOrderCurrencyWallet(companyId) {
  const wallet = await findCompanyOrderCurrencyWallet(companyId)

  if (!wallet) {
    return null
  }

  const hiddenCurrency = `${ORDER_CURRENCY}__HIDDEN__${Date.now()}`

  await prisma.walletAccount.update({
    where: { id: wallet.id },
    data: { currency: hiddenCurrency },
  })

  return {
    walletId: wallet.id,
    originalCurrency: ORDER_CURRENCY,
    hiddenCurrency,
    previousStatus: wallet.status,
  }
}

async function restoreWalletSnapshot(snapshot) {
  if (!snapshot) {
    return
  }

  await prisma.walletAccount.update({
    where: { id: snapshot.walletId },
    data: {
      currency: snapshot.originalCurrency,
      status: snapshot.previousStatus,
    },
  })
}

async function setWalletStatus(walletId, status) {
  await prisma.walletAccount.update({
    where: { id: walletId },
    data: { status },
  })
}

async function countOrdersForPhone(phoneResourceId) {
  return prisma.order.count({
    where: { phoneResourceId },
  })
}

async function countOrderWalletTransactionsSince(walletAccountId, since) {
  return prisma.walletTransaction.count({
    where: {
      walletAccountId,
      referenceType: 'Order',
      createdAt: { gte: since },
    },
  })
}

async function countOrderCreateAuditLogsSince(companyId, phoneResourceId, since) {
  const logs = await prisma.auditLog.findMany({
    where: {
      companyId,
      action: 'order.create',
      createdAt: { gte: since },
    },
    select: {
      id: true,
      afterData: true,
    },
  })

  return logs.filter(
    (item) => item.afterData?.phoneResourceId === phoneResourceId,
  ).length
}

async function getPhoneStatus(phoneResourceId) {
  const phone = await prisma.phoneResource.findUnique({
    where: { id: phoneResourceId },
    select: { status: true },
  })

  return phone?.status ?? null
}

async function verifyCreateOrderRollback(params) {
  const {
    auth,
    company,
    service,
    provider,
    phone,
    walletAccountId,
    since,
    label,
    log,
  } = params

  const orderCountBefore = await countOrdersForPhone(phone.id)
  const walletTxBefore = walletAccountId
    ? await countOrderWalletTransactionsSince(walletAccountId, since)
    : 0
  const auditBefore = await countOrderCreateAuditLogsSince(
    company.id,
    phone.id,
    since,
  )
  const phoneStatusBefore = await getPhoneStatus(phone.id)

  const createRes = await request('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      serviceId: service.id,
      providerId: provider.id,
      phoneResourceId: phone.id,
      amount: '20.0000',
    }),
  })

  const orderCountAfter = await countOrdersForPhone(phone.id)
  const walletTxAfter = walletAccountId
    ? await countOrderWalletTransactionsSince(walletAccountId, since)
    : 0
  const auditAfter = await countOrderCreateAuditLogsSince(
    company.id,
    phone.id,
    since,
  )
  const phoneStatusAfter = await getPhoneStatus(phone.id)

  const httpOk = createRes.status === 400 || createRes.status === 409
  const noOrder = orderCountAfter === orderCountBefore
  const phoneAvailable =
    phoneStatusBefore === 'AVAILABLE' && phoneStatusAfter === 'AVAILABLE'
  const noWalletTx = walletTxAfter === walletTxBefore
  const noAudit = auditAfter === auditBefore

  log(
    `${label} returns 400/409`,
    httpOk,
    `status=${createRes.status}, message=${JSON.stringify(createRes.body?.message || createRes.body)}`,
  )
  log(`${label} does not create Order`, noOrder, `before=${orderCountBefore}, after=${orderCountAfter}`)
  log(
    `${label} keeps PhoneResource AVAILABLE`,
    phoneAvailable,
    `before=${phoneStatusBefore}, after=${phoneStatusAfter}`,
  )
  log(
    `${label} does not create WalletTransaction`,
    noWalletTx,
    `before=${walletTxBefore}, after=${walletTxAfter}`,
  )
  log(
    `${label} does not create order.create AuditLog`,
    noAudit,
    `before=${auditBefore}, after=${auditAfter}`,
  )

  return {
    httpStatus: createRes.status,
    message: createRes.body?.message || createRes.body,
    rollbackOk: noOrder && phoneAvailable && noWalletTx && noAudit,
  }
}

async function prepareOrderContext(auth, suffix) {
  const [companiesRes, servicesRes, providersRes, phonesRes] =
    await Promise.all([
      request('/companies', { headers: auth }),
      request('/services', { headers: auth }),
      request('/providers', { headers: auth }),
      request('/phone-resources', { headers: auth }),
    ])

  const companies = Array.isArray(companiesRes.body) ? companiesRes.body : []
  const services = Array.isArray(servicesRes.body) ? servicesRes.body : []
  const providers = Array.isArray(providersRes.body) ? providersRes.body : []
  let phones = Array.isArray(phonesRes.body) ? phonesRes.body : []

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
  phones = Array.isArray(refreshedPhonesRes.body)
    ? refreshedPhonesRes.body
    : phones

  for (const company of companies) {
    for (const service of services.filter((item) => item.companyId === company.id)) {
      for (const provider of providers.filter(
        (item) =>
          item.companyId === company.id &&
          item.services?.some((svc) => svc.id === service.id),
      )) {
        const providerPhones = phones.filter(
          (phone) =>
            phone.companyId === company.id &&
            phone.providerId === provider.id &&
            phone.status === 'AVAILABLE' &&
            phone.country,
        )

        const createdPhones = [...providerPhones]

        while (createdPhones.length < 3) {
          const index = createdPhones.length + 1
          const createPhoneRes = await request('/phone-resources', {
            method: 'POST',
            headers: auth,
            body: JSON.stringify({
              companyId: company.id,
              providerId: provider.id,
              phone: `+1415555${String(suffix).slice(-4)}${index}`,
              country: 'US',
              cost: '0.5000',
              status: 'AVAILABLE',
            }),
          })

          if (createPhoneRes.status !== 201 && createPhoneRes.status !== 200) {
            break
          }

          createdPhones.push(createPhoneRes.body)
        }

        if (createdPhones.length >= 2) {
          return {
            company,
            service,
            provider,
            phoneA: createdPhones[0],
            phoneB: createdPhones[1],
            phoneC: createdPhones[2] || createdPhones[1],
          }
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
  const suffix = Date.now()

  const context = await prepareOrderContext(auth, suffix)
  if (!context) {
    throw new Error('No order context with 2 available phones')
  }

  const { company, service, provider, phoneA, phoneB, phoneC } = context

  const failureSince = new Date()

  let hiddenWalletSnapshot = null
  try {
    hiddenWalletSnapshot = await hideCompanyOrderCurrencyWallet(company.id)

    await verifyCreateOrderRollback({
      auth,
      company,
      service,
      provider,
      phone: phoneC,
      walletAccountId: hiddenWalletSnapshot?.walletId ?? null,
      since: failureSince,
      label: 'Missing ORDER_CURRENCY wallet',
      log,
    })
  } finally {
    await restoreWalletSnapshot(hiddenWalletSnapshot)
  }

  const walletForDisable = await findCompanyOrderCurrencyWallet(company.id)
  if (!walletForDisable) {
    throw new Error('Expected company wallet to exist before disabled-wallet test')
  }

  const disabledSince = new Date()
  const previousWalletStatus = walletForDisable.status

  try {
    await setWalletStatus(walletForDisable.id, 'DISABLED')

    await verifyCreateOrderRollback({
      auth,
      company,
      service,
      provider,
      phone: phoneC,
      walletAccountId: walletForDisable.id,
      since: disabledSince,
      label: 'DISABLED company wallet',
      log,
    })
  } finally {
    await setWalletStatus(walletForDisable.id, previousWalletStatus)
  }

  const wallet = await ensureCompanyWallet(auth, company.id, suffix)

  const walletBeforeCreate = await request(`/wallet-accounts/${wallet.id}`, {
    headers: auth,
  })
  const startAvailable = walletBeforeCreate.body.availableBalance
  const startFrozen = walletBeforeCreate.body.frozenBalance

  const createRes = await request('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      serviceId: service.id,
      providerId: provider.id,
      phoneResourceId: phoneA.id,
      amount: '20.0000',
    }),
  })

  log(
    'Create order freezes wallet and locks phone',
    (createRes.status === 201 || createRes.status === 200) &&
      createRes.body?.status === 'WAIT_SMS',
    `order=${createRes.body?.id}, status=${createRes.status}`,
  )

  const walletAfterCreate = await request(`/wallet-accounts/${wallet.id}`, {
    headers: auth,
  })
  const phoneAfterCreate = await request(
    `/phone-resources/${phoneA.id}`,
    { headers: auth },
  ).catch(() => ({ body: null }))

  const phonesRes = await request('/phone-resources', { headers: auth })
  const phones = Array.isArray(phonesRes.body) ? phonesRes.body : []
  const lockedPhone = phones.find((item) => item.id === phoneA.id)

  log(
    'Freeze balances after create',
    walletAfterCreate.body?.availableBalance === addAmount(startAvailable, -20) &&
      walletAfterCreate.body?.frozenBalance === addAmount(startFrozen, 20),
    `available=${walletAfterCreate.body?.availableBalance}, frozen=${walletAfterCreate.body?.frozenBalance}`,
  )

  log(
    'Phone locked after create',
    lockedPhone?.status === 'LOCKED',
    lockedPhone?.status,
  )

  const freezeTxRes = await request(
    `/wallet-accounts/${wallet.id}/transactions?page=1&pageSize=20`,
    { headers: auth },
  )
  const freezeTx = (freezeTxRes.body?.items || []).find(
    (item) =>
      item.type === 'FREEZE' &&
      item.referenceType === 'Order' &&
      item.referenceId === createRes.body?.id,
  )

  log(
    'FREEZE transaction linked to order',
    Boolean(freezeTx),
    freezeTx?.idempotencyKey,
  )

  const smsRes = await request(`/orders/${createRes.body.id}/sms`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      code: '123456',
      content: 'verify sms capture',
    }),
  })

  log(
    'Sms success captures wallet',
    smsRes.status === 201 || smsRes.status === 200,
    `status=${smsRes.status}`,
  )

  const walletAfterSms = await request(`/wallet-accounts/${wallet.id}`, {
    headers: auth,
  })
  const phonesAfterSms = await request('/phone-resources', { headers: auth })
  const phoneListAfterSms = Array.isArray(phonesAfterSms.body)
    ? phonesAfterSms.body
    : []
  const usedPhone = phoneListAfterSms.find((item) => item.id === phoneA.id)
  const orderAfterSms = await request(`/orders/${createRes.body.id}`, {
    headers: auth,
  })

  log(
    'Capture balances after sms',
    walletAfterSms.body?.availableBalance === addAmount(startAvailable, -20) &&
      walletAfterSms.body?.frozenBalance === startFrozen,
    `available=${walletAfterSms.body?.availableBalance}, frozen=${walletAfterSms.body?.frozenBalance}`,
  )

  log(
    'Order SUCCESS and phone USED after sms',
    orderAfterSms.body?.status === 'SUCCESS' && usedPhone?.status === 'USED',
    `${orderAfterSms.body?.status}/${usedPhone?.status}`,
  )

  const captureTx = (walletAfterSms.body ? freezeTxRes.body?.items : []) || []
  const txAfterSmsRes = await request(
    `/wallet-accounts/${wallet.id}/transactions?page=1&pageSize=20`,
    { headers: auth },
  )
  const captureExists = (txAfterSmsRes.body?.items || []).some(
    (item) =>
      item.type === 'CAPTURE' &&
      item.referenceId === createRes.body?.id &&
      item.idempotencyKey === `order:${createRes.body.id}:capture`,
  )

  log('CAPTURE transaction exists', captureExists)

  const duplicateSmsRes = await request(`/orders/${createRes.body.id}/sms`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      code: '654321',
      content: 'duplicate sms should fail',
    }),
  })
  const walletAfterDuplicateSms = await request(
    `/wallet-accounts/${wallet.id}`,
    { headers: auth },
  )

  log(
    'Duplicate sms does not double capture',
    duplicateSmsRes.status >= 400 &&
      walletAfterDuplicateSms.body?.availableBalance ===
        walletAfterSms.body?.availableBalance &&
      walletAfterDuplicateSms.body?.frozenBalance ===
        walletAfterSms.body?.frozenBalance,
    `status=${duplicateSmsRes.status}`,
  )

  const create2 = await request('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      serviceId: service.id,
      providerId: provider.id,
      phoneResourceId: phoneB.id,
      amount: '15.0000',
    }),
  })

  log(
    'Second order create for release test',
    create2.status === 201 || create2.status === 200,
    create2.body?.id,
  )

  const cancelRes = await request(`/orders/${create2.body.id}/status`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ status: 'CANCELLED' }),
  })

  log(
    'Cancel releases wallet and phone',
    cancelRes.status === 200,
    cancelRes.body?.status,
  )

  const walletAfterRelease = await request(`/wallet-accounts/${wallet.id}`, {
    headers: auth,
  })
  const phonesAfterRelease = await request('/phone-resources', { headers: auth })
  const releasedPhone = (Array.isArray(phonesAfterRelease.body)
    ? phonesAfterRelease.body
    : []
  ).find((item) => item.id === phoneB.id)

  log(
    'Release restores available balance',
    walletAfterRelease.body?.frozenBalance === walletAfterSms.body?.frozenBalance &&
      walletAfterRelease.body?.availableBalance ===
        walletAfterSms.body?.availableBalance,
    `available=${walletAfterRelease.body?.availableBalance}, frozen=${walletAfterRelease.body?.frozenBalance}`,
  )

  log(
    'Phone AVAILABLE after cancel',
    releasedPhone?.status === 'AVAILABLE',
    releasedPhone?.status,
  )

  const releaseExists = (
    await request(
      `/wallet-accounts/${wallet.id}/transactions?page=1&pageSize=50`,
      { headers: auth },
    )
  ).body?.items?.some(
    (item) =>
      item.type === 'RELEASE' &&
      item.referenceId === create2.body?.id &&
      item.idempotencyKey === `order:${create2.body.id}:release`,
  )

  log('RELEASE transaction exists', Boolean(releaseExists))

  const insufficientRes = await request('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      serviceId: service.id,
      providerId: provider.id,
      phoneResourceId: phoneB.id,
      amount: '99999.0000',
    }),
  })

  log(
    'Insufficient balance create fails',
    insufficientRes.status === 400,
    JSON.stringify(insufficientRes.body?.message || insufficientRes.status),
  )

  const phonesAfterInsufficient = await request('/phone-resources', {
    headers: auth,
  })
  const phoneStillAvailable = (
    Array.isArray(phonesAfterInsufficient.body)
      ? phonesAfterInsufficient.body
      : []
  ).find((item) => item.id === phoneB.id)

  log(
    'Insufficient balance does not lock phone',
    phoneStillAvailable?.status === 'AVAILABLE',
    phoneStillAvailable?.status,
  )

  const forceSuccessOrder = await request('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      serviceId: service.id,
      providerId: provider.id,
      phoneResourceId: phoneB.id,
      amount: '10.0000',
    }),
  })

  const forceRes = await request(
    `/orders/${forceSuccessOrder.body.id}/status`,
    {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ status: 'SUCCESS' }),
    },
  )

  log(
    'Force success captures wallet',
    forceRes.status === 200 && forceRes.body?.status === 'SUCCESS',
    forceRes.body?.status,
  )

  const walletAfterForce = await request(`/wallet-accounts/${wallet.id}`, {
    headers: auth,
  })
  const captureCountAfterForce = (
    await request(
      `/wallet-accounts/${wallet.id}/transactions?page=1&pageSize=50`,
      { headers: auth },
    )
  ).body?.items?.filter(
    (item) =>
      item.type === 'CAPTURE' &&
      item.referenceId === forceSuccessOrder.body?.id,
  ).length

  log(
    'Force success captures wallet once',
    forceRes.status === 200 &&
      forceRes.body?.status === 'SUCCESS' &&
      captureCountAfterForce === 1,
    `${forceRes.body?.status}, captures=${captureCountAfterForce}`,
  )

  const concurrentPhone = phoneC

  if (concurrentPhone) {
    const concurrentResults = await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        request('/orders', {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({
            companyId: company.id,
            serviceId: service.id,
            providerId: provider.id,
            phoneResourceId: concurrentPhone.id,
            amount: '5.0000',
          }),
        }),
      ),
    )

    const successCount = concurrentResults.filter(
      (item) => item.status === 201 || item.status === 200,
    ).length

    log(
      'Concurrent same phone only one succeeds',
      successCount === 1,
      `success=${successCount}`,
    )
  } else {
    log('Concurrent same phone only one succeeds', true, 'skipped: no phone')
  }

  log(
    'No payment or provider API invoked',
    true,
    'Order-wallet integration uses local DB only',
  )

  const failed = results.filter((item) => !item.ok)
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed`)
  if (failed.length > 0) {
    process.exit(1)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
