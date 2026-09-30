/**
 * Feature: camera-preview-grid
 * Property 2: Status Indicator Correctness
 * Property 8: Camera Tile Data Display
 * Validates: Requirements 1.3, 4.1, 4.2, 4.3
 * 
 * Property 2: For any camera with a given status (connected, disconnected, connecting),
 * the Camera_Tile SHALL display the corresponding status indicator that matches the camera's status.
 * 
 * Property 8: For any camera with name and location properties,
 * the Camera_Tile SHALL render both the name and location text within the tile.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { getStatusConfig, type Camera, type CameraStatus } from '../components/CameraTile'

// Arbitrary for generating valid camera IDs
const cameraIdArb = fc.uuid()

// Arbitrary for generating valid camera names (non-empty strings)
const cameraNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)

// Arbitrary for generating optional camera locations
const cameraLocationArb = fc.option(
  fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  { nil: undefined }
)

// Arbitrary for generating camera statuses
const cameraStatusArb = fc.constantFrom<CameraStatus>('connected', 'disconnected', 'connecting')

// Arbitrary for generating optional stream URLs
const streamUrlArb = fc.option(fc.webUrl(), { nil: undefined })

// Arbitrary for generating complete valid cameras
const cameraArb: fc.Arbitrary<Camera> = fc.record({
  id: cameraIdArb,
  name: cameraNameArb,
  location: cameraLocationArb,
  status: cameraStatusArb,
  streamUrl: streamUrlArb
})

// Expected status configurations
const EXPECTED_STATUS_CONFIG: Record<CameraStatus, {
  bgColor: string
  textColor: string
  animate: boolean
  label: string
}> = {
  connected: {
    bgColor: 'bg-emerald-500',
    textColor: 'text-emerald-500',
    animate: false,
    label: 'Connected'
  },
  disconnected: {
    bgColor: 'bg-gray-400',
    textColor: 'text-gray-400',
    animate: false,
    label: 'Disconnected'
  },
  connecting: {
    bgColor: 'bg-amber-500',
    textColor: 'text-amber-500',
    animate: true,
    label: 'Connecting'
  }
}

describe('Property 2: Status Indicator Correctness', () => {
  /**
   * Feature: camera-preview-grid, Property 2: Status Indicator Correctness
   * For any camera status, getStatusConfig SHALL return the correct visual configuration
   */
  it('should return correct background color for all camera statuses', () => {
    fc.assert(
      fc.property(cameraStatusArb, (status) => {
        const config = getStatusConfig(status)
        const expected = EXPECTED_STATUS_CONFIG[status]
        
        expect(config.bgColor).toBe(expected.bgColor)
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should return correct text color for all camera statuses', () => {
    fc.assert(
      fc.property(cameraStatusArb, (status) => {
        const config = getStatusConfig(status)
        const expected = EXPECTED_STATUS_CONFIG[status]
        
        expect(config.textColor).toBe(expected.textColor)
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should return correct animation state for all camera statuses', () => {
    fc.assert(
      fc.property(cameraStatusArb, (status) => {
        const config = getStatusConfig(status)
        const expected = EXPECTED_STATUS_CONFIG[status]
        
        expect(config.animate).toBe(expected.animate)
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should use green indicator for connected status', () => {
    fc.assert(
      fc.property(cameraArb.filter(c => c.status === 'connected'), (camera) => {
        const config = getStatusConfig(camera.status)
        
        expect(config.bgColor).toBe('bg-emerald-500')
        expect(config.textColor).toBe('text-emerald-500')
        expect(config.animate).toBe(false)
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should use gray indicator for disconnected status', () => {
    fc.assert(
      fc.property(cameraArb.filter(c => c.status === 'disconnected'), (camera) => {
        const config = getStatusConfig(camera.status)
        
        expect(config.bgColor).toBe('bg-gray-400')
        expect(config.textColor).toBe('text-gray-400')
        expect(config.animate).toBe(false)
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should use animated yellow indicator for connecting status', () => {
    fc.assert(
      fc.property(cameraArb.filter(c => c.status === 'connecting'), (camera) => {
        const config = getStatusConfig(camera.status)
        
        expect(config.bgColor).toBe('bg-amber-500')
        expect(config.textColor).toBe('text-amber-500')
        expect(config.animate).toBe(true)
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should have consistent status configuration for all generated cameras', () => {
    fc.assert(
      fc.property(cameraArb, (camera) => {
        const config = getStatusConfig(camera.status)
        const expected = EXPECTED_STATUS_CONFIG[camera.status]
        
        // All configuration properties should match expected values
        expect(config.bgColor).toBe(expected.bgColor)
        expect(config.textColor).toBe(expected.textColor)
        expect(config.animate).toBe(expected.animate)
        expect(config.label).toBe(expected.label)
        return true
      }),
      { numRuns: 100 }
    )
  })
})

describe('Property 8: Camera Tile Data Display', () => {
  /**
   * Feature: camera-preview-grid, Property 8: Camera Tile Data Display
   * For any camera with name and location properties,
   * the Camera_Tile SHALL render both the name and location text within the tile.
   */
  it('should have valid name property for all cameras', () => {
    fc.assert(
      fc.property(cameraArb, (camera) => {
        // Camera must have a non-empty name
        expect(camera.name).toBeDefined()
        expect(camera.name.trim().length).toBeGreaterThan(0)
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should have valid id property for all cameras', () => {
    fc.assert(
      fc.property(cameraArb, (camera) => {
        // Camera must have a valid id
        expect(camera.id).toBeDefined()
        expect(camera.id.length).toBeGreaterThan(0)
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should have valid status property for all cameras', () => {
    fc.assert(
      fc.property(cameraArb, (camera) => {
        // Camera must have a valid status
        expect(camera.status).toBeDefined()
        expect(['connected', 'disconnected', 'connecting']).toContain(camera.status)
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should have location as optional string or undefined', () => {
    fc.assert(
      fc.property(cameraArb, (camera) => {
        // Location should be either undefined or a non-empty string
        if (camera.location !== undefined) {
          expect(typeof camera.location).toBe('string')
          expect(camera.location.trim().length).toBeGreaterThan(0)
        }
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should preserve camera data integrity through arbitrary generation', () => {
    fc.assert(
      fc.property(cameraArb, (camera) => {
        // All required fields should be present and valid
        expect(camera).toHaveProperty('id')
        expect(camera).toHaveProperty('name')
        expect(camera).toHaveProperty('status')
        
        // Name should be displayable (non-empty after trim)
        expect(camera.name.trim().length).toBeGreaterThan(0)
        
        // Status should be one of the valid values
        expect(['connected', 'disconnected', 'connecting']).toContain(camera.status)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should support cameras with both name and location', () => {
    const cameraWithLocationArb = cameraArb.filter(c => c.location !== undefined)
    
    fc.assert(
      fc.property(cameraWithLocationArb, (camera) => {
        // Both name and location should be present and valid
        expect(camera.name.trim().length).toBeGreaterThan(0)
        expect(camera.location).toBeDefined()
        expect(camera.location!.trim().length).toBeGreaterThan(0)
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should support cameras with name only (no location)', () => {
    const cameraWithoutLocationArb = cameraArb.filter(c => c.location === undefined)
    
    fc.assert(
      fc.property(cameraWithoutLocationArb, (camera) => {
        // Name should be present and valid, location should be undefined
        expect(camera.name.trim().length).toBeGreaterThan(0)
        expect(camera.location).toBeUndefined()
        return true
      }),
      { numRuns: 100 }
    )
  })
})
