import { useTranslation } from 'react-i18next'
import {
  History,
  UserCheck,
  UserX,
  Clock,
  RotateCcw,
  GraduationCap,
  ChevronDown
} from 'lucide-react'
import { useState } from 'react'
import { useAttendanceStore, AttendanceNotification } from '../store/attendanceStore'

export interface EventLogProps {
  variant?: 'default' | 'sidebar'
  cameraId?: string
}

export function EventLog({ variant = 'default', cameraId }: EventLogProps) {
  const { t } = useTranslation()
  const { notifications: allNotifications } = useAttendanceStore()
  const [isExpanded, setIsExpanded] = useState(false)

  const isSidebar = variant === 'sidebar'

  // Filter notifications by camera if cameraId is provided
  const notifications = cameraId
    ? allNotifications.filter(n => n.cameraId === cameraId)
    : allNotifications

  const visibleCount = isExpanded ? notifications.length : 10

  const getEventIcon = (eventType: AttendanceNotification['eventType']) => {
    switch (eventType) {
      case 'entry':
        return <UserCheck className="w-4 h-4" />
      case 'exit':
        return <UserX className="w-4 h-4" />
      case 'late':
        return <Clock className="w-4 h-4" />
      case 'reentry':
        return <RotateCcw className="w-4 h-4" />
    }
  }

  const getEventColor = (color: AttendanceNotification['color']) => {
    switch (color) {
      case 'green':
        return {
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-400',
          border: 'border-emerald-500/20',
        }
      case 'yellow':
        return {
          bg: 'bg-amber-500/10',
          text: 'text-amber-400',
          border: 'border-amber-500/20',
        }
      case 'red':
        return {
          bg: 'bg-red-500/10',
          text: 'text-red-400',
          border: 'border-red-500/20',
        }
      case 'blue':
        return {
          bg: 'bg-sky-500/10',
          text: 'text-sky-400',
          border: 'border-sky-500/20',
        }
      default:
        return {
          bg: 'bg-gray-500/10',
          text: 'text-gray-400',
          border: 'border-gray-500/20',
        }
    }
  }

  const getEventMessage = (notification: AttendanceNotification) => {
    const isTeacher = notification.personRole === 'teacher'

    switch (notification.eventType) {
      case 'entry':
        return isTeacher ? t('notifications.teacherArrived') : t('notifications.onTime')
      case 'exit':
        return isTeacher ? t('notifications.teacherLeft') : t('notifications.left')
      case 'late':
        return notification.lateByMinutes
          ? t('notifications.lateBy', { minutes: notification.lateByMinutes })
          : t('notifications.late')
      case 'reentry':
        return t('notifications.returned')
    }
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  if (isSidebar) {
    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-3">
        <div className="flex items-center gap-2 text-slate-300 font-semibold border-b border-slate-700/50 pb-2">
          <History className="w-4 h-4 text-amber-400" />
          <span>{t('dashboard.recentEvents')}</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[200px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-slate-500 italic text-xs">
              {t('reports.noData')}
            </div>
          ) : (
            notifications.slice(0, visibleCount).map((notification) => {
              const colors = getEventColor(notification.color)
              return (
                <div key={notification.id} className="flex gap-2 p-2 bg-slate-800/30 rounded-lg border border-slate-700/30 text-[10px]">
                  <div className={`mt-0.5 min-w-[6px] w-1.5 h-1.5 rounded-full ${colors.bg.replace('/10', '')} ${colors.text}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-slate-300 truncate">{notification.personName}</span>
                      <span className="text-slate-500 text-[8px] whitespace-nowrap ml-1">{formatTime(notification.timestamp)}</span>
                    </div>
                    <p className="text-slate-400 truncate opacity-80">{getEventMessage(notification)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <History className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-text)]">
              {t('dashboard.recentEvents')}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {notifications.length} total events
            </p>
          </div>
        </div>
      </div>

      {/* Event List */}
      <div className="max-h-[300px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <History className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-[var(--color-text-muted)]">
              {t('reports.noData')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {notifications.slice(0, visibleCount).map((notification, index) => {
              const colors = getEventColor(notification.color)

              return (
                <div
                  key={notification.id}
                  className="px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  style={{
                    animationDelay: `${index * 30}ms`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>
                      {getEventIcon(notification.eventType)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {notification.personRole === 'teacher' && (
                          <GraduationCap className={`w-3.5 h-3.5 ${colors.text}`} />
                        )}
                        <span className="font-medium text-[var(--color-text)] truncate">
                          {notification.personName}
                        </span>
                      </div>
                      <p className={`text-sm ${colors.text}`}>
                        {getEventMessage(notification)}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <div className="text-right">
                      <span className="text-xs text-[var(--color-text-muted)] font-mono">
                        {formatTime(notification.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Show More Button */}
      {notifications.length > 10 && (
        <div className="px-5 py-3 border-t border-[var(--color-border)]">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <span>
              {isExpanded
                ? 'Show less'
                : `Show ${notifications.length - 10} more events`
              }
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}
    </div>
  )
}
