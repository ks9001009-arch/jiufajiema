type PaginationProps = {
  page: number
  pageSize: number
  total: number
  totalPages: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  disabled?: boolean
}

const DEFAULT_PAGE_SIZE_OPTIONS = [20, 50, 100]

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}: PaginationProps) {
  const isEmpty = total === 0
  const isPreviousDisabled = disabled || isEmpty || page <= 1
  const isNextDisabled = disabled || isEmpty || page >= totalPages

  function handlePreviousPage() {
    if (isPreviousDisabled) {
      return
    }

    const nextPage = page - 1

    if (nextPage < 1) {
      return
    }

    onPageChange(nextPage)
  }

  function handleNextPage() {
    if (isNextDisabled) {
      return
    }

    const nextPage = page + 1

    if (nextPage > totalPages) {
      return
    }

    onPageChange(nextPage)
  }

  function handlePageSizeChange(nextPageSize: number) {
    if (disabled || !pageSizeOptions.includes(nextPageSize)) {
      return
    }

    onPageSizeChange(nextPageSize)
  }

  return (
    <div className="pagination-bar">
      <span className="pagination-summary">共 {total} 条记录</span>

      <div className="pagination-controls">
        <button
          className="secondary-button"
          type="button"
          onClick={handlePreviousPage}
          disabled={isPreviousDisabled}
        >
          上一页
        </button>

        <span className="pagination-status">
          {isEmpty ? '第 0 / 0 页' : `第 ${page} / ${totalPages} 页`}
        </span>

        <button
          className="secondary-button"
          type="button"
          onClick={handleNextPage}
          disabled={isNextDisabled}
        >
          下一页
        </button>

        <select
          className="pagination-size"
          value={pageSize}
          onChange={(event) => handlePageSizeChange(Number(event.target.value))}
          disabled={disabled}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              每页 {option} 条
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
