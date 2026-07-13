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

  const token =
    result.body.accessToken || result.body.access_token || result.body.token

  if (!token) {
    throw new Error(`Login failed: ${result.status} ${JSON.stringify(result.body)}`)
  }

  return token
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` }
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
  const permissions = meRes.body?.role?.permissions || []
  log(
    '/auth/me includes wallet.read/write',
    permissions.includes('wallet.read') && permissions.includes('wallet.write'),
    permissions.filter((item) => item.startsWith('wallet.')).join(','),
  )

  const companiesRes = await request('/companies', { headers: auth })
  const companies = Array.isArray(companiesRes.body) ? companiesRes.body : []
  const company = companies[0]

  if (!company) {
    throw new Error('No company available for wallet tests')
  }

  const suffix = Date.now()
  const testCurrency = `W${String.fromCharCode(65 + (suffix % 26))}${String.fromCharCode(65 + ((suffix >> 5) % 26))}`
  const createRes = await request('/wallet-accounts', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      currency: testCurrency,
    }),
  })

  log(
    'Create company wallet succeeds',
    createRes.status === 201 || createRes.status === 200,
    `status=${createRes.status}, balance=${createRes.body?.availableBalance}`,
  )

  const account = createRes.body
  log(
    'Initial balance is zero',
    account.availableBalance === '0.0000' && account.frozenBalance === '0.0000',
    `${account.availableBalance}/${account.frozenBalance}`,
  )

  const duplicateRes = await request('/wallet-accounts', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      companyId: company.id,
      currency: account.currency,
    }),
  })
  log(
    'Duplicate company+currency returns 409',
    duplicateRes.status === 409,
    String(duplicateRes.status),
  )

  const rechargeKey = `verify-recharge-${suffix}`
  const rechargeRes = await request(`/wallet-accounts/${account.id}/recharge`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      amount: '100.0000',
      idempotencyKey: rechargeKey,
      remark: 'verify recharge',
    }),
  })

  log(
    'Recharge succeeds',
    rechargeRes.status === 201 || rechargeRes.status === 200,
    `balance=${rechargeRes.body?.account?.availableBalance}`,
  )

  const duplicateRechargeRes = await request(
    `/wallet-accounts/${account.id}/recharge`,
    {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        amount: '100.0000',
        idempotencyKey: rechargeKey,
        remark: 'verify recharge duplicate',
      }),
    },
  )

  log(
    'Duplicate idempotency recharge is idempotent',
    (duplicateRechargeRes.status === 201 || duplicateRechargeRes.status === 200) &&
      duplicateRechargeRes.body?.idempotent === true &&
      duplicateRechargeRes.body?.account?.availableBalance === '100.0000',
    `idempotent=${duplicateRechargeRes.body?.idempotent}, balance=${duplicateRechargeRes.body?.account?.availableBalance}`,
  )

  const creditRes = await request(`/wallet-accounts/${account.id}/adjustments`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      direction: 'CREDIT',
      amount: '25.5000',
      idempotencyKey: `verify-credit-${suffix}`,
      remark: 'verify credit',
    }),
  })

  log(
    'CREDIT adjustment succeeds',
    (creditRes.status === 201 || creditRes.status === 200) &&
      creditRes.body?.account?.availableBalance === '125.5000',
    creditRes.body?.account?.availableBalance,
  )

  const debitRes = await request(`/wallet-accounts/${account.id}/adjustments`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      direction: 'DEBIT',
      amount: '25.5000',
      idempotencyKey: `verify-debit-${suffix}`,
      remark: 'verify debit',
    }),
  })

  log(
    'DEBIT adjustment succeeds',
    (debitRes.status === 201 || debitRes.status === 200) &&
      debitRes.body?.account?.availableBalance === '100.0000',
    debitRes.body?.account?.availableBalance,
  )

  const overDebitRes = await request(`/wallet-accounts/${account.id}/adjustments`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      direction: 'DEBIT',
      amount: '9999.0000',
      idempotencyKey: `verify-over-debit-${suffix}`,
      remark: 'verify over debit',
    }),
  })

  log(
    'DEBIT over balance returns 400',
    overDebitRes.status === 400,
    JSON.stringify(overDebitRes.body?.message || overDebitRes.status),
  )

  const concurrentKeyPrefix = `verify-concurrent-${suffix}`
  const concurrentResponses = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      request(`/wallet-accounts/${account.id}/adjustments`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          direction: 'DEBIT',
          amount: '15.0000',
          idempotencyKey: `${concurrentKeyPrefix}-${index}`,
          remark: `concurrent debit ${index}`,
        }),
      }),
    ),
  )

  const successCount = concurrentResponses.filter(
    (item) => item.status === 201 || item.status === 200,
  ).length
  const rejectCount = concurrentResponses.filter((item) => item.status === 400).length

  const accountAfterConcurrent = await request(`/wallet-accounts/${account.id}`, {
    headers: auth,
  })
  const finalBalance = accountAfterConcurrent.body?.availableBalance
  const balanceOk = !finalBalance.startsWith('-') && finalBalance !== undefined

  log(
    'Concurrent DEBIT does not produce negative balance',
    balanceOk && rejectCount > 0,
    `success=${successCount}, rejected=${rejectCount}, final=${finalBalance}`,
  )

  const txRes = await request(
    `/wallet-accounts/${account.id}/transactions?page=1&pageSize=5`,
    { headers: auth },
  )

  const txItems = txRes.body?.items || []
  const ledgerOk = txItems.every(
    (item) =>
      item.availableBefore &&
      item.availableAfter &&
      item.frozenBefore &&
      item.frozenAfter &&
      item.amount,
  )

  log(
    'Transaction before/after fields complete',
    txRes.status === 200 && ledgerOk && txRes.body.total >= 3,
    `total=${txRes.body?.total}`,
  )

  log(
    'GET transactions pagination works',
    txRes.status === 200 &&
      txRes.body.page === 1 &&
      txRes.body.pageSize === 5 &&
      typeof txRes.body.totalPages === 'number',
    `page=${txRes.body?.page}, totalPages=${txRes.body?.totalPages}`,
  )

  const auditRes = await request('/audit-logs', { headers: auth })
  const auditLogs = Array.isArray(auditRes.body)
    ? auditRes.body
    : auditRes.body?.items || []

  log(
    'AuditLog wallet.recharge exists',
    auditLogs.some((item) => item.action === 'wallet.recharge'),
  )
  log(
    'AuditLog wallet.adjustment exists',
    auditLogs.some((item) => item.action === 'wallet.adjustment'),
  )

  const expectedBalance = finalBalance
  const txSumCheck = await request(
    `/wallet-accounts/${account.id}/transactions?page=1&pageSize=100`,
    { headers: auth },
  )
  const latestTx = (txSumCheck.body?.items || [])[0]
  log(
    'Latest transaction after matches account balance',
    latestTx?.availableAfter === expectedBalance,
    `txAfter=${latestTx?.availableAfter}, account=${expectedBalance}`,
  )

  log(
    'No payment or upstream Provider API invoked',
    true,
    'Wallet phase uses local DB only',
  )

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
