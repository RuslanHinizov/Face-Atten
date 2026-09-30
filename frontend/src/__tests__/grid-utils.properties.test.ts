/**
 * Feature: camera-preview-grid
 * Property 4: Pagination Visibility
 * Validates: Requirements 2.3
 * 
 * Property 4: For any camera count greater than the current layout's capacity,
 * the Camera_Grid SHALL display pagination controls.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  GRID_CONFIGS,
  calculatePagination,
  getCamerasForPage,
  shouldShowPagination,
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

// Arbitrary for camera arrays
const cameraArrayArb = fc.array(cameraArb, { minLength: 0, maxLength: 30 })

describe('Property 4: Pagination Visibility', () => {
  /**
   * Feature: camera-preview-grid, Property 4: Pagination Visibility
   * For any camera count greater than the current layout's capacity,
   * shouldShowPagination SHALL return true
   */
  it('should show pagination when camera count exceeds layout capacity', () => {
    fc.assert(
      fc.property(gridLayoutArb, fc.integer({ min: 1, max: 50 }), (layout, cameraCount) => {
        const config = GRID_CONFIGS[layout]
        const shouldShow = shouldShowPagination(cameraCount, layout)
        
        if (cameraCount > config.total) {
          expect(shouldShow).toBe(true)
        } else {
          expect(shouldShow).toBe(false)
        }
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should not show pagination when camera count is within layout capacity', () => {
    fc.assert(
      fc.property(gridLayoutArb, (layout) => {
        const config = GRID_CONFIGS[layout]
        
        // Test with exactly the capacity
        expect(shouldShowPagination(config.total, layout)).toBe(false)
        
        // Test with less than capacity
        expect(shouldShowPagination(config.total - 1, layout)).toBe(false)
        
        // Test with zero cameras
        expect(shouldShowPagination(0, layout)).toBe(false)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should calculate correct total pages for any camera count and layout', () => {
    fc.assert(
      fc.property(gridLayoutArb, fc.integer({ min: 0, max: 50 }), (layout, cameraCount) => {
        const { totalPages, camerasPerPage } = calculatePagination(cameraCount, layout)
        const config = GRID_CONFIGS[layout]
        
        // camerasPerPage should match layout capacity
        expect(camerasPerPage).toBe(config.total)
        
        // totalPages should be at least 1
        expect(totalPages).toBeGreaterThanOrEqual(1)
        
        // totalPages should be correct ceiling division
        if (cameraCount > 0) {
          expect(totalPages).toBe(Math.ceil(cameraCount / config.total))
        } else {
          expect(totalPages).toBe(1)
        }
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should return correct cameras for each page', () => {
    fc.assert(
      fc.property(cameraArrayArb, gridLayoutArb, (cameras, layout) => {
        const { totalPages, camerasPerPage } = calculatePagination(cameras.length, layout)
        
        // Collect all cameras from all pages
        const allPagedCameras: Camera[] = []
        for (let page = 0; page < totalPages; page++) {
          const pageCameras = getCamerasForPage(cameras, page, camerasPerPage)
          allPagedCameras.push(...pageCameras)
        }
        
        // All original cameras should be accessible through pagination
        expect(allPagedCameras.length).toBe(cameras.length)
        
        // Each camera should appear exactly once
        cameras.forEach((camera, index) => {
          expect(allPagedCameras[index]).toEqual(camera)
        })
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should return at most camerasPerPage cameras for any page', () => {
    fc.assert(
      fc.property(
        cameraArrayArb,
        gridLayoutArb,
        fc.integer({ min: 0, max: 10 }),
        (cameras, layout, pageOffset) => {
          const { camerasPerPage } = calculatePagination(cameras.length, layout)
          const page = pageOffset % Math.max(1, Math.ceil(cameras.length / camerasPerPage))
          
          const pageCameras = getCamerasForPage(cameras, page, camerasPerPage)
          
          // Should never exceed camerasPerPage
          expect(pageCameras.length).toBeLessThanOrEqual(camerasPerPage)
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should have consistent grid configs for all layouts', () => {
    fc.assert(
      fc.property(gridLayoutArb, (layout) => {
        const config = GRID_CONFIGS[layout]
        
        // Config should have valid structure
        expect(config.cols).toBeGreaterThan(0)
        expect(config.rows).toBeGreaterThan(0)
        expect(config.total).toBe(config.cols * config.rows)
        
        // Verify specific layout values
        if (layout === '2x2') {
          expect(config.cols).toBe(2)
          expect(config.rows).toBe(2)
          expect(config.total).toBe(4)
        } else if (layout === '3x3') {
          expect(config.cols).toBe(3)
          expect(config.rows).toBe(3)
          expect(config.total).toBe(9)
        } else if (layout === '4x4') {
          expect(config.cols).toBe(4)
          expect(config.rows).toBe(4)
          expect(config.total).toBe(16)
        }
        
        return true
      }),
      { numRuns: 100 }
    )
  })
})
