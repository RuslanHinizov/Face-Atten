import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  TrendingUp,
  Activity,
  Zap,
  Target,
  Award,
  AlertCircle,
  CheckCircle,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { useAttendanceStore } from '../store/attendanceStore'

export function LiveCounterWidget() {
  const { t } = useTranslation()
  const { attendanceRecords, totalStudents } = useAttendanceStore()
  const [animatedCount, setAnimatedCount] = useState(0)

  const presentCount = attendanceRecords.filter(
    r => r.person.role === 'student' && (r.status === 'present' || r.status === 'late')
  ).length

  useEffect(() => {
    const duration = 1000
    const steps = 20
    const increment = presentCount / steps
    let current = 0

    const timer = setInterval(() => {
      current += increment
      if (current >= presentCount) {
        setAnimatedCount(presentCount)
        clearInterval(timer)
      } else {
        setAnimatedCount(Math.floor(current))
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [presentCount])

  const percentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0

  return (
    <div className="relative overflow-hidden rounded-2xl gradient-primary p-6 text-white shadow-xl shadow-blue-500/25">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            <span className="font-medium">{t('widgets.liveAttendance')}</span>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 bg-white/20 rounded-full backdrop-blur-sm">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs font-bold">{t('widgets.live')}</span>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-5xl font-black">{animatedCount}</p>
            <p className="text-white/70 text-sm mt-1">
              {t('widgets.of')} {totalStudents} {t('widgets.students')}
            </p>
          </div>
          <div className="text-right">
            <div className="w-20 h-20 relative">
              <svg className="w-full h-full -rotate-90">
                <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
                <circle cx="40" cy="40" r="36" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${percentage * 2.26} 226`} className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold">{percentage}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function QuickStatsWidget() {
  const { t } = useTranslation()
  const { attendanceRecords, totalStudents } = useAttendanceStore()

  const presentAndLate = attendanceRecords.filter(
    r => r.person.role === 'student' && (r.status === 'present' || r.status === 'late')
  ).length

  const stats = {
    present: attendanceRecords.filter(r => r.person.role === 'student' && r.status === 'present').length,
    late: attendanceRecords.filter(r => r.person.role === 'student' && r.status === 'late').length,
    absent: Math.max(0, totalStudents - presentAndLate)
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="card p-4 border-l-4 border-l-emerald-500">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.present}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{t('widgets.present')}</p>
          </div>
        </div>
      </div>
      <div className="card p-4 border-l-4 border-l-amber-500">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.late}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{t('widgets.late')}</p>
          </div>
        </div>
      </div>
      <div className="card p-4 border-l-4 border-l-red-500">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <UserX className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.absent}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{t('widgets.absent')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TodaySummaryWidget() {
  const { t } = useTranslation()
  const { currentSession, attendanceRecords, isTeacherPresent } = useAttendanceStore()

  const sessionDuration = currentSession
    ? Math.round((Date.now() - new Date(currentSession.startTime).getTime()) / 60000)
    : 0

  const avgEntryTime = attendanceRecords.length > 0
    ? new Date(
        attendanceRecords.reduce((sum, r) => sum + (r.firstEntry?.getTime() || 0), 0) / attendanceRecords.length
      ).toLocaleTimeString('kk-KZ', { hour: '2-digit', minute: '2-digit' })
    : '--:--'

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold text-[var(--color-text)]">{t('widgets.todaySummary')}</h3>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-text-muted)]">{t('widgets.sessionDuration')}</span>
          <span className="font-semibold text-[var(--color-text)]">{sessionDuration} {t('widgets.min')}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-text-muted)]">{t('widgets.avgEntryTime')}</span>
          <span className="font-semibold text-[var(--color-text)]">{avgEntryTime}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-text-muted)]">{t('widgets.teacherStatus')}</span>
          <span className={`flex items-center gap-1 font-semibold ${isTeacherPresent() ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {isTeacherPresent() ? (
              <><CheckCircle className="w-4 h-4" />{t('widgets.present')}</>
            ) : (
              <><AlertCircle className="w-4 h-4" />{t('widgets.absent')}</>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

export function PerformanceTrendWidget() {
  const { t } = useTranslation()
  const trend = { current: 92, previous: 88, change: 4, isPositive: true }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
          <h3 className="font-semibold text-[var(--color-text)]">{t('widgets.weeklyTrend')}</h3>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
          trend.isPositive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
        }`}>
          {trend.isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          {trend.change}%
        </div>
      </div>
      <div className="flex items-end gap-2 h-24">
        {[65, 72, 68, 85, 78, 88, 92].map((value, index) => (
          <div key={index} className="flex-1 flex flex-col items-center gap-1">
            <div className={`w-full rounded-t transition-all ${index === 6 ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`}
              style={{ height: `${value}%` }} />
            <span className="text-[10px] text-[var(--color-text-muted)]">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AchievementWidget() {
  const { t } = useTranslation()
  const achievements = [
    { icon: Target, label: t('widgets.perfectWeek'), progress: 85, color: 'indigo' },
    { icon: Award, label: t('widgets.topAttendance'), progress: 100, color: 'amber' },
    { icon: Zap, label: t('widgets.earlyBird'), progress: 60, color: 'emerald' },
  ]

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; bar: string }> = {
      indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', bar: 'bg-indigo-500' },
      amber: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' },
      emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
    }
    return colors[color] || colors.indigo
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Award className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold text-[var(--color-text)]">{t('widgets.achievements')}</h3>
      </div>
      <div className="space-y-3">
        {achievements.map((achievement, index) => {
          const colors = getColorClasses(achievement.color)
          return (
            <div key={index} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
                <achievement.icon className={`w-4 h-4 ${colors.text}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-[var(--color-text)]">{achievement.label}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{achievement.progress}%</span>
                </div>
                <div className="h-1.5 bg-[var(--color-bg)] rounded-full overflow-hidden">
                  <div className={`h-full ${colors.bar} rounded-full transition-all`} style={{ width: `${achievement.progress}%` }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function RecentActivityWidget() {
  const { t } = useTranslation()
  const { notifications } = useAttendanceStore()
  const recentNotifications = notifications.slice(0, 5)

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'entry': return <UserCheck className="w-3 h-3 text-emerald-500" />
      case 'late': return <Clock className="w-3 h-3 text-amber-500" />
      case 'exit': return <UserX className="w-3 h-3 text-blue-500" />
      default: return <Users className="w-3 h-3 text-[var(--color-text-muted)]" />
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-[var(--color-text)]">{t('widgets.recentActivity')}</h3>
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">{t('widgets.last5')}</span>
      </div>
      <div className="space-y-2">
        {recentNotifications.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-4">{t('widgets.noActivity')}</p>
        ) : (
          recentNotifications.map((notification) => (
            <div key={notification.id} className="flex items-center gap-2 p-2 bg-[var(--color-bg)] rounded-lg">
              {getEventIcon(notification.eventType)}
              <span className="flex-1 text-sm text-[var(--color-text)] truncate">{notification.personName}</span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {new Date(notification.timestamp).toLocaleTimeString('kk-KZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
