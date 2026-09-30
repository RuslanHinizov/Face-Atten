import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface GridPaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

/**
 * GridPagination - Standalone pagination component for camera grid
 * 
 * Displays page numbers and navigation arrows for navigating between camera pages.
 * Integrates with CameraGrid component.
 * 
 * Requirements: 2.3
 */
export function GridPagination({ currentPage, totalPages, onPageChange }: GridPaginationProps) {
  const canGoPrev = currentPage > 0
  const canGoNext = currentPage < totalPages - 1

  // Don't render if only one page
  if (totalPages <= 1) {
    return null
  }

  // Calculate visible page range for large page counts
  const getVisiblePages = (): number[] => {
    const maxVisible = 5
    const pages: number[] = []
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 0; i < totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Show pages around current page
      let start = Math.max(0, currentPage - Math.floor(maxVisible / 2))
      const end = Math.min(totalPages - 1, start + maxVisible - 1)
      
      // Adjust start if we're near the end
      if (end - start < maxVisible - 1) {
        start = Math.max(0, end - maxVisible + 1)
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
    }
    
    return pages
  }

  const visiblePages = getVisiblePages()

  return (
    <nav 
      data-testid="grid-pagination"
      className="flex items-center justify-center gap-2"
      role="navigation"
      aria-label="Камера беттері"
    >
      {/* Previous Button */}
      <button
        data-testid="pagination-prev"
        onClick={() => canGoPrev && onPageChange(currentPage - 1)}
        disabled={!canGoPrev}
        className={`
          group flex items-center justify-center w-10 h-10 rounded-xl
          transition-all duration-200 ease-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
          ${canGoPrev 
            ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer border border-slate-700/50 hover:border-slate-600' 
            : 'bg-slate-800/30 text-slate-600 cursor-not-allowed border border-slate-800/50'
          }
        `}
        aria-label="Алдыңғы бет"
        aria-disabled={!canGoPrev}
      >
        <ChevronLeft className={`w-5 h-5 transition-transform ${canGoPrev ? 'group-hover:-translate-x-0.5' : ''}`} />
      </button>

      {/* Page Numbers */}
      <div className="flex items-center gap-1.5 px-2">
        {/* First page indicator if not visible */}
        {visiblePages[0] > 0 && (
          <>
            <button
              data-testid="pagination-page-0"
              onClick={() => onPageChange(0)}
              className="flex items-center justify-center min-w-[40px] h-10 px-3 rounded-xl
                font-medium text-sm transition-all duration-200 ease-out
                bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white
                border border-slate-700/50 hover:border-slate-600
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="1-бет"
            >
              1
            </button>
            {visiblePages[0] > 1 && (
              <span className="text-slate-500 px-1">...</span>
            )}
          </>
        )}

        {/* Visible page buttons */}
        {visiblePages.map((pageIndex) => (
          <button
            key={pageIndex}
            data-testid={`pagination-page-${pageIndex}`}
            onClick={() => onPageChange(pageIndex)}
            className={`
              relative flex items-center justify-center min-w-[40px] h-10 px-3 rounded-xl
              font-medium text-sm transition-all duration-200 ease-out
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
              ${currentPage === pageIndex
                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 border border-blue-400/30'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 hover:border-slate-600'
              }
            `}
            aria-label={`${pageIndex + 1}-бет`}
            aria-current={currentPage === pageIndex ? 'page' : undefined}
          >
            {pageIndex + 1}
            {/* Active indicator glow */}
            {currentPage === pageIndex && (
              <div className="absolute inset-0 rounded-xl bg-blue-400/20 blur-sm -z-10" />
            )}
          </button>
        ))}

        {/* Last page indicator if not visible */}
        {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
          <>
            {visiblePages[visiblePages.length - 1] < totalPages - 2 && (
              <span className="text-slate-500 px-1">...</span>
            )}
            <button
              data-testid={`pagination-page-${totalPages - 1}`}
              onClick={() => onPageChange(totalPages - 1)}
              className="flex items-center justify-center min-w-[40px] h-10 px-3 rounded-xl
                font-medium text-sm transition-all duration-200 ease-out
                bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white
                border border-slate-700/50 hover:border-slate-600
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`${totalPages}-бет`}
            >
              {totalPages}
            </button>
          </>
        )}
      </div>

      {/* Next Button */}
      <button
        data-testid="pagination-next"
        onClick={() => canGoNext && onPageChange(currentPage + 1)}
        disabled={!canGoNext}
        className={`
          group flex items-center justify-center w-10 h-10 rounded-xl
          transition-all duration-200 ease-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
          ${canGoNext 
            ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer border border-slate-700/50 hover:border-slate-600' 
            : 'bg-slate-800/30 text-slate-600 cursor-not-allowed border border-slate-800/50'
          }
        `}
        aria-label="Келесі бет"
        aria-disabled={!canGoNext}
      >
        <ChevronRight className={`w-5 h-5 transition-transform ${canGoNext ? 'group-hover:translate-x-0.5' : ''}`} />
      </button>

      {/* Page info text */}
      <div className="ml-3 text-sm text-slate-500">
        <span className="text-slate-300 font-medium">{currentPage + 1}</span>
        <span className="mx-1">/</span>
        <span>{totalPages}</span>
      </div>
    </nav>
  )
}
