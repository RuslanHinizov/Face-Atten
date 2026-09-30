import type { Camera } from '../components/CameraTile'

export type GridLayout = '2x2' | '3x3' | '4x4' | '5x5' | '6x6' | '8x8' | '10x10' | '16x16'

export interface GridConfig {
  cols: number
  rows: number
  total: number
}

export interface PaginationResult {
  totalPages: number
  camerasPerPage: number
}

/**
 * Grid configuration constants for each layout type
 */
export const GRID_CONFIGS: Record<GridLayout, GridConfig> = {
  '2x2': { cols: 2, rows: 2, total: 4 },
  '3x3': { cols: 3, rows: 3, total: 9 },
  '4x4': { cols: 4, rows: 4, total: 16 },
  '5x5': { cols: 5, rows: 5, total: 25 },
  '6x6': { cols: 6, rows: 6, total: 36 },
  '8x8': { cols: 8, rows: 8, total: 64 },
  '10x10': { cols: 10, rows: 10, total: 100 },
  '16x16': { cols: 16, rows: 16, total: 256 }
}

/**
 * Calculates pagination information based on total cameras and selected layout
 * 
 * @param totalCameras - Total number of cameras available
 * @param layout - Selected grid layout
 * @returns Pagination result with total pages and cameras per page
 * 
 * Requirements: 2.3
 */
export function calculatePagination(
  totalCameras: number,
  layout: GridLayout
): PaginationResult {
  const config = GRID_CONFIGS[layout]
  const camerasPerPage = config.total
  const totalPages = totalCameras > 0 ? Math.ceil(totalCameras / camerasPerPage) : 1

  return { totalPages, camerasPerPage }
}

/**
 * Gets the cameras for a specific page based on pagination
 * 
 * @param cameras - Array of all cameras
 * @param page - Current page number (0-indexed)
 * @param camerasPerPage - Number of cameras per page
 * @returns Array of cameras for the specified page
 * 
 * Requirements: 2.3
 */
export function getCamerasForPage(
  cameras: Camera[],
  page: number,
  camerasPerPage: number
): Camera[] {
  const start = page * camerasPerPage
  return cameras.slice(start, start + camerasPerPage)
}

/**
 * Checks if pagination controls should be visible
 * 
 * @param totalCameras - Total number of cameras
 * @param layout - Selected grid layout
 * @returns True if pagination should be shown
 * 
 * Requirements: 2.3
 */
export function shouldShowPagination(
  totalCameras: number,
  layout: GridLayout
): boolean {
  const config = GRID_CONFIGS[layout]
  return totalCameras > config.total
}

/**
 * Gets the Tailwind CSS grid class for a layout
 * 
 * @param layout - Selected grid layout
 * @returns Tailwind grid-cols class string
 */
export function getGridColsClass(layout: GridLayout): string {
  const config = GRID_CONFIGS[layout]
  return `grid-cols-${config.cols}`
}

/**
 * Gets responsive Tailwind CSS grid classes based on selected layout
 * 
 * Responsive breakpoints:
 * - < 768px (mobile): single column
 * - 768px - 1024px (tablet): maximum 2x2
 * - > 1024px (desktop): selected layout
 * 
 * @param layout - Selected grid layout
 * @returns Responsive Tailwind grid classes string
 * 
 * Requirements: 5.1, 5.2
 */
export function getResponsiveGridClasses(layout: GridLayout): string {
  const config = GRID_CONFIGS[layout]

  if (config.cols === 2) {
    return 'grid-cols-1 md:grid-cols-2'
  } else if (config.cols === 3) {
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  } else if (config.cols === 4) {
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  } else if (config.cols === 5) {
    return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
  } else if (config.cols === 6) {
    return 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6'
  } else if (config.cols === 8) {
    return 'grid-cols-3 md:grid-cols-4 lg:grid-cols-8'
  } else if (config.cols === 10) {
    return 'grid-cols-4 md:grid-cols-5 lg:grid-cols-10'
  } else {
    // 16x16 or others
    return `grid-cols-4 md:grid-cols-8 lg:grid-cols-${config.cols}`
  }
}
