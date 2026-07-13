const DEFAULT_LABEL_MAP: Record<string, string> = {
  ACTIVE: '启用',
  AVAILABLE: '可用',
  LOCKED: '锁定',
  USED: '已使用',
  EXPIRED: '已过期',
  DISABLED: '禁用',
  PENDING: '待处理',
  WAIT_SMS: '等待短信',
  SUCCESS: '成功',
  FAILED: '失败',
  CANCELLED: '已取消',
}

type StatusBadgeProps = {
  status: string
  labelMap?: Record<string, string>
}

function resolveLabel(status: string, labelMap: Record<string, string>) {
  if (!status) {
    return '-'
  }

  return labelMap[status] ?? labelMap[status.toUpperCase()] ?? status
}

function resolveClassName(status: string) {
  if (!status) {
    return 'status-badge status-badge-disabled'
  }

  const normalized = status.toUpperCase()

  if (normalized === 'ACTIVE' || normalized === 'AVAILABLE') {
    return 'status-badge status-badge-active'
  }

  if (normalized === 'LOCKED' || normalized === 'WAIT_SMS') {
    return 'status-badge status-badge-locked'
  }

  if (normalized === 'USED') {
    return 'status-badge status-badge-used'
  }

  if (normalized === 'SUCCESS') {
    return 'status-badge status-badge-active'
  }

  if (normalized === 'FAILED') {
    return 'status-badge status-badge-failed'
  }

  if (normalized === 'EXPIRED' || normalized === 'DISABLED' || normalized === 'CANCELLED' || normalized === 'PENDING') {
    return 'status-badge status-badge-disabled'
  }

  return 'status-badge'
}

export function StatusBadge({ status, labelMap }: StatusBadgeProps) {
  const mergedLabelMap = { ...DEFAULT_LABEL_MAP, ...labelMap }

  return (
    <span className={resolveClassName(status)}>
      {resolveLabel(status, mergedLabelMap)}
    </span>
  )
}
