import { useState, useEffect, useCallback } from 'react'
import type { GridLayout } from '../utils/gridUtils'

/**
 * Local storage key for grid preferences
 */
const STORAGE_KEY = 'camera-grid-preferences'

/**
 * Default layout when no preference is stored
 */
const DEFAULT_LAYOUT: GridLayout = '2x2'

/**
 * Valid layout values for validation
 */
const VALID_LAYOUTS: GridLayout[] = ['2x2', '3x3', '4x4']

/**
 * Interface for stored grid preferences
 */
export interface GridPreferences {
  layout: GridLayout
  lastUpdated: string
}

/**
 * Validates if a value is a valid GridLayout
 */
function isValidLayout(value: unknown): value is GridLayout {
  return typeof value === 'string' && VALID_LAYOUTS.includes(value as GridLayout)
}

/**
 * Reads layout preference from local storage
 * Returns default layout if storage is unavailable or data is invalid
 * 
 * Requirements: 2.5
 */
export function readLayoutFromStorage(): GridLayout {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return DEFAULT_LAYOUT
    }
    
    const parsed: unknown = JSON.parse(stored)
    
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'layout' in parsed &&
      isValidLayout((parsed as GridPreferences).layout)
    ) {
      return (parsed as GridPreferences).layout
    }
    
    return DEFAULT_LAYOUT
  } catch {
    // Local storage unavailable or invalid JSON
    return DEFAULT_LAYOUT
  }
}

/**
 * Saves layout preference to local storage
 * Silently fails if storage is unavailable
 * 
 * Requirements: 2.4
 */
export function saveLayoutToStorage(layout: GridLayout): void {
  try {
    const preferences: GridPreferences = {
      layout,
      lastUpdated: new Date().toISOString()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // Local storage unavailable - fail silently
  }
}

/**
 * Hook for managing grid layout preferences with local storage persistence
 * 
 * - Reads initial layout from local storage on mount
 * - Persists layout changes to local storage
 * - Falls back to '2x2' if storage is unavailable or data is invalid
 * 
 * Requirements: 2.4, 2.5
 * 
 * @returns Tuple of [current layout, layout setter function]
 */
export function useGridPreferences(): [GridLayout, (layout: GridLayout) => void] {
  const [layout, setLayoutState] = useState<GridLayout>(() => readLayoutFromStorage())

  const setLayout = useCallback((newLayout: GridLayout) => {
    setLayoutState(newLayout)
    saveLayoutToStorage(newLayout)
  }, [])

  // Sync with storage on mount (handles SSR hydration)
  useEffect(() => {
    const storedLayout = readLayoutFromStorage()
    if (storedLayout !== layout) {
      setLayoutState(storedLayout)
    }
  }, [])

  return [layout, setLayout]
}

export { STORAGE_KEY, DEFAULT_LAYOUT, VALID_LAYOUTS }
