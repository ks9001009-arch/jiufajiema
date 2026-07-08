import { useEffect, useState } from 'react'
import { getAuditLogs } from '../api/http'
import type { AuditLog } from '../api/http'

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

function getActorName(log: AuditLog) {
  return log.actorUser?.displayName || log.actorUser?.username || log.actorUserId || '系统'
}

function getTargetText(log: AuditLog) {
  if (log.targetType && log.targetId) {
    return `${log.targetType} / ${log.targetId}`
  }

  return log.targetType || log.targetId || '-'
}

function getActionText(action: string) {
  const map: Record<string, string> = {
    CREATE: '新增',
    UPDATE: '编辑',
    DELETE: '删除',
    LOGIN: '登录',
    LOGOUT: '退出',
  }

  return map[action] || action
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadLogs() {
    setLoading(true)
    setError('')

    try {
      const result = await getAuditLogs()
      setLogs(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载操作日志失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  return (
    <div className="manage-page">
      <div className="page-header">
        <div>
          <h2>操作日志</h2>
          <p>查看后台用户操作记录，当前页面已经接入后端操作日志接口。</p>
        </div>

        <div className="page-actions">
          <button className="secondary-button" type="button" onClick={loadLogs}>
            刷新
          </button>
        </div>
      </div>

      <section className="panel-card">
        <div className="table-toolbar">
          <strong>日志列表</strong>
          <span>
            {loading
              ? '正在加载...'
              : `共 ${logs.length} 条操作日志`}
          </span>
        </div>

        {error ? <div className="table-error">{error}</div> : null}

        <table className="data-table">
          <thead>
            <tr>
              <th>操作人</th>
              <th>动作</th>
              <th>目标</th>
              <th>IP</th>
              <th>时间</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>正在加载操作日志...</td>
              </tr>
            ) : logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{getActorName(log)}</td>
                  <td>{getActionText(log.action)}</td>
                  <td>{getTargetText(log)}</td>
                  <td>{log.ipAddress || '-'}</td>
                  <td>{formatDate(log.createdAt)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>暂无操作日志</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
