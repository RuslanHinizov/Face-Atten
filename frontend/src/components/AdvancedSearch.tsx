import { memo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Filter, X, Calendar, Users, CheckCircle, XCircle, Clock } from 'lucide-react'

interface SearchFilters {
    dateFrom: string
    dateTo: string
    group: string
    status: ('present' | 'late' | 'absent')[]
    query: string
}

interface AdvancedSearchProps {
    onSearch: (filters: SearchFilters) => void
    groups?: { id: string; name: string }[]
    initialFilters?: Partial<SearchFilters>
}

const defaultFilters: SearchFilters = {
    dateFrom: '',
    dateTo: '',
    group: '',
    status: [],
    query: '',
}

export const AdvancedSearch = memo(({
    onSearch,
    groups = [],
    initialFilters = {}
}: AdvancedSearchProps) => {
    const { t } = useTranslation()
    const [isExpanded, setIsExpanded] = useState(false)
    const [filters, setFilters] = useState<SearchFilters>({
        ...defaultFilters,
        ...initialFilters,
    })

    // Demo groups if none provided
    const demoGroups = groups.length > 0 ? groups : [
        { id: 'g1', name: 'ИП-21' },
        { id: 'g2', name: 'СТ-21' },
    ]

    const handleQueryChange = useCallback((query: string) => {
        setFilters(prev => ({ ...prev, query }))
    }, [])

    const handleDateFromChange = useCallback((dateFrom: string) => {
        setFilters(prev => ({ ...prev, dateFrom }))
    }, [])

    const handleDateToChange = useCallback((dateTo: string) => {
        setFilters(prev => ({ ...prev, dateTo }))
    }, [])

    const handleGroupChange = useCallback((group: string) => {
        setFilters(prev => ({ ...prev, group }))
    }, [])

    const toggleStatus = useCallback((status: 'present' | 'late' | 'absent') => {
        setFilters(prev => ({
            ...prev,
            status: prev.status.includes(status)
                ? prev.status.filter(s => s !== status)
                : [...prev.status, status]
        }))
    }, [])

    const clearFilters = useCallback(() => {
        setFilters(defaultFilters)
        onSearch(defaultFilters)
    }, [onSearch])

    const applyFilters = useCallback(() => {
        onSearch(filters)
    }, [onSearch, filters])

    const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.group || filters.status.length > 0

    const activeFilterCount = [
        filters.dateFrom || filters.dateTo ? 1 : 0,
        filters.group ? 1 : 0,
        filters.status.length > 0 ? 1 : 0,
    ].reduce((a, b) => a + b, 0)

    return (
        <div className="card overflow-hidden">
            {/* Search Bar */}
            <div className="p-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                        <input
                            type="text"
                            value={filters.query}
                            onChange={(e) => handleQueryChange(e.target.value)}
                            placeholder={t('reports.searchPlaceholder')}
                            className="w-full pl-12 pr-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all"
                        />
                    </div>

                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`relative btn ${isExpanded ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        <Filter className="w-4 h-4" />
                        {t('search.advanced')}
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Expanded Filters */}
            {isExpanded && (
                <div className="p-4 bg-[var(--color-bg)] space-y-4 animate-fade-in">
                    {/* Date Range */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)] mb-2">
                            <Calendar className="w-4 h-4 text-[var(--color-text-muted)]" />
                            {t('search.dateRange')}
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('search.from')}</label>
                                <input
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => handleDateFromChange(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('search.to')}</label>
                                <input
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => handleDateToChange(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Group Filter */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)] mb-2">
                            <Users className="w-4 h-4 text-[var(--color-text-muted)]" />
                            {t('search.group')}
                        </label>
                        <select
                            value={filters.group}
                            onChange={(e) => handleGroupChange(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all"
                        >
                            <option value="">{t('common.all')}</option>
                            {demoGroups.map(group => (
                                <option key={group.id} value={group.id}>{group.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)] mb-3">
                            {t('search.status')}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => toggleStatus('present')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${filters.status.includes('present')
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                        : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-emerald-300'
                                    }`}
                            >
                                <CheckCircle className="w-4 h-4" />
                                {t('reports.present')}
                            </button>

                            <button
                                onClick={() => toggleStatus('late')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${filters.status.includes('late')
                                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                                        : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-amber-300'
                                    }`}
                            >
                                <Clock className="w-4 h-4" />
                                {t('reports.late')}
                            </button>

                            <button
                                onClick={() => toggleStatus('absent')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${filters.status.includes('absent')
                                        ? 'bg-red-50 border-red-300 text-red-700'
                                        : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-red-300'
                                    }`}
                            >
                                <XCircle className="w-4 h-4" />
                                {t('reports.absent')}
                            </button>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
                        <button
                            onClick={clearFilters}
                            disabled={!hasActiveFilters}
                            className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <X className="w-4 h-4" />
                            {t('search.clearFilters')}
                        </button>

                        <button
                            onClick={applyFilters}
                            className="btn btn-primary"
                        >
                            <Search className="w-4 h-4" />
                            {t('search.apply')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
})

AdvancedSearch.displayName = 'AdvancedSearch'

export default AdvancedSearch
