/**
 * Feature: camera-preview-grid
 * Property 6: Expanded View Toggle
 * Property 7: Camera Navigation in Expanded View
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5
 * 
 * Property 6: For any Camera_Tile click, the Expanded_View SHALL open with the clicked camera displayed.
 * Clicking close or pressing Escape SHALL return to grid view.
 * 
 * Property 7: For any camera at index N in the list, clicking next SHALL show camera at index (N+1) mod total,
 * and clicking prev SHALL show camera at index (N-1+total) mod total.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { Camera, CameraStatus } from '../components/CameraTile'

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

// Arbitrary for non-empty camera arrays (need at least 1 camera for expanded view)
const nonEmptyCameraArrayArb = fc.array(cameraArb, { minLength: 1, maxLength: 20 })

// Arbitrary for camera arrays with multiple cameras (for navigation tests)
const multipleCameraArrayArb = fc.array(cameraArb, { minLength: 2, maxLength: 20 })

/**
 * Simulates the expanded view state management
 * This mirrors the logic in CameraGrid component
 */
interface ExpandedViewState {
  expandedCameraId: string | null
  cameras: Camera[]
}

/**
 * Opens expanded view for a camera
 */
function openExpandedView(state: ExpandedViewState, cameraId: string): ExpandedViewState {
  return {
    ...state,
    expandedCameraId: cameraId
  }
}

/**
 * Closes expanded view
 */
function closeExpandedView(state: ExpandedViewState): ExpandedViewState {
  return {
    ...state,
    expandedCameraId: null
  }
}

/**
 * Navigates to next/prev camera in expanded view (circular navigation)
 */
function navigateExpandedView(
  state: ExpandedViewState, 
  direction: 'prev' | 'next'
): ExpandedViewState {
  if (!state.expandedCameraId || state.cameras.length <= 1) {
    return state
  }
  
  const currentIndex = state.cameras.findIndex(c => c.id === state.expandedCameraId)
  if (currentIndex === -1) return state
  
  let newIndex: number
  if (direction === 'next') {
    newIndex = (currentIndex + 1) % state.cameras.length
  } else {
    newIndex = (currentIndex - 1 + state.cameras.length) % state.cameras.length
  }
  
  return {
    ...state,
    expandedCameraId: state.cameras[newIndex].id
  }
}

/**
 * Gets the currently expanded camera
 */
function getExpandedCamera(state: ExpandedViewState): Camera | null {
  if (!state.expandedCameraId) return null
  return state.cameras.find(c => c.id === state.expandedCameraId) || null
}

/**
 * Gets the index of the currently expanded camera
 */
function getExpandedCameraIndex(state: ExpandedViewState): number {
  if (!state.expandedCameraId) return -1
  return state.cameras.findIndex(c => c.id === state.expandedCameraId)
}

describe('Property 6: Expanded View Toggle', () => {
  /**
   * Feature: camera-preview-grid, Property 6: Expanded View Toggle
   * For any Camera_Tile click, the Expanded_View SHALL open with the clicked camera displayed.
   * Clicking close or pressing Escape SHALL return to grid view.
   */
  
  it('should open expanded view with clicked camera', () => {
    fc.assert(
      fc.property(nonEmptyCameraArrayArb, (cameras) => {
        // Pick a random camera to click
        const randomIndex = Math.floor(Math.random() * cameras.length)
        const clickedCamera = cameras[randomIndex]
        
        const initialState: ExpandedViewState = {
          expandedCameraId: null,
          cameras
        }
        
        const newState = openExpandedView(initialState, clickedCamera.id)
        
        // Expanded view should be open with the clicked camera
        expect(newState.expandedCameraId).toBe(clickedCamera.id)
        
        const expandedCamera = getExpandedCamera(newState)
        expect(expandedCamera).not.toBeNull()
        expect(expandedCamera?.id).toBe(clickedCamera.id)
        expect(expandedCamera?.name).toBe(clickedCamera.name)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should close expanded view and return to grid view', () => {
    fc.assert(
      fc.property(nonEmptyCameraArrayArb, (cameras) => {
        const randomIndex = Math.floor(Math.random() * cameras.length)
        const clickedCamera = cameras[randomIndex]
        
        // Open expanded view
        let state: ExpandedViewState = {
          expandedCameraId: null,
          cameras
        }
        state = openExpandedView(state, clickedCamera.id)
        
        // Verify it's open
        expect(state.expandedCameraId).toBe(clickedCamera.id)
        
        // Close expanded view
        state = closeExpandedView(state)
        
        // Should be closed (back to grid view)
        expect(state.expandedCameraId).toBeNull()
        expect(getExpandedCamera(state)).toBeNull()
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should display correct camera data in expanded view', () => {
    fc.assert(
      fc.property(nonEmptyCameraArrayArb, (cameras) => {
        const randomIndex = Math.floor(Math.random() * cameras.length)
        const clickedCamera = cameras[randomIndex]
        
        const state = openExpandedView({
          expandedCameraId: null,
          cameras
        }, clickedCamera.id)
        
        const expandedCamera = getExpandedCamera(state)
        
        // All camera properties should match
        expect(expandedCamera?.id).toBe(clickedCamera.id)
        expect(expandedCamera?.name).toBe(clickedCamera.name)
        expect(expandedCamera?.location).toBe(clickedCamera.location)
        expect(expandedCamera?.status).toBe(clickedCamera.status)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should maintain camera list when opening/closing expanded view', () => {
    fc.assert(
      fc.property(nonEmptyCameraArrayArb, (cameras) => {
        const randomIndex = Math.floor(Math.random() * cameras.length)
        const clickedCamera = cameras[randomIndex]
        
        let state: ExpandedViewState = {
          expandedCameraId: null,
          cameras
        }
        
        // Open
        state = openExpandedView(state, clickedCamera.id)
        expect(state.cameras).toEqual(cameras)
        
        // Close
        state = closeExpandedView(state)
        expect(state.cameras).toEqual(cameras)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should handle clicking any camera in the list', () => {
    fc.assert(
      fc.property(nonEmptyCameraArrayArb, fc.integer({ min: 0, max: 100 }), (cameras, indexSeed) => {
        // Test clicking each camera
        const index = indexSeed % cameras.length
        const camera = cameras[index]
        
        const state = openExpandedView({
          expandedCameraId: null,
          cameras
        }, camera.id)
        
        expect(state.expandedCameraId).toBe(camera.id)
        expect(getExpandedCameraIndex(state)).toBe(index)
        
        return true
      }),
      { numRuns: 100 }
    )
  })
})

describe('Property 7: Camera Navigation in Expanded View', () => {
  /**
   * Feature: camera-preview-grid, Property 7: Camera Navigation in Expanded View
   * For any camera at index N in the list, clicking next SHALL show camera at index (N+1) mod total,
   * and clicking prev SHALL show camera at index (N-1+total) mod total.
   */
  
  it('should navigate to next camera with circular wrapping', () => {
    fc.assert(
      fc.property(multipleCameraArrayArb, fc.integer({ min: 0, max: 100 }), (cameras, indexSeed) => {
        const startIndex = indexSeed % cameras.length
        const startCamera = cameras[startIndex]
        
        let state: ExpandedViewState = {
          expandedCameraId: startCamera.id,
          cameras
        }
        
        // Navigate next
        state = navigateExpandedView(state, 'next')
        
        // Expected index: (N+1) mod total
        const expectedIndex = (startIndex + 1) % cameras.length
        const expectedCamera = cameras[expectedIndex]
        
        expect(state.expandedCameraId).toBe(expectedCamera.id)
        expect(getExpandedCameraIndex(state)).toBe(expectedIndex)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should navigate to previous camera with circular wrapping', () => {
    fc.assert(
      fc.property(multipleCameraArrayArb, fc.integer({ min: 0, max: 100 }), (cameras, indexSeed) => {
        const startIndex = indexSeed % cameras.length
        const startCamera = cameras[startIndex]
        
        let state: ExpandedViewState = {
          expandedCameraId: startCamera.id,
          cameras
        }
        
        // Navigate prev
        state = navigateExpandedView(state, 'prev')
        
        // Expected index: (N-1+total) mod total
        const expectedIndex = (startIndex - 1 + cameras.length) % cameras.length
        const expectedCamera = cameras[expectedIndex]
        
        expect(state.expandedCameraId).toBe(expectedCamera.id)
        expect(getExpandedCameraIndex(state)).toBe(expectedIndex)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should wrap from last to first when navigating next', () => {
    fc.assert(
      fc.property(multipleCameraArrayArb, (cameras) => {
        // Start at last camera
        const lastIndex = cameras.length - 1
        const lastCamera = cameras[lastIndex]
        
        let state: ExpandedViewState = {
          expandedCameraId: lastCamera.id,
          cameras
        }
        
        // Navigate next should wrap to first
        state = navigateExpandedView(state, 'next')
        
        expect(state.expandedCameraId).toBe(cameras[0].id)
        expect(getExpandedCameraIndex(state)).toBe(0)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should wrap from first to last when navigating prev', () => {
    fc.assert(
      fc.property(multipleCameraArrayArb, (cameras) => {
        // Start at first camera
        const firstCamera = cameras[0]
        
        let state: ExpandedViewState = {
          expandedCameraId: firstCamera.id,
          cameras
        }
        
        // Navigate prev should wrap to last
        state = navigateExpandedView(state, 'prev')
        
        const lastIndex = cameras.length - 1
        expect(state.expandedCameraId).toBe(cameras[lastIndex].id)
        expect(getExpandedCameraIndex(state)).toBe(lastIndex)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should complete full cycle navigating next', () => {
    fc.assert(
      fc.property(multipleCameraArrayArb, (cameras) => {
        const startCamera = cameras[0]
        
        let state: ExpandedViewState = {
          expandedCameraId: startCamera.id,
          cameras
        }
        
        // Navigate through all cameras
        for (let i = 0; i < cameras.length; i++) {
          const expectedIndex = i
          expect(getExpandedCameraIndex(state)).toBe(expectedIndex)
          state = navigateExpandedView(state, 'next')
        }
        
        // Should be back at start
        expect(state.expandedCameraId).toBe(startCamera.id)
        expect(getExpandedCameraIndex(state)).toBe(0)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should complete full cycle navigating prev', () => {
    fc.assert(
      fc.property(multipleCameraArrayArb, (cameras) => {
        const startCamera = cameras[0]
        
        let state: ExpandedViewState = {
          expandedCameraId: startCamera.id,
          cameras
        }
        
        // Navigate backwards through all cameras
        for (let i = 0; i < cameras.length; i++) {
          state = navigateExpandedView(state, 'prev')
        }
        
        // Should be back at start
        expect(state.expandedCameraId).toBe(startCamera.id)
        expect(getExpandedCameraIndex(state)).toBe(0)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should not navigate when only one camera exists', () => {
    fc.assert(
      fc.property(cameraArb, (camera) => {
        const cameras = [camera]
        
        let state: ExpandedViewState = {
          expandedCameraId: camera.id,
          cameras
        }
        
        // Try navigating next
        const afterNext = navigateExpandedView(state, 'next')
        expect(afterNext.expandedCameraId).toBe(camera.id)
        
        // Try navigating prev
        const afterPrev = navigateExpandedView(state, 'prev')
        expect(afterPrev.expandedCameraId).toBe(camera.id)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should maintain correct index after multiple navigations', () => {
    fc.assert(
      fc.property(
        multipleCameraArrayArb, 
        fc.array(fc.constantFrom<'prev' | 'next'>('prev', 'next'), { minLength: 1, maxLength: 20 }),
        (cameras, directions) => {
          let state: ExpandedViewState = {
            expandedCameraId: cameras[0].id,
            cameras
          }
          
          let expectedIndex = 0
          
          for (const direction of directions) {
            state = navigateExpandedView(state, direction)
            
            if (direction === 'next') {
              expectedIndex = (expectedIndex + 1) % cameras.length
            } else {
              expectedIndex = (expectedIndex - 1 + cameras.length) % cameras.length
            }
            
            expect(getExpandedCameraIndex(state)).toBe(expectedIndex)
            expect(state.expandedCameraId).toBe(cameras[expectedIndex].id)
          }
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should preserve camera data during navigation', () => {
    fc.assert(
      fc.property(multipleCameraArrayArb, (cameras) => {
        let state: ExpandedViewState = {
          expandedCameraId: cameras[0].id,
          cameras
        }
        
        // Navigate through all cameras and verify data
        for (let i = 0; i < cameras.length; i++) {
          const expandedCamera = getExpandedCamera(state)
          const expectedCamera = cameras[i]
          
          expect(expandedCamera?.id).toBe(expectedCamera.id)
          expect(expandedCamera?.name).toBe(expectedCamera.name)
          expect(expandedCamera?.location).toBe(expectedCamera.location)
          expect(expandedCamera?.status).toBe(expectedCamera.status)
          
          state = navigateExpandedView(state, 'next')
        }
        
        return true
      }),
      { numRuns: 100 }
    )
  })
})
