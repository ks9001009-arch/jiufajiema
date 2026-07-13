import type { ReactNode } from 'react'

export type DataTableColumn<Row> = {
  key: string
  header: ReactNode
  render: (row: Row) => ReactNode
  className?: string
}

export type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  loading?: boolean
  loadingText?: string
  emptyText?: string
  className?: string
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  loading = false,
  loadingText = '正在加载...',
  emptyText = '暂无数据',
  className,
}: DataTableProps<Row>) {
  const wrapperClassName = ['data-table-wrapper', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={wrapperClassName}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.className}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="data-table-loading">
                {loadingText}
              </td>
            </tr>
          ) : rows.length > 0 ? (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} className={column.className}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="data-table-empty">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
