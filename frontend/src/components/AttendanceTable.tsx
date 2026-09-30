import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserCheck,
  Clock,
  UserX,
  Search,
} from 'lucide-react'
import { useAttendanceStore, AttendanceRecord } from '../store/attendanceStore'

interface AttendanceTableProps {
  statusFilter?: 'all' | 'present' | 'late' | 'absent'
}

type SortField = 'name' | 'status' | 'entryTime' | 'totalTime'
type SortDirection = 'asc' | 'desc'

export function AttendanceTable({ statusFilter = 'all' }: AttendanceTableProps) {
  const { t } = useTranslation()
  const { attendanceRecords } = useAttendanceStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Filter only students
  const studentRecords = useMemo(() => {
    return attendanceRecords.filter((r) => r.person.role === 'student')
  }, [attendanceRecords])

  // Apply filters and sorting
  const filteredAndSortedRecords = useMemo(() => {
    let records = [...studentRecords]

    // Apply status filter
    if (statusFilter !== 'all') {
      records = records.filter((r) => r.status === statusFilter)
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      records = records.filter((r) =>
        r.person.name.toLowerCase().includes(query)
      )
    }

    // Apply sorting
    records.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'name':
          comparison = a.person.name.localeCompare(b.person.name)
          break
        case 'status':
          const statusOrder = { present: 0, late: 1, absent: 2 }
          comparison = statusOrder[a.status] - statusOrder[b.status]
          break
        case 'entryTime':
          const aTime = a.firstEntry?.getTime() ?? Infinity
          const bTime = b.firstEntry?.getTime() ?? Infinity
          comparison = aTime - bTime
          break
        case 'totalTime':
          comparison = a.totalTimeMinutes - b.totalTimeMinutes
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return records
  }, [studentRecords, statusFilter, searchQuery, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5" />
    )
  }

  const getStatusBadge = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <UserCheck className="w-3 h-3" />
            {t('reports.present')}
          </span>
        )
      case 'late':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            {t('reports.late')}
          </span>
        )
      case 'absent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <UserX className="w-3 h-3" />
            {t('reports.absent')}
          </span>
        )
    }
  }

  const formatTime = (date: Date | undefined) => {
    if (!date) return '—'
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return '—'
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    if (hours > 0) {
      return `${hours}${t('common.hours')} ${mins}${t('common.minutes')}`
    }
    return `${mins} ${t('common.minutes')}`
  }

  const getLastExitTime = (record: AttendanceRecord) => {
    const exitEvents = record.events.filter((e) => e.eventType === 'exit')
    if (exitEvents.length === 0) return undefined
    return exitEvents[exitEvents.length - 1].timestamp
  }

  return (
    <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
      {/* Header with Search */}
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-4">
        <h3 className="font-semibold text-[var(--color-text)]">
          {t('reports.students')}
          <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">
            ({filteredAndSortedRecords.length})
          </span>
        </h3>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('common.search')}
            className="pl-9 pr-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 w-64 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/50">
              <th className="px-5 py-3 text-left">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hover:text-[var(--color-text)] transition-colors"
                >
                  {t('reports.name')}
                  {getSortIcon('name')}
                </button>
              </th>
              <th className="px-5 py-3 text-left">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hover:text-[var(--color-text)] transition-colors"
                >
                  {t('reports.status')}
                  {getSortIcon('status')}
                </button>
              </th>
              <th className="px-5 py-3 text-left">
                <button
                  onClick={() => handleSort('entryTime')}
                  className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hover:text-[var(--color-text)] transition-colors"
                >
                  {t('reports.entryTime')}
                  {getSortIcon('entryTime')}
                </button>
              </th>
              <th className="px-5 py-3 text-left">
                <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  {t('reports.exitTime')}
                </span>
              </th>
              <th className="px-5 py-3 text-left">
                <button
                  onClick={() => handleSort('totalTime')}
                  className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hover:text-[var(--color-text)] transition-colors"
                >
                  {t('reports.totalTime')}
                  {getSortIcon('totalTime')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filteredAndSortedRecords.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center">
                  <User className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {t('reports.noData')}
                  </p>
                </td>
              </tr>
            ) : (
              filteredAndSortedRecords.map((record) => (
                <tr
                  key={record.id}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  {/* Name & Photo */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center overflow-hidden">
                        {record.person.photoUrl ? (
                          <img
                            src={record.person.photoUrl}
                            alt={record.person.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-violet-400" />
                        )}
                      </div>
                      <span className="font-medium text-[var(--color-text)]">
                        {record.person.name}
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">{getStatusBadge(record.status)}</td>

                  {/* Entry Time */}
                  <td className="px-5 py-4">
                    <span className="text-sm text-[var(--color-text)] font-mono">
                      {formatTime(record.firstEntry)}
                    </span>
                    {record.lateByMinutes > 0 && (
                      <span className="ml-2 text-xs text-amber-400">
                        +{Math.round(record.lateByMinutes)} {t('common.minutes')}
                      </span>
                    )}
                  </td>

                  {/* Exit Time */}
                  <td className="px-5 py-4">
                    <span className="text-sm text-[var(--color-text)] font-mono">
                      {formatTime(getLastExitTime(record))}
                    </span>
                  </td>

                  {/* Total Time */}
                  <td className="px-5 py-4">
                    <span className="text-sm text-[var(--color-text)]">
                      {formatDuration(record.totalTimeMinutes)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
