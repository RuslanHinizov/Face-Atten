import { useState, useMemo, useCallback } from 'react'
import { CameraTile, type Camera } from './CameraTile'
import { LayoutSelector, type GridLayout } from './LayoutSelector'
import { GridPagination } from './GridPagination'
import { ExpandedView } from './ExpandedView'
import { useGridPreferences } from '../hooks/useGridPreferences'
import {
  calculatePagination,
  getCamerasForPage,
  shouldShowPagination,
} from '../utils/gridUtils'
import { Video, AlertCircle } from 'lucide-react'

export interface CameraGridProps {
  cameras: Camera[]
  onCameraClick?: (camera: Camera) => void
  onCameraEdit?: (camera: Camera) => void
  selectedCameraId?: string | null
}

/**
 * CameraGrid - Professional camera grid with sharp edges and tight layout
 * 
 * Features:
 * - Sharp-edged, no-gap grid layout
 * - Configurable grid layouts (2x2, 3x3, 4x4, etc.)
 * - Clean camera tiles - info shows on hover
 * - Pagination for cameras exceeding layout capacity
 * - Expanded view modal for focused camera viewing
 */
export function CameraGrid({ cameras, onCameraClick, onCameraEdit, selectedCameraId }: CameraGridProps) {
  const [layout, setLayout] = useGridPreferences()
  const [currentPage, setCurrentPage] = useState(0)
  const [expandedCameraId, setExpandedCameraId] = useState<string | null>(null)

  // Calculate pagination based on current layout
  const { totalPages, camerasPerPage } = useMemo(
    () => calculatePagination(cameras.length, layout),
    [cameras.length, layout]
  )

  // Get cameras for current page
  const visibleCameras = useMemo(
    () => getCamerasForPage(cameras, currentPage, camerasPerPage),
    [cameras, currentPage, camerasPerPage]
  )

  // Check if pagination should be shown
  const showPagination = shouldShowPagination(cameras.length, layout)

  // Find expanded camera and its index
  const expandedCamera = useMemo(
    () => expandedCameraId ? cameras.find(c => c.id === expandedCameraId) : null,
    [cameras, expandedCameraId]
  )

  const expandedCameraIndex = useMemo(
    () => expandedCameraId ? cameras.findIndex(c => c.id === expandedCameraId) : -1,
    [cameras, expandedCameraId]
  )

  // Handle camera tile click - select camera
  const handleCameraClick = useCallback((camera: Camera) => {
    onCameraClick?.(camera)
  }, [onCameraClick])

  // Handle maximize click
  const handleMaximize = useCallback((camera: Camera) => {
    setExpandedCameraId(camera.id)
  }, [])

  // Handle expanded view close
  const handleExpandedClose = useCallback(() => {
    setExpandedCameraId(null)
  }, [])

  // Handle navigation in expanded view (circular navigation)
  const handleExpandedNavigate = useCallback((direction: 'prev' | 'next') => {
    if (cameras.length <= 1) return

    const currentIdx = cameras.findIndex(c => c.id === expandedCameraId)
    if (currentIdx === -1) return

    let newIndex: number
    if (direction === 'next') {
      newIndex = (currentIdx + 1) % cameras.length
    } else {
      newIndex = (currentIdx - 1 + cameras.length) % cameras.length
    }

    setExpandedCameraId(cameras[newIndex].id)
  }, [cameras, expandedCameraId])

  // Reset to first page when layout changes if current page would be out of bounds
  const handleLayoutChange = (newLayout: GridLayout) => {
    setLayout(newLayout)
    const newPagination = calculatePagination(cameras.length, newLayout)
    if (currentPage >= newPagination.totalPages) {
      setCurrentPage(0)
    }
  }

  // Get grid columns based on layout
  const getGridCols = () => {
    switch (layout) {
      case '2x2': return 'grid-cols-1 sm:grid-cols-2'
      case '3x3': return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      case '4x4': return 'grid-cols-2 lg:grid-cols-4'
      case '5x5': return 'grid-cols-2 lg:grid-cols-5'
      case '6x6': return 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
      case '8x8': return 'grid-cols-2 lg:grid-cols-4 xl:grid-cols-8'
      case '10x10': return 'grid-cols-2 lg:grid-cols-5 xl:grid-cols-10'
      case '16x16': return 'grid-cols-4 lg:grid-cols-8 xl:grid-cols-16'
      default: return 'grid-cols-2 lg:grid-cols-4'
    }
  }

  // Empty state
  if (cameras.length === 0) {
    return (
      <div
        data-testid="camera-grid-empty"
        className="flex flex-col items-center justify-center min-h-[400px] bg-slate-900"
      >
        <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4">
          <AlertCircle className="w-10 h-10 text-slate-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-400 mb-2">Камералар табылмады</h3>
        <p className="text-slate-500 text-sm text-center max-w-xs">
          Қосылған камералар жоқ. Камера баптауларын тексеріңіз.
        </p>
      </div>
    )
  }

  return (
    <div
      data-testid="camera-grid"
      data-layout={layout}
      data-page={currentPage}
      data-total-pages={totalPages}
      className="flex flex-col h-full"
    >
      {/* Header with Layout Selector */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Камералар</h2>
            <p className="text-sm text-slate-400">
              {cameras.length} камера қосылған
            </p>
          </div>
        </div>

        <LayoutSelector
          currentLayout={layout}
          onLayoutChange={handleLayoutChange}
        />
      </div>

      {/* Camera Grid - Sharp edges, no gaps, professional look */}
      <div className="flex-1 overflow-hidden rounded-lg border border-slate-800">
        <div
          data-testid="camera-grid-container"
          className={`grid ${getGridCols()} gap-[1px] bg-slate-800 h-full`}
        >
          {visibleCameras.map((camera) => (
            <CameraTile
              key={camera.id}
              camera={camera}
              onClick={() => handleCameraClick(camera)}
              onMaximize={() => handleMaximize(camera)}
              onEdit={() => onCameraEdit?.(camera)}
              isSelected={selectedCameraId === camera.id}
            />
          ))}
        </div>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="mt-4 flex-shrink-0">
          <GridPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Expanded View Modal */}
      {expandedCamera && (
        <ExpandedView
          camera={expandedCamera}
          cameras={cameras}
          currentIndex={expandedCameraIndex}
          onClose={handleExpandedClose}
          onNavigate={handleExpandedNavigate}
        />
      )}
    </div>
  )
}
