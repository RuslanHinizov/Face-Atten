import { Grid2X2, Grid3X3, LayoutGrid } from 'lucide-react'

export type GridLayout = '2x2' | '3x3' | '4x4' | '5x5' | '6x6' | '8x8' | '10x10' | '16x16'

export interface LayoutSelectorProps {
  currentLayout: GridLayout
  onLayoutChange: (layout: GridLayout) => void
}

interface LayoutOption {
  layout: GridLayout
  icon: typeof Grid2X2
  label: string
  gridSize: number
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  { layout: '2x2', icon: Grid2X2, label: '2×2', gridSize: 4 },
  { layout: '3x3', icon: Grid3X3, label: '3×3', gridSize: 9 },
  { layout: '4x4', icon: LayoutGrid, label: '4×4', gridSize: 16 },
  { layout: '5x5', icon: LayoutGrid, label: '5×5', gridSize: 25 },
  { layout: '6x6', icon: LayoutGrid, label: '6×6', gridSize: 36 },
  { layout: '8x8', icon: LayoutGrid, label: '8×8', gridSize: 64 },
  { layout: '10x10', icon: LayoutGrid, label: '10×10', gridSize: 100 },
  { layout: '16x16', icon: LayoutGrid, label: '16×16', gridSize: 256 }
]

/**
 * LayoutSelector - Grid layout selection buttons
 * 
 * Provides 2x2, 3x3, 4x4 layout options with visual feedback for active selection.
 * Requirements: 2.1, 2.2
 */
export function LayoutSelector({ currentLayout, onLayoutChange }: LayoutSelectorProps) {
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-xl bg-slate-800/60 backdrop-blur-sm border border-slate-700/50"
      role="group"
      aria-label="Grid layout selector"
    >
      {LAYOUT_OPTIONS.map(({ layout, icon: Icon, label, gridSize }) => {
        const isActive = currentLayout === layout

        return (
          <button
            key={layout}
            data-testid={`layout-btn-${layout}`}
            data-layout={layout}
            onClick={() => onLayoutChange(layout)}
            className={`
              relative flex items-center gap-2 px-3 py-2 rounded-lg
              font-medium text-sm transition-all duration-200 ease-out
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
              ${isActive
                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }
            `}
            aria-pressed={isActive}
            aria-label={`${label} grid layout (${gridSize} cameras)`}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
            <span className="hidden sm:inline">{label}</span>

            {/* Active indicator glow */}
            {isActive && (
              <div className="absolute inset-0 rounded-lg bg-blue-400/20 blur-sm -z-10" />
            )}
          </button>
        )
      })}
    </div>
  )
}
