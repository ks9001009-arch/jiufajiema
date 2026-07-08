import { useEffect, useState } from 'react'
import { getTeams } from '../api/http'
import type { Team } from '../api/http'

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

function getCompanyName(team: Team) {
  return team.company?.name || team.companyId || '-'
}

export function TeamPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadTeams() {
    setLoading(true)
    setError('')

    try {
      const result = await getTeams()
      setTeams(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载团队列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTeams()
  }, [])

  return (
    <div className="manage-page">
      <div className="page-header">
        <div>
          <h2>团队管理</h2>
          <p>管理公司下的业务团队，当前页面已经接入后端团队列表接口。</p>
        </div>

        <div className="page-actions">
          <button className="secondary-button" type="button" onClick={loadTeams}>
            刷新
          </button>

          <button className="primary-button" type="button">
            新增团队
          </button>
        </div>
      </div>

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>团队列表</strong>
          <span>
            {loading
              ? '正在加载...'
              : `共 ${teams.length} 条团队记录`}
          </span>
        </div>

        {error ? <div className="table-error">{error}</div> : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>团队名称</th>
              <th>所属公司</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>正在加载团队列表...</td>
              </tr>
            ) : teams.length > 0 ? (
              teams.map((team) => (
                <tr key={team.id}>
                  <td>{team.name}</td>
                  <td>{getCompanyName(team)}</td>
                  <td>{formatDate(team.createdAt)}</td>
                  <td>
                    <button className="text-button" type="button">
                      编辑
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>暂无团队数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
