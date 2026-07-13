import type { ReactNode } from 'react'

type TableToolbarProps = {
  children: ReactNode
  actions?: ReactNode
  className?: string
}

export function TableToolbar({
  children,
  actions,
  className,
}: TableToolbarProps) {
  const rootClassName = ['panel-card', 'table-toolbar', className]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={rootClassName}>
      <div className="table-toolbar-fields">{children}</div>
      {actions ? <div className="table-toolbar-actions">{actions}</div> : null}
    </section>
  )
}
