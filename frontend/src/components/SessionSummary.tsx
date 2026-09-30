import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Users,
  UserCheck,
  Clock,
  UserX,
  Timer,
  TrendingUp,
  Calendar,
} from 'lucide-react'
import { useAttendanceStore } from '../store/attendanceStore'

export function SessionSummary() {
  const { t } = useTranslation()
  const { attendanceRecords, currentSession } = useAttendanceStore()

  // Calculate statistics
  const stats = useMemo(() => {
    const studentRecords = attendanceRecords.filter((r) => r.person.role === 'student')
    
    const present = studentRecords.filter((r) => r.status === 'present').length
    const late = studentRecords.filter((r) => r.status === 'late').length
    const absent = studentRecords.filter((r) => r.status === 'absent').length
    const total = currentSession?.studentIds.length || studentRecords.length

    // Calculate average time in classroom
    const recordsWithTime = studentRecords.filter((r) => r.totalTimeMinutes > 0)
    const averageTime =
      recordsWithTime.length > 0
        ? recordsWithTime.reduce((sum, r) => sum + r.totalTimeMinutes, 0) / recordsWithTime.length
        : 0

    // Calculate attendance percentage
    const attendancePercentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0

    return {
      present,
      late,
      absent,
      total,
      averageTime,
      attendancePercentage,
    }
  }, [attendanceRecords, currentSession])

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return '—'
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    if (hours > 0) {
      return `${hours}${t('common.hours')} ${mins}${t('common.minutes')}`
    }
    return `${mins} ${t('common.minutes')}`
  }

  const formatTime = (date: Date | undefined) => {
    if (!date) return '—'
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 80) return 'text-emerald-400'
    if (percentage >= 60) return 'text-amber-400'
    return 'text-red-400'
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-emerald-500'
    if (percentage >= 60) return 'bg-amber-500'
    return 'bg-red-500'
  }

  return (
    <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10">
            <TrendingUp className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-text)]">
              Session Summary
            </h3>
            {currentSession && (
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <Calendar className="w-3 h-3" />
                <span>
                  {formatTime(currentSession.startTime)} — {formatTime(currentSession.endTime)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Attendance Percentage Badge */}
        <div className="flex items-center gap-2">
          <div className="relative w-12 h-12">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-slate-700"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${stats.attendancePercentage * 0.94} 94`}
                className={getProgressColor(stats.attendancePercentage)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-xs font-bold ${getAttendanceColor(stats.attendancePercentage)}`}>
                {stats.attendancePercentage}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-5">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Students */}
          <div className="p-4 rounded-xl bg-slate-500/5 border border-slate-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-[var(--color-text-muted)]">
                {t('dashboard.totalStudents')}
              </span>
            </div>
            <span className="text-2xl font-bold text-slate-300">
              {stats.total}
            </span>
          </div>

          {/* Present */}
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-[var(--color-text-muted)]">
                {t('reports.present')}
              </span>
            </div>
            <span className="text-2xl font-bold text-emerald-400">
              {stats.present}
            </span>
          </div>

          {/* Late */}
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-[var(--color-text-muted)]">
                {t('reports.late')}
              </span>
            </div>
            <span className="text-2xl font-bold text-amber-400">
              {stats.late}
            </span>
          </div>

          {/* Absent */}
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <UserX className="w-4 h-4 text-red-400" />
              <span className="text-xs text-[var(--color-text-muted)]">
                {t('reports.absent')}
              </span>
            </div>
            <span className="text-2xl font-bold text-red-400">
              {stats.absent}
            </span>
          </div>

          {/* Average Time */}
          <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-4 h-4 text-sky-400" />
              <span className="text-xs text-[var(--color-text-muted)]">
                {t('analytics.averageAttendance')}
              </span>
            </div>
            <span className="text-lg font-bold text-sky-400">
              {formatDuration(stats.averageTime)}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-2">
            <span>Attendance Distribution</span>
            <span>{stats.present + stats.late} / {stats.total} students</span>
          </div>
          <div className="h-3 bg-[var(--color-bg)] rounded-full overflow-hidden flex">
            {stats.present > 0 && (
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${(stats.present / stats.total) * 100}%` }}
              />
            )}
            {stats.late > 0 && (
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${(stats.late / stats.total) * 100}%` }}
              />
            )}
            {stats.absent > 0 && (
              <div
                className="h-full bg-red-500/50 transition-all duration-500"
                style={{ width: `${(stats.absent / stats.total) * 100}%` }}
              />
            )}
          </div>
          <div className="flex items-center justify-center gap-6 mt-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-[var(--color-text-muted)]">{t('reports.present')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-xs text-[var(--color-text-muted)]">{t('reports.late')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
              <span className="text-xs text-[var(--color-text-muted)]">{t('reports.absent')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
