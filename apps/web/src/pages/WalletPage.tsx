import { useEffect, useState } from 'react'
import {
  adjustWalletAccount,
  createWalletAccount,
  getCompanies,
  getWalletAccounts,
  getWalletTransactions,
  rechargeWalletAccount,
} from '../api/http'
import type {
  Company,
  WalletAccount,
  WalletTransaction,
  WalletTransactionType,
} from '../api/http'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { Pagination } from '../components/Pagination'
import { StatusBadge } from '../components/StatusBadge'

const WALLET_STATUS_LABELS = {
  ACTIVE: '正常',
  DISABLED: '停用',
} as const

const TRANSACTION_TYPE_LABELS: Record<WalletTransactionType, string> = {
  RECHARGE: '充值',
  MANUAL_CREDIT: '人工加款',
  MANUAL_DEBIT: '人工扣款',
  FREEZE: '冻结',
  RELEASE: '解冻',
  CAPTURE: '扣减冻结',
  REFUND: '退款',
}

const POSITIVE_AMOUNT_PATTERN =
  /^(?:0\.(?:0*[1-9]\d{0,3})|[1-9]\d{0,13}(?:\.\d{1,4})?)$/

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

function createIdempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function getCompanyName(account: WalletAccount, companies: Company[]) {
  if (account.company?.name) {
    return account.company.name
  }

  return companies.find((item) => item.id === account.companyId)?.name || '-'
}

export function WalletPage() {
  const [accounts, setAccounts] = useState<WalletAccount[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [selectedAccount, setSelectedAccount] = useState<WalletAccount | null>(
    null,
  )
  const [loading, setLoading] = useState(false)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [error, setError] = useState('')
  const [transactionError, setTransactionError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [actionTarget, setActionTarget] = useState<WalletAccount | null>(null)

  const [createCompanyId, setCreateCompanyId] = useState('')
  const [createCurrency, setCreateCurrency] = useState('CNY')
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [rechargeRemark, setRechargeRemark] = useState('')
  const [adjustDirection, setAdjustDirection] = useState<'CREDIT' | 'DEBIT'>(
    'CREDIT',
  )
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustRemark, setAdjustRemark] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  async function loadAccounts() {
    setLoading(true)
    setError('')

    try {
      const [accountResult, companyResult] = await Promise.all([
        getWalletAccounts(),
        getCompanies(),
      ])

      setAccounts(accountResult)
      setCompanies(companyResult)

      if (!createCompanyId && companyResult.length > 0) {
        setCreateCompanyId(companyResult[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载钱包账户失败')
    } finally {
      setLoading(false)
    }
  }

  async function loadTransactions(
    account: WalletAccount,
    nextPage = page,
    nextPageSize = pageSize,
  ) {
    setTransactionsLoading(true)
    setTransactionError('')

    try {
      const result = await getWalletTransactions(account.id, {
        page: nextPage,
        pageSize: nextPageSize,
      })

      setTransactions(result.items)
      setTotal(result.total)
      setPage(result.page)
      setPageSize(result.pageSize)
      setTotalPages(result.totalPages)
    } catch (err) {
      setTransactionError(
        err instanceof Error ? err.message : '加载钱包流水失败',
      )
    } finally {
      setTransactionsLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    if (!selectedAccount) {
      setTransactions([])
      return
    }

    setPage(1)
    loadTransactions(selectedAccount, 1, pageSize)
  }, [selectedAccount?.id])

  function openCreateModal() {
    setCreateCompanyId(companies[0]?.id || '')
    setCreateCurrency('CNY')
    setFormError('')
    setCreateModalOpen(true)
  }

  function openRechargeModal(account: WalletAccount) {
    setActionTarget(account)
    setRechargeAmount('')
    setRechargeRemark('')
    setFormError('')
    setRechargeModalOpen(true)
  }

  function openAdjustModal(account: WalletAccount) {
    setActionTarget(account)
    setAdjustDirection('CREDIT')
    setAdjustAmount('')
    setAdjustRemark('')
    setFormError('')
    setAdjustModalOpen(true)
  }

  async function handleCreateAccount() {
    if (!createCompanyId) {
      setFormError('请选择公司')
      return
    }

    if (!createCurrency.trim()) {
      setFormError('请输入币种')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      await createWalletAccount({
        companyId: createCompanyId,
        currency: createCurrency.trim().toUpperCase(),
      })

      setCreateModalOpen(false)
      await loadAccounts()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '创建钱包失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleRecharge() {
    if (!actionTarget) {
      return
    }

    const trimmedAmount = rechargeAmount.trim()

    if (!POSITIVE_AMOUNT_PATTERN.test(trimmedAmount)) {
      setFormError('金额必须是大于 0 的十进制字符串，最多 4 位小数')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      const result = await rechargeWalletAccount(actionTarget.id, {
        amount: trimmedAmount,
        idempotencyKey: createIdempotencyKey('recharge'),
        remark: rechargeRemark.trim() || undefined,
      })

      setRechargeModalOpen(false)
      await loadAccounts()

      if (selectedAccount?.id === actionTarget.id) {
        setSelectedAccount(result.account)
        await loadTransactions(result.account, page, pageSize)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '充值失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdjust() {
    if (!actionTarget) {
      return
    }

    const trimmedAmount = adjustAmount.trim()
    const trimmedRemark = adjustRemark.trim()

    if (!POSITIVE_AMOUNT_PATTERN.test(trimmedAmount)) {
      setFormError('金额必须是大于 0 的十进制字符串，最多 4 位小数')
      return
    }

    if (!trimmedRemark) {
      setFormError('请填写调账备注')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      const result = await adjustWalletAccount(actionTarget.id, {
        direction: adjustDirection,
        amount: trimmedAmount,
        idempotencyKey: createIdempotencyKey('adjust'),
        remark: trimmedRemark,
      })

      setAdjustModalOpen(false)
      await loadAccounts()

      if (selectedAccount?.id === actionTarget.id) {
        setSelectedAccount(result.account)
        await loadTransactions(result.account, page, pageSize)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '调账失败')
    } finally {
      setSaving(false)
    }
  }

  const accountColumns: DataTableColumn<WalletAccount>[] = [
    {
      key: 'company',
      header: '公司',
      render: (account) => getCompanyName(account, companies),
    },
    {
      key: 'currency',
      header: '币种',
      render: (account) => account.currency,
    },
    {
      key: 'availableBalance',
      header: '可用余额',
      render: (account) => account.availableBalance,
    },
    {
      key: 'frozenBalance',
      header: '冻结余额',
      render: (account) => account.frozenBalance,
    },
    {
      key: 'status',
      header: '状态',
      render: (account) => (
        <StatusBadge status={account.status} labelMap={WALLET_STATUS_LABELS} />
      ),
    },
    {
      key: 'actions',
      header: '操作',
      render: (account) => (
        <div className="table-actions">
          <button
            className="text-button"
            type="button"
            onClick={() => setSelectedAccount(account)}
          >
            查看流水
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => openRechargeModal(account)}
          >
            充值
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => openAdjustModal(account)}
          >
            调账
          </button>
        </div>
      ),
    },
  ]

  const transactionColumns: DataTableColumn<WalletTransaction>[] = [
    {
      key: 'createdAt',
      header: '时间',
      render: (item) => formatDate(item.createdAt),
    },
    {
      key: 'type',
      header: '类型',
      render: (item) => TRANSACTION_TYPE_LABELS[item.type] || item.type,
    },
    {
      key: 'amount',
      header: '金额',
      render: (item) => item.amount,
    },
    {
      key: 'available',
      header: '可用余额变动',
      render: (item) => `${item.availableBefore} → ${item.availableAfter}`,
    },
    {
      key: 'frozen',
      header: '冻结余额变动',
      render: (item) => `${item.frozenBefore} → ${item.frozenAfter}`,
    },
    {
      key: 'remark',
      header: '备注',
      render: (item) => item.remark || '-',
    },
    {
      key: 'idempotencyKey',
      header: '幂等键',
      render: (item) => item.idempotencyKey,
    },
  ]

  return (
    <div className="manage-page">
      <PageHeader
        title="钱包管理"
        subtitle="公司级钱包账户、手工充值与人工调账。所有余额变动均写入不可变流水。"
        actions={
          <>
            <button className="secondary-button" type="button" onClick={loadAccounts}>
              刷新
            </button>
            <button className="primary-button" type="button" onClick={openCreateModal}>
              创建公司钱包
            </button>
          </>
        }
      />

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>钱包账户</strong>
          <span>
            {loading ? '正在加载...' : `共 ${accounts.length} 个账户`}
          </span>
        </div>

        {error ? <div className="table-error">{error}</div> : null}

        <DataTable
          columns={accountColumns}
          rows={accounts}
          rowKey={(account) => account.id}
          loading={loading}
          loadingText="正在加载钱包账户..."
          emptyText="暂无钱包账户"
        />
      </section>

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>资金流水</strong>
          <span>
            {selectedAccount
              ? `${getCompanyName(selectedAccount, companies)} / ${selectedAccount.currency}`
              : '请选择账户查看流水'}
          </span>
        </div>

        {transactionError ? (
          <div className="table-error">{transactionError}</div>
        ) : null}

        <DataTable
          columns={transactionColumns}
          rows={transactions}
          rowKey={(item) => item.id}
          loading={transactionsLoading}
          loadingText="正在加载流水..."
          emptyText={
            selectedAccount ? '暂无流水记录' : '请先在上方选择一个钱包账户'
          }
        />

        {selectedAccount ? (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            disabled={transactionsLoading}
            onPageChange={(nextPage) => {
              setPage(nextPage)
              loadTransactions(selectedAccount, nextPage, pageSize)
            }}
            onPageSizeChange={(nextPageSize) => {
              setPage(1)
              setPageSize(nextPageSize)
              loadTransactions(selectedAccount, 1, nextPageSize)
            }}
          />
        ) : null}
      </section>

      {createModalOpen ? (
        <div className="modal-mask">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>创建公司钱包</h3>
                <p>第一阶段仅支持 userId 为空的公司级钱包，初始余额为 0。</p>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => !saving && setCreateModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-form">
              <label>
                <span>所属公司</span>
                <select
                  value={createCompanyId}
                  onChange={(event) => setCreateCompanyId(event.target.value)}
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>币种</span>
                <input
                  value={createCurrency}
                  onChange={(event) =>
                    setCreateCurrency(event.target.value.toUpperCase())
                  }
                  placeholder="CNY"
                />
              </label>

              {formError ? <div className="form-error">{formError}</div> : null}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                type="button"
                disabled={saving}
                onClick={() => setCreateModalOpen(false)}
              >
                取消
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={saving}
                onClick={handleCreateAccount}
              >
                {saving ? '创建中...' : '确认创建'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rechargeModalOpen && actionTarget ? (
        <div className="modal-mask">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>手工充值</h3>
                <p>
                  {getCompanyName(actionTarget, companies)} / {actionTarget.currency}
                </p>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => !saving && setRechargeModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-form">
              <label>
                <span>充值金额</span>
                <input
                  value={rechargeAmount}
                  onChange={(event) => setRechargeAmount(event.target.value)}
                  placeholder="100.0000"
                />
              </label>

              <label>
                <span>备注（可选）</span>
                <input
                  value={rechargeRemark}
                  onChange={(event) => setRechargeRemark(event.target.value)}
                  placeholder="例如：线下收款"
                />
              </label>

              {formError ? <div className="form-error">{formError}</div> : null}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                type="button"
                disabled={saving}
                onClick={() => setRechargeModalOpen(false)}
              >
                取消
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={saving}
                onClick={handleRecharge}
              >
                {saving ? '提交中...' : '确认充值'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adjustModalOpen && actionTarget ? (
        <div className="modal-mask">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>人工调账</h3>
                <p>
                  {getCompanyName(actionTarget, companies)} / {actionTarget.currency}
                </p>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => !saving && setAdjustModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-form">
              <label>
                <span>方向</span>
                <select
                  value={adjustDirection}
                  onChange={(event) =>
                    setAdjustDirection(event.target.value as 'CREDIT' | 'DEBIT')
                  }
                >
                  <option value="CREDIT">加款（CREDIT）</option>
                  <option value="DEBIT">扣款（DEBIT）</option>
                </select>
              </label>

              <label>
                <span>金额</span>
                <input
                  value={adjustAmount}
                  onChange={(event) => setAdjustAmount(event.target.value)}
                  placeholder="10.0000"
                />
              </label>

              <label>
                <span>备注</span>
                <input
                  value={adjustRemark}
                  onChange={(event) => setAdjustRemark(event.target.value)}
                  placeholder="必填，说明调账原因"
                />
              </label>

              {formError ? <div className="form-error">{formError}</div> : null}
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                type="button"
                disabled={saving}
                onClick={() => setAdjustModalOpen(false)}
              >
                取消
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={saving}
                onClick={handleAdjust}
              >
                {saving ? '提交中...' : '确认调账'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
