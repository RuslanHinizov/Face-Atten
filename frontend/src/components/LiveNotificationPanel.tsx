import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bell,
  UserCheck,
  UserX,
  Clock,
  AlertTriangle,
  X,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useAttendanceStore, type AttendanceNotification } from '../store/attendanceStore'
import { useSettingsStore } from '../store/settingsStore'

interface LiveNotificationPanelProps {
  maxNotifications?: number
  autoHide?: boolean
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'
}

export function LiveNotificationPanel({
  maxNotifications = 10,
  position = 'bottom-right'
}: LiveNotificationPanelProps) {
  const { t } = useTranslation()
  const { notifications, removeNotification, clearNotifications } = useAttendanceStore()
  const { soundEnabled, notificationsEnabled, soundVolume, setSoundEnabled } = useSettingsStore()
  const [isExpanded, setIsExpanded] = useState(true)
  const [newNotificationId, setNewNotificationId] = useState<string | null>(null)

  // Play sound on new notification - only if both sound and notifications are enabled
  useEffect(() => {
    if (notifications.length > 0 && soundEnabled && notificationsEnabled) {
      const latestNotification = notifications[0]
      if (latestNotification.id !== newNotificationId) {
        setNewNotificationId(latestNotification.id)
        playNotificationSound(latestNotification.eventType)
      }
    }
  }, [notifications, soundEnabled, notificationsEnabled, newNotificationId])

  const playNotificationSound = (eventType: string) => {
    // Don't play if sound or notifications are disabled
    if (!soundEnabled || !notificationsEnabled) return
    
    const audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Different sounds for different events
    switch (eventType) {
      case 'entry':
        oscillator.frequency.value = 800
        oscillator.type = 'sine'
        break
      case 'late':
        oscillator.frequency.value = 400
        oscillator.type = 'triangle'
        break
      case 'exit':
        oscillator.frequency.value = 600
        oscillator.type = 'sine'
        break
      case 'unknown':
        oscillator.frequency.value = 300
        oscillator.type = 'sawtooth'
        break
      default:
        oscillator.frequency.value = 700
        oscillator.type = 'sine'
    }

    // Use volume from settings
    const volume = soundVolume * 0.2 // Scale down for comfort
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
  }

  const getNotificationIcon = (eventType: string) => {
    switch (eventType) {
      case 'entry':
        return <UserCheck className="w-4 h-4 text-emerald-500" />
      case 'late':
        return <Clock className="w-4 h-4 text-amber-500" />
      case 'exit':
        return <UserX className="w-4 h-4 text-blue-500" />
      case 'unknown':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      default:
        return <Bell className="w-4 h-4 text-gray-500" />
    }
  }

  const getNotificationColor = (color: string) => {
    switch (color) {
      case 'green':
        return 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
      case 'yellow':
        return 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/20'
      case 'red':
        return 'border-l-red-500 bg-red-50 dark:bg-red-900/20'
      case 'blue':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20'
      default:
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/20'
    }
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('kk-KZ', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getEventText = (notification: AttendanceNotification) => {
    const { eventType, lateByMinutes } = notification
    switch (eventType) {
      case 'entry':
        return t('notifications.entered')
      case 'late':
        return `${t('notifications.late')} (${lateByMinutes} ${t('notifications.minutes')})`
      case 'exit':
        return t('notifications.exited')
      case 'unknown':
        return t('notifications.unknown')
      default:
        return eventType
    }
  }

  const positionClasses = {
    'top-right': 'top-20 right-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-20 left-4',
    'bottom-left': 'bottom-4 left-4'
  }

  const displayedNotifications = notifications.slice(0, maxNotifications)

  // Don't render if notifications are disabled in settings
  if (!notificationsEnabled) {
    return null
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-40 w-80`}>
      {/* Header */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-t-xl shadow-lg">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell className="w-5 h-5 text-[var(--color-primary)]" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </div>
            <span className="font-semibold text-[var(--color-text)]">
              {t('notifications.liveUpdates')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-lg hover:bg-[var(--color-bg)] transition-colors"
              title={soundEnabled ? t('notifications.muteSound') : t('notifications.enableSound')}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[var(--color-text-muted)]" />
              ) : (
                <VolumeX className="w-4 h-4 text-red-400" />
              )}
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg hover:bg-[var(--color-bg)] transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
              ) : (
                <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      {isExpanded && (
        <div className="bg-[var(--color-surface)] border-x border-b border-[var(--color-border)] rounded-b-xl shadow-lg max-h-96 overflow-y-auto">
          {displayedNotifications.length === 0 ? (
            <div className="p-6 text-center text-[var(--color-text-muted)]">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('notifications.noNotifications')}</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-[var(--color-border)]">
                {displayedNotifications.map((notification, index) => (
                  <div
                    key={notification.id}
                    className={`p-3 border-l-4 ${getNotificationColor(notification.color)} ${
                      index === 0 ? 'animate-pulse-once' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {getNotificationIcon(notification.eventType)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-[var(--color-text)] truncate">
                            {notification.personName}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {getEventText(notification)}
                          </p>
                          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                            {formatTime(notification.timestamp)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeNotification(notification.id)}
                        className="p-1 rounded hover:bg-black/10 transition-colors"
                      >
                        <X className="w-3 h-3 text-[var(--color-text-muted)]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {notifications.length > 0 && (
                <div className="p-2 border-t border-[var(--color-border)]">
                  <button
                    onClick={clearNotifications}
                    className="w-full py-2 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] rounded-lg transition-colors"
                  >
                    {t('notifications.clearAll')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
