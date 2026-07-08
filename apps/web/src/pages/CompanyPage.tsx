import { useEffect, useState } from 'react'
import { getCompanies } from '../api/http'
import type { Company } from '../api/http'

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

function getStatusText(status: Company['status']) {
  if (status === 'ACTIVE') {
    return '启用'
  }

  if (status === 'DISABLED') {
    return '停用'
  }

  return status
}

export function CompanyPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadCompanies() {
    setLoading(true)
    setError('')

    try {
      const result = await getCompanies()
      setCompanies(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载公司列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCompanies()
  }, [])

  return (
    <div className="manage-page">
      <div className="page-header">
        <div>
          <h2>公司管理</h2>
          <p>管理平台内的公司主体，当前页面已经接入后端公司列表接口。</p>
        </div>

        <div className="page-actions">
          <button className="secondary-button" type="button" onClick={loadCompanies}>
            刷新
          </button>

          <button className="primary-button" type="button">
            新增公司
          </button>
        </div>
      </div>

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>公司列表</strong>
          <span>
            {loading
              ? '正在加载...'
              : `共 ${companies.length} 条公司记录`}
          </span>
        </div>

        {error ? <div className="table-error">{error}</div> : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>公司名称</th>
              <th>公司编码</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>正在加载公司列表...</td>
              </tr>
            ) : companies.length > 0 ? (
              companies.map((company) => (
                <tr key={company.id}>
                  <td>{company.name}</td>
                  <td>{company.code}</td>
                  <td>
                    <span className={`status-badge ${company.status.toLowerCase()}`}>
                      {getStatusText(company.status)}
                    </span>
                  </td>
                  <td>{formatDate(company.createdAt)}</td>
                  <td>
                    <button className="text-button" type="button">
                      编辑
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>暂无公司数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
