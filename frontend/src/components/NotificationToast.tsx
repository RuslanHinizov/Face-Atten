import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserCheck, UserX, Clock, RotateCcw, GraduationCap, User, AlertTriangle } from 'lucide-react'
import { AttendanceNotification } from '../store/attendanceStore'

interface NotificationToastProps {
  notification: AttendanceNotification
  onDismiss: (id: string) => void
  duration?: number
}

export function NotificationToast({ notification, onDismiss, duration = 4000 }: NotificationToastProps) {
  const { t } = useTranslation()
  const [isExiting, setIsExiting] = useState(false)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      
      if (remaining <= 0) {
        clearInterval(interval)
      }
    }, 50)

    const timeout = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onDismiss(notification.id), 300)
    }, duration)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [notification.id, onDismiss, duration])

  const getColorClasses = () => {
    switch (notification.color) {
      case 'green':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30',
          icon: 'bg-emerald-500/20 text-emerald-400',
          text: 'text-emerald-400',
          progress: 'bg-emerald-500',
        }
      case 'yellow':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30',
          icon: 'bg-amber-500/20 text-amber-400',
          text: 'text-amber-400',
          progress: 'bg-amber-500',
        }
      case 'red':
        return {
          bg: 'bg-red-500/10 border-red-500/30',
          icon: 'bg-red-500/20 text-red-400',
          text: 'text-red-400',
          progress: 'bg-red-500',
        }
      case 'blue':
        return {
          bg: 'bg-sky-500/10 border-sky-500/30',
          icon: 'bg-sky-500/20 text-sky-400',
          text: 'text-sky-400',
          progress: 'bg-sky-500',
        }
      case 'gray':
        return {
          bg: 'bg-slate-500/10 border-slate-500/30',
          icon: 'bg-slate-500/20 text-slate-400',
          text: 'text-slate-400',
          progress: 'bg-slate-500',
        }
      default:
        return {
          bg: 'bg-slate-500/10 border-slate-500/30',
          icon: 'bg-slate-500/20 text-slate-400',
          text: 'text-slate-400',
          progress: 'bg-slate-500',
        }
    }
  }

  const getIcon = () => {
    switch (notification.eventType) {
      case 'entry':
        return <UserCheck className="w-5 h-5" />
      case 'exit':
        return <UserX className="w-5 h-5" />
      case 'late':
        return <Clock className="w-5 h-5" />
      case 'reentry':
        return <RotateCcw className="w-5 h-5" />
      case 'unknown':
        return <AlertTriangle className="w-5 h-5" />
      default:
        return <User className="w-5 h-5" />
    }
  }

  const getMessage = () => {
    switch (notification.eventType) {
      case 'entry':
        return notification.personRole === 'teacher'
          ? t('notifications.teacherArrived')
          : t('notifications.onTime')
      case 'exit':
        return notification.personRole === 'teacher'
          ? t('notifications.teacherLeft')
          : t('notifications.left')
      case 'late':
        return notification.lateByMinutes
          ? t('notifications.lateBy', { minutes: notification.lateByMinutes })
          : t('notifications.late')
      case 'reentry':
        return t('notifications.returned')
      case 'unknown':
        return t('notifications.unknownPerson')
      default:
        return ''
    }
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const colors = getColorClasses()

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border backdrop-blur-sm
        ${colors.bg}
        transform transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-x-4 scale-95' : 'opacity-100 translate-x-0 scale-100'}
      `}
    >
      <div className="p-4 flex items-start gap-3">
        {/* Icon */}
        <div className={`p-2 rounded-lg ${colors.icon}`}>
          {getIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {notification.personRole === 'teacher' && (
              <GraduationCap className={`w-4 h-4 ${colors.text}`} />
            )}
            {notification.personRole === 'unknown' && (
              <AlertTriangle className={`w-4 h-4 ${colors.text}`} />
            )}
            <span className="font-semibold text-[var(--color-text)] truncate">
              {notification.personName}
            </span>
          </div>
          <p className={`text-sm ${colors.text} mt-0.5`}>
            {getMessage()}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {formatTime(notification.timestamp)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
        <div
          className={`h-full ${colors.progress} transition-all duration-100 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
