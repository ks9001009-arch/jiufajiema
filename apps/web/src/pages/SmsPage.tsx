import { useEffect, useState } from 'react'
import { getCompanies, getSmsList } from '../api/http'
import type { Company, OrderStatus, Sms, SmsStatus } from '../api/http'
import { DataTable, type DataTableColumn } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { Pagination } from '../components/Pagination'
import { StatusBadge } from '../components/StatusBadge'
import { TableToolbar } from '../components/TableToolbar'
import { getCountryLabel } from '../utils/country'

const SMS_STATUS_LABELS: Record<SmsStatus, string> = {
  RECEIVED: '已接收',
  FAILED: '失败',
}

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: '待处理',
  WAIT_SMS: '等待短信',
  SUCCESS: '成功',
  FAILED: '失败',
  CANCELLED: '已取消',
}

type SmsFilterState = {
  companyId: string
  orderStatus: string
  phone: string
  code: string
  status: string
  createdFrom: string
  createdTo: string
}

const emptySmsFilters: SmsFilterState = {
  companyId: '',
  orderStatus: '',
  phone: '',
  code: '',
  status: '',
  createdFrom: '',
  createdTo: '',
}

function formatDate(value?: string | null) {
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

function truncateText(value?: string | null, maxLength = 40) {
  if (!value) {
    return '-'
  }

  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}...`
}

function toSmsQueryParams(
  filters: SmsFilterState,
  page: number,
  pageSize: number,
) {
  return {
    companyId: filters.companyId || undefined,
    orderStatus: (filters.orderStatus || undefined) as OrderStatus | undefined,
    phone: filters.phone.trim() || undefined,
    code: filters.code.trim() || undefined,
    status: (filters.status || undefined) as SmsStatus | undefined,
    createdFrom: filters.createdFrom
      ? new Date(filters.createdFrom).toISOString()
      : undefined,
    createdTo: filters.createdTo
      ? new Date(filters.createdTo).toISOString()
      : undefined,
    page,
    pageSize,
  }
}

export function SmsPage() {
  const [smsList, setSmsList] = useState<Sms[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<SmsFilterState>(emptySmsFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [detailTarget, setDetailTarget] = useState<Sms | null>(null)

  async function loadSmsList(
    nextFilters = filters,
    nextPage = page,
    nextPageSize = pageSize,
  ) {
    setLoading(true)
    setError('')

    try {
      const result = await getSmsList(
        toSmsQueryParams(nextFilters, nextPage, nextPageSize),
      )
      setSmsList(result.items)
      setTotal(result.total)
      setPage(result.page)
      setPageSize(result.pageSize)
      setTotalPages(result.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载短信记录失败')
    } finally {
      setLoading(false)
    }
  }

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [smsResult, companyResult] = await Promise.all([
        getSmsList({ page: 1, pageSize: 20 }),
        getCompanies(),
      ])

      setSmsList(smsResult.items)
      setTotal(smsResult.total)
      setPage(smsResult.page)
      setPageSize(smsResult.pageSize)
      setTotalPages(smsResult.totalPages)
      setCompanies(companyResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载短信记录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function handleSearch() {
    loadSmsList(filters, 1, pageSize)
  }

  function handleResetFilters() {
    setFilters(emptySmsFilters)
    loadSmsList(emptySmsFilters, 1, pageSize)
  }

  function handlePageChange(nextPage: number) {
    loadSmsList(filters, nextPage, pageSize)
  }

  function handlePageSizeChange(nextPageSize: number) {
    loadSmsList(filters, 1, nextPageSize)
  }

  const smsColumns: DataTableColumn<Sms>[] = [
    {
      key: 'id',
      header: '短信 ID',
      render: (sms) => `${sms.id.slice(0, 8)}...`,
    },
    {
      key: 'company',
      header: '公司',
      render: (sms) => sms.order?.company?.name || '-',
    },
    {
      key: 'orderId',
      header: '订单 ID',
      render: (sms) => `${sms.orderId.slice(0, 8)}...`,
    },
    {
      key: 'orderStatus',
      header: '订单状态',
      render: (sms) =>
        sms.order?.status ? (
          <StatusBadge
            status={sms.order.status}
            labelMap={ORDER_STATUS_LABELS}
          />
        ) : (
          '-'
        ),
    },
    {
      key: 'phone',
      header: '号码',
      render: (sms) => (
        <>
          {sms.order?.phoneResource?.phone || '-'}
          {sms.order?.phoneResource?.country ? (
            <span className="table-meta">
              {' '}
              ({getCountryLabel(sms.order.phoneResource.country)})
            </span>
          ) : null}
        </>
      ),
    },
    {
      key: 'code',
      header: '验证码',
      render: (sms) => sms.code || '-',
    },
    {
      key: 'content',
      header: '短信内容',
      render: (sms) => truncateText(sms.content),
    },
    {
      key: 'status',
      header: '短信状态',
      render: (sms) => (
        <StatusBadge status={sms.status} labelMap={SMS_STATUS_LABELS} />
      ),
    },
    {
      key: 'receivedAt',
      header: '接收时间',
      render: (sms) => formatDate(sms.receivedAt),
    },
    {
      key: 'createdAt',
      header: '创建时间',
      render: (sms) => formatDate(sms.createdAt),
    },
    {
      key: 'actions',
      header: '操作',
      render: (sms) => (
        <button
          className="text-button"
          type="button"
          onClick={() => setDetailTarget(sms)}
        >
          查看内容
        </button>
      ),
    },
  ]

  return (
    <div className="manage-page">
      <PageHeader
        title="短信记录"
        subtitle="查看订单短信记录，支持按公司与号码筛选。"
        actions={
          <button
            className="secondary-button"
            type="button"
            onClick={() => loadSmsList(filters, page, pageSize)}
          >
            刷新
          </button>
        }
      />

      <TableToolbar
        actions={
          <>
            <button
              className="secondary-button"
              type="button"
              onClick={handleResetFilters}
            >
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
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                companyId: event.target.value,
              }))
            }
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
          <span>订单状态</span>
          <select
            value={filters.orderStatus}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                orderStatus: event.target.value,
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
          <span>号码关键字</span>
          <input
            value={filters.phone}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                phone: event.target.value,
              }))
            }
            placeholder="支持模糊匹配"
          />
        </label>

        <label>
          <span>验证码</span>
          <input
            value={filters.code}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                code: event.target.value,
              }))
            }
            placeholder="支持模糊匹配"
          />
        </label>

        <label>
          <span>短信状态</span>
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
            {Object.entries(SMS_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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

      {error ? <div className="page-error">{error}</div> : null}

      <DataTable
        columns={smsColumns}
        rows={smsList}
        loading={loading}
        emptyText="暂无短信记录"
        rowKey={(sms) => sms.id}
      />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {detailTarget ? (
        <div className="modal-mask">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>短信详情</h3>
                <p>短信 {detailTarget.id.slice(0, 8)}...</p>
              </div>

              <button
                className="modal-close"
                type="button"
                onClick={() => setDetailTarget(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-form">
              <label>
                <span>订单 ID</span>
                <input value={detailTarget.orderId} readOnly />
              </label>

              <label>
                <span>验证码</span>
                <input value={detailTarget.code || '-'} readOnly />
              </label>

              <label>
                <span>短信内容</span>
                <textarea
                  value={detailTarget.content || '-'}
                  readOnly
                  rows={5}
                />
              </label>

              <label>
                <span>接收时间</span>
                <input value={formatDate(detailTarget.receivedAt)} readOnly />
              </label>
            </div>

            <div className="modal-footer">
              <button
                className="primary-button"
                type="button"
                onClick={() => setDetailTarget(null)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
