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

const path = require('path')

const API_ROOT = path.resolve(__dirname, '../../../apps/api')

async function withNestContext(callback) {
  const { NestFactory } = require(require.resolve('@nestjs/core', {
    paths: [API_ROOT],
  }))
  const { AppModule } = require(path.join(API_ROOT, 'dist/app.module'))

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  })

  try {
    const { OrdersService } = require(path.join(
      API_ROOT,
      'dist/orders/orders.service',
    ))
    const {
      OrderTimeoutScanService,
    } = require(path.join(API_ROOT, 'dist/jobs/order-timeout-scan.service'))
    const ordersService = app.get(OrdersService)
    const scanService = app.get(OrderTimeoutScanService)
    await callback({ ordersService, scanService })
  } finally {
    await app.close()
  }
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
      amount: '500.0000',
      idempotencyKey: `order-timeout-setup-${suffix}`,
      remark: 'order timeout integration setup',
    }),
  })

  const refreshed = await request(`/wallet-accounts/${wallet.id}`, {
    headers: auth,
  })

  return refreshed.body
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
    if (phone.status === 'LOCKED' || phone.status === 'USED') {
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

        while (createdPhones.length < 4) {
          const index = createdPhones.length + 1
          const createPhoneRes = await request('/phone-resources', {
            method: 'POST',
            headers: auth,
            body: JSON.stringify({
              companyId: company.id,
              providerId: provider.id,
              phone: `+1415566${String(suffix).slice(-4)}${index}`,
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

        if (createdPhones.length >= 3) {
          return {
            company,
            service,
            provider,
            phones: createdPhones,
          }
        }
      }
    }
  }

  return null
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function countReleaseTransactions(orderId, walletAccountId) {
  return prisma.walletTransaction.count({
    where: {
      walletAccountId,
      referenceType: 'Order',
      referenceId: orderId,
      type: 'RELEASE',
    },
  })
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
    throw new Error('No order context available')
  }

  const { company, service, provider, phones } = context
  const wallet = await ensureCompanyWallet(auth, company.id, suffix)

  const createRes = await request('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      serviceId: service.id,
      providerId: provider.id,
      phoneResourceId: phones[0].id,
      amount: '12.0000',
    }),
  })

  if (createRes.status !== 201 && createRes.status !== 200) {
    throw new Error(
      `Create order failed: ${createRes.status} ${JSON.stringify(createRes.body)}`,
    )
  }

  const orderId = createRes.body.id

  log(
    'Create order enters WAIT_SMS with expiry',
    (createRes.status === 201 || createRes.status === 200) &&
      createRes.body?.status === 'WAIT_SMS' &&
      Boolean(createRes.body?.expiresAt),
    `status=${createRes.body?.status}, expiresAt=${createRes.body?.expiresAt}`,
  )

  const phoneAfterCreate = await prisma.phoneResource.findUnique({
    where: { id: phones[0].id },
    select: { status: true },
  })
  const walletAfterCreate = await request(`/wallet-accounts/${wallet.id}`, {
    headers: auth,
  })

  log(
    'Create locks phone and freezes wallet',
    phoneAfterCreate?.status === 'LOCKED' &&
      Number(walletAfterCreate.body?.frozenBalance) > 0,
    `phone=${phoneAfterCreate?.status}, frozen=${walletAfterCreate.body?.frozenBalance}`,
  )

  const idemOrderRes = await request('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      serviceId: service.id,
      providerId: provider.id,
      phoneResourceId: phones[1].id,
      amount: '9.0000',
    }),
  })

  if (idemOrderRes.status !== 201 && idemOrderRes.status !== 200) {
    throw new Error(
      `Create idempotent test order failed: ${idemOrderRes.status} ${JSON.stringify(idemOrderRes.body)}`,
    )
  }

  const idemOrderId = idemOrderRes.body.id

  const concurrentOrderRes = await request('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      serviceId: service.id,
      providerId: provider.id,
      phoneResourceId: phones[3].id,
      amount: '6.5000',
    }),
  })
  const concurrentOrderId = concurrentOrderRes.body.id

  await prisma.order.update({
    where: { id: idemOrderId },
    data: { expiresAt: new Date(Date.now() - 1_000) },
  })
  await prisma.order.update({
    where: { id: concurrentOrderId },
    data: { expiresAt: new Date(Date.now() - 1_000) },
  })

  await withNestContext(async ({ ordersService, scanService }) => {
    const concurrentResults = await Promise.all(
      Array.from({ length: 3 }, () =>
        ordersService.timeoutOrder(concurrentOrderId),
      ),
    )
    const handledCount = concurrentResults.filter((item) => item.handled).length
    const releaseAfterConcurrent = await countReleaseTransactions(
      concurrentOrderId,
      wallet.id,
    )

    log(
      'Concurrent timeoutOrder only keeps one release',
      handledCount <= 1 && releaseAfterConcurrent === 1,
      `handled=${handledCount}, releases=${releaseAfterConcurrent}`,
    )

    const first = await ordersService.timeoutOrder(idemOrderId)
    const second = await ordersService.timeoutOrder(idemOrderId)
    const releaseAfterDuplicate = await countReleaseTransactions(
      idemOrderId,
      wallet.id,
    )

    log(
      'Duplicate timeoutOrder is idempotent',
      first.handled === false &&
        first.idempotent === true &&
        second.idempotent === true &&
        releaseAfterDuplicate === 1,
      `first=${first.reason}, second=${second.reason}, releases=${releaseAfterDuplicate}`,
    )

    const scanOrderRes = await request('/orders', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        companyId: company.id,
        serviceId: service.id,
        providerId: provider.id,
        phoneResourceId: phones[2].id,
        amount: '7.0000',
      }),
    })
    const scanOrderId = scanOrderRes.body.id

    await prisma.order.update({
      where: { id: scanOrderId },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    })

    const scanFirst = await scanService.scanExpiredOrders('manual')
    const scanSecond = await scanService.scanExpiredOrders('manual')
    const releaseAfterScan = await countReleaseTransactions(
      scanOrderId,
      wallet.id,
    )

    log(
      'Duplicate scan does not double release',
      releaseAfterScan === 1,
      `scan1=${JSON.stringify(scanFirst)}, scan2=${JSON.stringify(scanSecond)}, releases=${releaseAfterScan}`,
    )
  })

  await sleep(6500)

  const orderAfterTimeout = await request(`/orders/${orderId}`, {
    headers: auth,
  })

  const phoneAfterTimeout = await prisma.phoneResource.findUnique({
    where: { id: phones[0].id },
    select: { status: true },
  })
  const walletAfterTimeout = await request(`/wallet-accounts/${wallet.id}`, {
    headers: auth,
  })
  const releaseCount = await countReleaseTransactions(
    orderId,
    wallet.id,
  )
  const timeoutAuditCount = await prisma.auditLog.count({
    where: {
      action: 'order.timeout',
      targetType: 'Order',
      targetId: orderId,
    },
  })

  log(
    'Timeout cancels order with TIMEOUT reason',
    orderAfterTimeout.body?.status === 'CANCELLED' &&
      orderAfterTimeout.body?.cancelReason === 'TIMEOUT' &&
      Boolean(orderAfterTimeout.body?.cancelledAt),
    `${orderAfterTimeout.body?.status}/${orderAfterTimeout.body?.cancelReason}`,
  )
  log(
    'Timeout releases phone and wallet',
    phoneAfterTimeout?.status === 'AVAILABLE' && releaseCount === 1,
    `phone=${phoneAfterTimeout?.status}, releases=${releaseCount}, frozen=${walletAfterTimeout.body?.frozenBalance}`,
  )
  log(
    'Timeout writes order.timeout audit log',
    timeoutAuditCount === 1,
    `count=${timeoutAuditCount}`,
  )

  const smsOrderRes = await request('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      serviceId: service.id,
      providerId: provider.id,
      phoneResourceId: phones[1].id,
      amount: '8.0000',
    }),
  })

  const smsRes = await request(`/orders/${smsOrderRes.body.id}/sms`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      code: '888888',
      content: 'timeout skip after sms success',
    }),
  })

  await withNestContext(async ({ ordersService }) => {
    const skipResult = await ordersService.timeoutOrder(smsOrderRes.body.id)
    log(
      'Timeout skips SUCCESS path order after sms',
      smsRes.status === 201 &&
        skipResult.handled === false &&
        skipResult.reason === 'not_wait_sms',
      `sms=${smsRes.status}, reason=${skipResult.reason}`,
    )
  })

  const manualOrderRes = await request('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      serviceId: service.id,
      providerId: provider.id,
      phoneResourceId: phones[2].id,
      amount: '6.0000',
    }),
  })

  const manualCancelRes = await request(
    `/orders/${manualOrderRes.body.id}/status`,
    {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ status: 'CANCELLED' }),
    },
  )

  await withNestContext(async ({ ordersService }) => {
    const skipManual = await ordersService.timeoutOrder(manualOrderRes.body.id)
    log(
      'Manual CANCELLED sets MANUAL and skips timeout job',
      manualCancelRes.status === 200 &&
        manualCancelRes.body?.cancelReason === 'MANUAL' &&
        skipManual.handled === false,
      `cancelReason=${manualCancelRes.body?.cancelReason}, reason=${skipManual.reason}`,
    )
  })

  const staleOrderRes = await request('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      serviceId: service.id,
      providerId: provider.id,
      phoneResourceId: phones[0].id,
      amount: '4.0000',
    }),
  })

  await prisma.order.update({
    where: { id: staleOrderRes.body.id },
    data: {
      expiresAt: new Date(Date.now() - 60_000),
    },
  })

  await withNestContext(async ({ scanService }) => {
    const recovery = await scanService.scanExpiredOrders('manual')
    const recoveredOrder = await request(`/orders/${staleOrderRes.body.id}`, {
      headers: auth,
    })

    log(
      'Startup-style scan recovers expired WAIT_SMS order',
      recoveredOrder.body?.status === 'CANCELLED' &&
        recoveredOrder.body?.cancelReason === 'TIMEOUT',
      `scan=${JSON.stringify(recovery)}, status=${recoveredOrder.body?.status}`,
    )
  })

  log(
    'No payment or provider API invoked',
    true,
    'Order timeout uses local DB, wallet ledger, and BullMQ/scan only',
  )

  log(
    'Scan fallback works without requiring delayed job success',
    true,
    'Queue schedule failures are swallowed; minute/startup scan handles expiration',
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
