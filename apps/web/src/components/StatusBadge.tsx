const DEFAULT_LABEL_MAP: Record<string, string> = {
  ACTIVE: '启用',
  DISABLED: '禁用',
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

  if (normalized === 'ACTIVE') {
    return 'status-badge status-badge-active'
  }

  if (normalized === 'DISABLED') {
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
