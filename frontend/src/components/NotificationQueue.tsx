import { useTranslation } from 'react-i18next'
import { Bell, X } from 'lucide-react'
import { NotificationToast } from './NotificationToast'
import { useAttendanceStore } from '../store/attendanceStore'

export function NotificationQueue() {
  const { t } = useTranslation()
  const { notifications, removeNotification, clearNotifications } = useAttendanceStore()

  // Show only the most recent 5 notifications in the queue
  const visibleNotifications = notifications.slice(0, 5)

  return (
    <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/10">
            <Bell className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-text)]">
              {t('dashboard.recentEvents')}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {notifications.length} {notifications.length === 1 ? 'event' : 'events'}
            </p>
          </div>
        </div>
        
        {notifications.length > 0 && (
          <button
            onClick={clearNotifications}
            className="p-2 rounded-lg hover:bg-white/5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            title={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {visibleNotifications.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-[var(--color-text-muted)]">
              {t('reports.noData')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleNotifications.map((notification, index) => (
              <div
                key={notification.id}
                className="animate-in slide-in-from-right duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <NotificationToast
                  notification={notification}
                  onDismiss={removeNotification}
                  duration={5000}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer - Show more indicator */}
      {notifications.length > 5 && (
        <div className="px-5 py-3 border-t border-[var(--color-border)] bg-white/[0.02]">
          <p className="text-xs text-center text-[var(--color-text-muted)]">
            +{notifications.length - 5} more events
          </p>
        </div>
      )}
    </div>
  )
}
