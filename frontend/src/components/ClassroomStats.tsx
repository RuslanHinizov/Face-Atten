import { useTranslation } from 'react-i18next'
import { Users, UserCheck, Clock, UserX, GraduationCap, TrendingUp } from 'lucide-react'
import { useAttendanceStore } from '../store/attendanceStore'

export interface ClassroomStatsProps {
  variant?: 'default' | 'sidebar'
}

export function ClassroomStats({ variant = 'default' }: ClassroomStatsProps) {
  const { t } = useTranslation()
  const {
    currentSession,
    getPresentCount,
    getLateCount,
    getAbsentCount,
    getAttendancePercentage,
    isTeacherPresent,
  } = useAttendanceStore()

  const presentCount = getPresentCount()
  const lateCount = getLateCount()
  const absentCount = getAbsentCount()
  const attendancePercentage = getAttendancePercentage()
  const teacherPresent = isTeacherPresent()
  const totalStudents = currentSession?.studentIds.length || 24

  const isSidebar = variant === 'sidebar'

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 80) return 'text-emerald-600 dark:text-emerald-400'
    if (percentage >= 60) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'stroke-emerald-500'
    if (percentage >= 60) return 'stroke-amber-500'
    return 'stroke-red-500'
  }

  if (isSidebar) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-300 font-semibold border-b border-slate-700/50 pb-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <span>{t('dashboard.classroomStats')}</span>
        </div>

        {/* Compact Present/Total and Teacher Status */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{t('dashboard.attendance')}</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-xl font-bold ${getAttendanceColor(attendancePercentage)}`}>{attendancePercentage}%</span>
              <span className="text-[10px] text-slate-500">{presentCount}/{totalStudents}</span>
            </div>
          </div>
          <div className={`rounded-xl p-3 border ${teacherPresent ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{t('dashboard.teacher')}</p>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${teacherPresent ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className={`text-xs font-bold ${teacherPresent ? 'text-emerald-400' : 'text-rose-400'}`}>
                {teacherPresent ? t('status.present') : t('status.absent')}
              </span>
            </div>
          </div>
        </div>

        {/* Mini stats rows */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs p-2 bg-slate-800/30 rounded-lg">
            <span className="text-slate-400">{t('dashboard.late')}</span>
            <span className="text-amber-400 font-bold">{lateCount}</span>
          </div>
          <div className="flex items-center justify-between text-xs p-2 bg-slate-800/30 rounded-lg">
            <span className="text-slate-400">{t('dashboard.absent')}</span>
            <span className="text-rose-400 font-bold">{absentCount}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[var(--color-border)] flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shadow-sm">
          <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-[var(--color-text)] leading-tight">
            {t('dashboard.classroomStats')}
          </h3>
          <p className="text-xs font-medium text-[var(--color-text-muted)]">
            {t('dashboard.realTime')}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-8">
        {/* Circle Chart */}
        <div className="flex justify-center">
          <div className="relative w-40 h-40">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-gray-100 dark:text-gray-800"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${attendancePercentage * 2.64} 264`}
                className={getProgressColor(attendancePercentage)}
                style={{ transition: 'stroke-dasharray 1s ease-in-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-extrabold tracking-tight ${getAttendanceColor(attendancePercentage)}`}>
                {attendancePercentage}%
              </span>
              <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mt-1">
                {t('dashboard.attendance')}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Present */}
          <div className="flex flex-col p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-500/30 transition-all duration-300 group">
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm font-medium text-[var(--color-text-muted)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {t('dashboard.present')}
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[var(--color-text)]">
                {presentCount}
              </span>
              <span className="text-sm font-medium text-[var(--color-text-muted)]">
                / {totalStudents}
              </span>
            </div>
          </div>

          {/* Late */}
          <div className="flex flex-col p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent hover:border-amber-200 dark:hover:border-amber-500/30 transition-all duration-300 group">
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm font-medium text-[var(--color-text-muted)] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                {t('dashboard.late')}
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-sm shadow-amber-500/20 group-hover:scale-110 transition-transform">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[var(--color-text)]">
                {lateCount}
              </span>
            </div>
          </div>

          {/* Absent */}
          <div className="flex flex-col p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent hover:border-red-200 dark:hover:border-red-500/30 transition-all duration-300 group">
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm font-medium text-[var(--color-text-muted)] group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                {t('dashboard.absent')}
              </span>
              <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center text-white shadow-sm shadow-red-500/20 group-hover:scale-110 transition-transform">
                <UserX className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[var(--color-text)]">
                {absentCount}
              </span>
            </div>
          </div>

          {/* Total */}
          <div className="flex flex-col p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent hover:border-blue-200 dark:hover:border-blue-500/30 transition-all duration-300 group">
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm font-medium text-[var(--color-text-muted)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {t('dashboard.total')}
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 group-hover:scale-110 transition-transform">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[var(--color-text)]">
                {totalStudents}
              </span>
            </div>
          </div>
        </div>

        {/* Teacher Status - Sleek */}
        <div className={`
          relative overflow-hidden rounded-2xl p-4 border transition-all duration-300
          ${teacherPresent
            ? 'bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20'
            : 'bg-red-50/50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20'}
        `}>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center shadow-sm
                ${teacherPresent ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}
              `}>
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-[var(--color-text)] text-sm">
                  {t('dashboard.teacher')}
                </h4>
                <p className={`text-xs font-medium ${teacherPresent ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {teacherPresent ? t('dashboard.inClassroom') : t('dashboard.notInClassroom')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${teacherPresent ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className={`text-xs font-bold ${teacherPresent ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {teacherPresent ? t('status.present') : t('status.absent')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
