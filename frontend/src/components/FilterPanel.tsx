import { useTranslation } from 'react-i18next'
import {
  Filter,
  Calendar,
  Clock,
  UserCheck,
  UserX,
  Users,
  ChevronDown,
  X,
} from 'lucide-react'

interface FilterPanelProps {
  filters: {
    date: Date | null
    sessionId: string | null
    status: 'all' | 'present' | 'late' | 'absent'
  }
  onFilterChange: (filters: FilterPanelProps['filters']) => void
}

export function FilterPanel({ filters, onFilterChange }: FilterPanelProps) {
  const { t } = useTranslation()

  const statusOptions = [
    { value: 'all', label: t('common.all'), icon: <Users className="w-4 h-4" /> },
    { value: 'present', label: t('reports.present'), icon: <UserCheck className="w-4 h-4" /> },
    { value: 'late', label: t('reports.late'), icon: <Clock className="w-4 h-4" /> },
    { value: 'absent', label: t('reports.absent'), icon: <UserX className="w-4 h-4" /> },
  ] as const

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      case 'late':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      case 'absent':
        return 'text-red-400 bg-red-500/10 border-red-500/20'
      default:
        return 'text-[var(--color-text-muted)] bg-[var(--color-bg)] border-[var(--color-border)]'
    }
  }

  const hasActiveFilters = filters.date || filters.sessionId || filters.status !== 'all'

  const clearFilters = () => {
    onFilterChange({
      date: null,
      sessionId: null,
      status: 'all',
    })
  }

  return (
    <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden sticky top-24">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-violet-400" />
          <span className="font-medium text-sm text-[var(--color-text)]">
            Filters
          </span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      <div className="p-4 space-y-5">
        {/* Date Filter */}
        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            <Calendar className="w-3.5 h-3.5" />
            {t('reports.filterByDate')}
          </label>
          <div className="relative">
            <input
              type="date"
              value={filters.date ? filters.date.toISOString().split('T')[0] : ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  date: e.target.value ? new Date(e.target.value) : null,
                })
              }
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
            />
          </div>
        </div>

        {/* Session Filter */}
        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            <Clock className="w-3.5 h-3.5" />
            {t('reports.filterBySession')}
          </label>
          <div className="relative">
            <select
              value={filters.sessionId || ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  sessionId: e.target.value || null,
                })
              }
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all appearance-none cursor-pointer"
            >
              <option value="">{t('common.all')}</option>
              <option value="session-1">Morning Session</option>
              <option value="session-2">Afternoon Session</option>
              <option value="session-3">Evening Session</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            <UserCheck className="w-3.5 h-3.5" />
            {t('reports.filterByStatus')}
          </label>
          <div className="space-y-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() =>
                  onFilterChange({
                    ...filters,
                    status: option.value,
                  })
                }
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  filters.status === option.value
                    ? getStatusColor(option.value)
                    : 'text-[var(--color-text-muted)] bg-transparent border-transparent hover:bg-white/5'
                }`}
              >
                {option.icon}
                <span>{option.label}</span>
                {filters.status === option.value && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-current" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Filters */}
        <div className="pt-4 border-t border-[var(--color-border)]">
          <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3 block">
            Quick Filters
          </label>
          <div className="space-y-2">
            <button
              onClick={() =>
                onFilterChange({
                  date: new Date(),
                  sessionId: null,
                  status: 'all',
                })
              }
              className="w-full px-3 py-2 text-sm text-left text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-white/5 rounded-lg transition-colors"
            >
              Today's Records
            </button>
            <button
              onClick={() => {
                const weekAgo = new Date()
                weekAgo.setDate(weekAgo.getDate() - 7)
                onFilterChange({
                  date: weekAgo,
                  sessionId: null,
                  status: 'all',
                })
              }}
              className="w-full px-3 py-2 text-sm text-left text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-white/5 rounded-lg transition-colors"
            >
              Last 7 Days
            </button>
            <button
              onClick={() =>
                onFilterChange({
                  date: null,
                  sessionId: null,
                  status: 'late',
                })
              }
              className="w-full px-3 py-2 text-sm text-left text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
            >
              Late Arrivals Only
            </button>
            <button
              onClick={() =>
                onFilterChange({
                  date: null,
                  sessionId: null,
                  status: 'absent',
                })
              }
              className="w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              Absences Only
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
