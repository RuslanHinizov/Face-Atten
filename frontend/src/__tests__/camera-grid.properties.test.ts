/**
 * Feature: camera-preview-grid
 * Property 1: Camera Rendering Completeness
 * Property 3: Layout Reorganization
 * Validates: Requirements 1.1, 1.2, 2.2
 * 
 * Property 1: For any list of cameras and selected grid layout, the Camera_Grid SHALL render
 * exactly the number of Camera_Tiles equal to the minimum of (cameras on current page, layout capacity).
 * 
 * Property 3: For any layout selection, the Camera_Grid SHALL reorganize to display cameras
 * in a grid with columns equal to the layout's column count (2, 3, or 4).
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  GRID_CONFIGS,
  calculatePagination,
  getCamerasForPage,
  type GridLayout
} from '../utils/gridUtils'
import type { Camera, CameraStatus } from '../components/CameraTile'

// Arbitrary for grid layouts
const gridLayoutArb = fc.constantFrom<GridLayout>('2x2', '3x3', '4x4')

// Arbitrary for camera status
const cameraStatusArb = fc.constantFrom<CameraStatus>('connected', 'disconnected', 'connecting')

// Arbitrary for generating valid cameras
const cameraArb: fc.Arbitrary<Camera> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  location: fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { nil: undefined }),
  status: cameraStatusArb,
  streamUrl: fc.option(fc.webUrl(), { nil: undefined })
})

// Arbitrary for camera arrays with various sizes
const cameraArrayArb = fc.array(cameraArb, { minLength: 0, maxLength: 30 })

// Arbitrary for page numbers
const pageNumberArb = fc.integer({ min: 0, max: 10 })

/**
 * Helper function to calculate expected visible cameras count
 * This simulates what CameraGrid should render
 */
function calculateExpectedVisibleCameras(
  cameras: Camera[],
  layout: GridLayout,
  currentPage: number
): number {
  const config = GRID_CONFIGS[layout]
  const camerasPerPage = config.total
  const totalPages = cameras.length > 0 ? Math.ceil(cameras.length / camerasPerPage) : 1
  
  // Clamp page to valid range
  const validPage = Math.min(Math.max(0, currentPage), totalPages - 1)
  
  // Get cameras for this page
  const pageCameras = getCamerasForPage(cameras, validPage, camerasPerPage)
  
  // Return the minimum of cameras on page and layout capacity
  return Math.min(pageCameras.length, config.total)
}

/**
 * Helper function to get expected grid columns for a layout
 */
function getExpectedGridColumns(layout: GridLayout): number {
  return GRID_CONFIGS[layout].cols
}

describe('Property 1: Camera Rendering Completeness', () => {
  /**
   * Feature: camera-preview-grid, Property 1: Camera Rendering Completeness
   * For any list of cameras and selected grid layout, the Camera_Grid SHALL render
   * exactly the number of Camera_Tiles equal to the minimum of (cameras on current page, layout capacity).
   */
  it('should render correct number of cameras for first page', () => {
    fc.assert(
      fc.property(cameraArrayArb, gridLayoutArb, (cameras, layout) => {
        const config = GRID_CONFIGS[layout]
        const expectedCount = calculateExpectedVisibleCameras(cameras, layout, 0)
        
        // Expected count should be min(cameras.length, layout capacity)
        const actualExpected = Math.min(cameras.length, config.total)
        expect(expectedCount).toBe(actualExpected)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should render correct number of cameras for any valid page', () => {
    fc.assert(
      fc.property(cameraArrayArb, gridLayoutArb, pageNumberArb, (cameras, layout, page) => {
        const { totalPages, camerasPerPage } = calculatePagination(cameras.length, layout)
        
        // Clamp page to valid range
        const validPage = Math.min(Math.max(0, page), Math.max(0, totalPages - 1))
        
        const pageCameras = getCamerasForPage(cameras, validPage, camerasPerPage)
        const expectedCount = calculateExpectedVisibleCameras(cameras, layout, validPage)
        
        // Rendered count should equal cameras on this page (up to layout capacity)
        expect(expectedCount).toBe(pageCameras.length)
        expect(expectedCount).toBeLessThanOrEqual(GRID_CONFIGS[layout].total)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should never render more cameras than layout capacity', () => {
    fc.assert(
      fc.property(cameraArrayArb, gridLayoutArb, pageNumberArb, (cameras, layout, page) => {
        const config = GRID_CONFIGS[layout]
        const expectedCount = calculateExpectedVisibleCameras(cameras, layout, page)
        
        // Should never exceed layout capacity
        expect(expectedCount).toBeLessThanOrEqual(config.total)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should render zero cameras when camera list is empty', () => {
    fc.assert(
      fc.property(gridLayoutArb, pageNumberArb, (layout, page) => {
        const emptyCameras: Camera[] = []
        const expectedCount = calculateExpectedVisibleCameras(emptyCameras, layout, page)
        
        expect(expectedCount).toBe(0)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should render all cameras when count is less than layout capacity', () => {
    fc.assert(
      fc.property(gridLayoutArb, (layout) => {
        const config = GRID_CONFIGS[layout]
        
        // Generate cameras less than capacity
        const cameraCount = Math.max(0, config.total - 1)
        const cameras: Camera[] = Array.from({ length: cameraCount }, (_, i) => ({
          id: `camera-${i}`,
          name: `Camera ${i}`,
          status: 'connected' as CameraStatus
        }))
        
        const expectedCount = calculateExpectedVisibleCameras(cameras, layout, 0)
        
        // Should render all cameras since count < capacity
        expect(expectedCount).toBe(cameraCount)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should render exactly layout capacity when cameras exceed it on first page', () => {
    fc.assert(
      fc.property(gridLayoutArb, fc.integer({ min: 1, max: 20 }), (layout, extraCameras) => {
        const config = GRID_CONFIGS[layout]
        const totalCameras = config.total + extraCameras
        
        const cameras: Camera[] = Array.from({ length: totalCameras }, (_, i) => ({
          id: `camera-${i}`,
          name: `Camera ${i}`,
          status: 'connected' as CameraStatus
        }))
        
        const expectedCount = calculateExpectedVisibleCameras(cameras, layout, 0)
        
        // First page should show exactly layout capacity
        expect(expectedCount).toBe(config.total)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should render remaining cameras on last page', () => {
    fc.assert(
      fc.property(gridLayoutArb, fc.integer({ min: 1, max: 15 }), (layout, extraCameras) => {
        const config = GRID_CONFIGS[layout]
        const totalCameras = config.total + extraCameras
        
        const cameras: Camera[] = Array.from({ length: totalCameras }, (_, i) => ({
          id: `camera-${i}`,
          name: `Camera ${i}`,
          status: 'connected' as CameraStatus
        }))
        
        const { totalPages } = calculatePagination(cameras.length, layout)
        const lastPage = totalPages - 1
        const expectedCount = calculateExpectedVisibleCameras(cameras, layout, lastPage)
        
        // Last page should have remaining cameras
        const expectedRemaining = totalCameras % config.total || config.total
        expect(expectedCount).toBe(expectedRemaining)
        
        return true
      }),
      { numRuns: 100 }
    )
  })
})

describe('Property 3: Layout Reorganization', () => {
  /**
   * Feature: camera-preview-grid, Property 3: Layout Reorganization
   * For any layout selection, the Camera_Grid SHALL reorganize to display cameras
   * in a grid with columns equal to the layout's column count (2, 3, or 4).
   */
  it('should have correct column count for 2x2 layout', () => {
    const columns = getExpectedGridColumns('2x2')
    expect(columns).toBe(2)
  })

  it('should have correct column count for 3x3 layout', () => {
    const columns = getExpectedGridColumns('3x3')
    expect(columns).toBe(3)
  })

  it('should have correct column count for 4x4 layout', () => {
    const columns = getExpectedGridColumns('4x4')
    expect(columns).toBe(4)
  })

  it('should have consistent column count for all layouts', () => {
    fc.assert(
      fc.property(gridLayoutArb, (layout) => {
        const config = GRID_CONFIGS[layout]
        const expectedCols = parseInt(layout.split('x')[0])
        
        expect(config.cols).toBe(expectedCols)
        expect(getExpectedGridColumns(layout)).toBe(expectedCols)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should have matching rows and columns for square layouts', () => {
    fc.assert(
      fc.property(gridLayoutArb, (layout) => {
        const config = GRID_CONFIGS[layout]
        
        // All our layouts are square (NxN)
        expect(config.cols).toBe(config.rows)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should have total equal to cols * rows', () => {
    fc.assert(
      fc.property(gridLayoutArb, (layout) => {
        const config = GRID_CONFIGS[layout]
        
        expect(config.total).toBe(config.cols * config.rows)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should maintain layout capacity when switching layouts', () => {
    fc.assert(
      fc.property(gridLayoutArb, gridLayoutArb, cameraArrayArb, (fromLayout, toLayout, cameras) => {
        const fromConfig = GRID_CONFIGS[fromLayout]
        const toConfig = GRID_CONFIGS[toLayout]
        
        // Calculate visible cameras for both layouts on first page
        const fromVisible = calculateExpectedVisibleCameras(cameras, fromLayout, 0)
        const toVisible = calculateExpectedVisibleCameras(cameras, toLayout, 0)
        
        // Each should respect their own capacity
        expect(fromVisible).toBeLessThanOrEqual(fromConfig.total)
        expect(toVisible).toBeLessThanOrEqual(toConfig.total)
        
        // If cameras exceed both capacities, each shows their max
        if (cameras.length >= fromConfig.total && cameras.length >= toConfig.total) {
          expect(fromVisible).toBe(fromConfig.total)
          expect(toVisible).toBe(toConfig.total)
        }
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should recalculate pagination when layout changes', () => {
    fc.assert(
      fc.property(gridLayoutArb, gridLayoutArb, fc.integer({ min: 1, max: 30 }), (fromLayout, toLayout, cameraCount) => {
        const fromPagination = calculatePagination(cameraCount, fromLayout)
        const toPagination = calculatePagination(cameraCount, toLayout)
        
        const fromConfig = GRID_CONFIGS[fromLayout]
        const toConfig = GRID_CONFIGS[toLayout]
        
        // Cameras per page should match layout capacity
        expect(fromPagination.camerasPerPage).toBe(fromConfig.total)
        expect(toPagination.camerasPerPage).toBe(toConfig.total)
        
        // Total pages should be recalculated correctly
        expect(fromPagination.totalPages).toBe(Math.ceil(cameraCount / fromConfig.total))
        expect(toPagination.totalPages).toBe(Math.ceil(cameraCount / toConfig.total))
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should preserve camera order across layout changes', () => {
    fc.assert(
      fc.property(cameraArrayArb, gridLayoutArb, gridLayoutArb, (cameras, fromLayout, toLayout) => {
        // Get all cameras from all pages for both layouts
        const fromPagination = calculatePagination(cameras.length, fromLayout)
        const toPagination = calculatePagination(cameras.length, toLayout)
        
        const fromAllCameras: Camera[] = []
        const toAllCameras: Camera[] = []
        
        for (let page = 0; page < fromPagination.totalPages; page++) {
          fromAllCameras.push(...getCamerasForPage(cameras, page, fromPagination.camerasPerPage))
        }
        
        for (let page = 0; page < toPagination.totalPages; page++) {
          toAllCameras.push(...getCamerasForPage(cameras, page, toPagination.camerasPerPage))
        }
        
        // Both should contain all original cameras in same order
        expect(fromAllCameras.length).toBe(cameras.length)
        expect(toAllCameras.length).toBe(cameras.length)
        
        cameras.forEach((camera, index) => {
          expect(fromAllCameras[index]).toEqual(camera)
          expect(toAllCameras[index]).toEqual(camera)
        })
        
        return true
      }),
      { numRuns: 100 }
    )
  })
})
