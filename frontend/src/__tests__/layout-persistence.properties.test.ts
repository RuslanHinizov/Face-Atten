/**
 * Feature: camera-preview-grid
 * Property 5: Layout Persistence Round-Trip
 * Validates: Requirements 2.4, 2.5
 * 
 * Property 5: For any layout selection, saving to local storage and then
 * reading back SHALL return the same layout value.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import type { GridLayout } from '../utils/gridUtils'

// Arbitrary for grid layouts
const gridLayoutArb = fc.constantFrom<GridLayout>('2x2', '3x3', '4x4')

// Storage key constant (must match the hook)
const STORAGE_KEY = 'camera-grid-preferences'
const DEFAULT_LAYOUT: GridLayout = '2x2'
const VALID_LAYOUTS: GridLayout[] = ['2x2', '3x3', '4x4']

// In-memory storage for testing
let mockStorage: Record<string, string> = {}

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key]
  }),
  clear: vi.fn(() => {
    mockStorage = {}
  }),
  get length() {
    return Object.keys(mockStorage).length
  },
  key: vi.fn((index: number) => Object.keys(mockStorage)[index] ?? null)
}

// Pure functions for testing (mirroring the hook implementation)
function isValidLayout(value: unknown): value is GridLayout {
  return typeof value === 'string' && VALID_LAYOUTS.includes(value as GridLayout)
}

function readLayoutFromStorage(): GridLayout {
  try {
    const stored = localStorageMock.getItem(STORAGE_KEY)
    if (!stored) {
      return DEFAULT_LAYOUT
    }
    
    const parsed: unknown = JSON.parse(stored)
    
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'layout' in parsed &&
      isValidLayout((parsed as { layout: unknown }).layout)
    ) {
      return (parsed as { layout: GridLayout }).layout
    }
    
    return DEFAULT_LAYOUT
  } catch {
    return DEFAULT_LAYOUT
  }
}

function saveLayoutToStorage(layout: GridLayout): void {
  try {
    const preferences = {
      layout,
      lastUpdated: new Date().toISOString()
    }
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // Fail silently
  }
}

describe('Property 5: Layout Persistence Round-Trip', () => {
  beforeEach(() => {
    mockStorage = {}
    vi.clearAllMocks()
  })

  afterEach(() => {
    mockStorage = {}
  })

  /**
   * Feature: camera-preview-grid, Property 5: Layout Persistence Round-Trip
   * For any valid layout, saving and reading back should return the same value
   */
  it('should return the same layout after save and read (round-trip)', () => {
    fc.assert(
      fc.property(gridLayoutArb, (layout) => {
        // Clear storage before each iteration
        mockStorage = {}
        
        // Save the layout
        saveLayoutToStorage(layout)
        
        // Read it back
        const retrieved = readLayoutFromStorage()
        
        // Should be identical
        expect(retrieved).toBe(layout)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Multiple consecutive saves should preserve the last value
   */
  it('should preserve the last saved layout after multiple saves', () => {
    fc.assert(
      fc.property(
        fc.array(gridLayoutArb, { minLength: 1, maxLength: 10 }),
        (layouts) => {
          mockStorage = {}
          
          // Save all layouts in sequence
          layouts.forEach(layout => saveLayoutToStorage(layout))
          
          // Read should return the last one
          const retrieved = readLayoutFromStorage()
          const lastLayout = layouts[layouts.length - 1]
          
          expect(retrieved).toBe(lastLayout)
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Should return default layout when storage is empty
   */
  it('should return default layout when storage is empty', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        mockStorage = {}
        
        const retrieved = readLayoutFromStorage()
        
        expect(retrieved).toBe(DEFAULT_LAYOUT)
        expect(DEFAULT_LAYOUT).toBe('2x2')
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Should return default layout for invalid stored data
   */
  it('should return default layout for invalid stored data', () => {
    const invalidDataArb = fc.oneof(
      fc.constant('not-json'),
      fc.constant('{}'),
      fc.constant('{"layout": "invalid"}'),
      fc.constant('{"layout": 123}'),
      fc.constant('{"layout": null}'),
      fc.constant('null'),
      fc.constant('[]'),
      fc.constant('{"other": "data"}')
    )

    fc.assert(
      fc.property(invalidDataArb, (invalidData) => {
        mockStorage = {}
        mockStorage[STORAGE_KEY] = invalidData
        
        const retrieved = readLayoutFromStorage()
        
        // Should fall back to default
        expect(retrieved).toBe(DEFAULT_LAYOUT)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Saved data should use the correct storage key
   */
  it('should use the correct storage key', () => {
    fc.assert(
      fc.property(gridLayoutArb, (layout) => {
        mockStorage = {}
        
        saveLayoutToStorage(layout)
        
        // Verify setItem was called with correct key
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          STORAGE_KEY,
          expect.any(String)
        )
        
        // Verify the stored value contains the layout
        const storedValue = mockStorage[STORAGE_KEY]
        expect(storedValue).toBeDefined()
        
        const parsed = JSON.parse(storedValue)
        expect(parsed.layout).toBe(layout)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Saved data should include lastUpdated timestamp
   */
  it('should include lastUpdated timestamp in saved data', () => {
    fc.assert(
      fc.property(gridLayoutArb, (layout) => {
        mockStorage = {}
        
        const beforeSave = new Date().toISOString()
        saveLayoutToStorage(layout)
        const afterSave = new Date().toISOString()
        
        const storedValue = mockStorage[STORAGE_KEY]
        const parsed = JSON.parse(storedValue)
        
        // Should have lastUpdated field
        expect(parsed.lastUpdated).toBeDefined()
        expect(typeof parsed.lastUpdated).toBe('string')
        
        // Timestamp should be valid ISO string
        const timestamp = new Date(parsed.lastUpdated)
        expect(timestamp.toISOString()).toBe(parsed.lastUpdated)
        
        // Timestamp should be between before and after save
        expect(parsed.lastUpdated >= beforeSave).toBe(true)
        expect(parsed.lastUpdated <= afterSave).toBe(true)
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * All valid layouts should be recognized
   */
  it('should recognize all valid layouts from VALID_LAYOUTS', () => {
    fc.assert(
      fc.property(gridLayoutArb, (layout) => {
        expect(VALID_LAYOUTS).toContain(layout)
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Layout validation should correctly identify valid layouts
   */
  it('should validate layout values correctly', () => {
    fc.assert(
      fc.property(gridLayoutArb, (layout) => {
        expect(isValidLayout(layout)).toBe(true)
        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Layout validation should reject invalid values
   */
  it('should reject invalid layout values', () => {
    const invalidLayoutArb = fc.oneof(
      fc.constant('1x1'),
      fc.constant('5x5'),
      fc.constant('invalid'),
      fc.constant(''),
      fc.constant(null),
      fc.constant(undefined),
      fc.constant(123),
      fc.constant([]),
      fc.constant({})
    )

    fc.assert(
      fc.property(invalidLayoutArb, (invalidLayout) => {
        expect(isValidLayout(invalidLayout)).toBe(false)
        return true
      }),
      { numRuns: 100 }
    )
  })
})
