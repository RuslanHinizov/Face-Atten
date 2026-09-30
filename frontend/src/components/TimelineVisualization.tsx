import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Clock,
  LogIn,
  LogOut,
  RotateCcw,
  GraduationCap,
  User,
} from 'lucide-react'
import { useAttendanceStore, AttendanceEvent } from '../store/attendanceStore'

interface TimelineEvent {
  id: string
  personId: string
  personName: string
  personRole: 'student' | 'teacher'
  eventType: 'entry' | 'exit' | 'reentry'
  timestamp: Date
}

export function TimelineVisualization() {
  const { t } = useTranslation()
  const { attendanceRecords, currentSession } = useAttendanceStore()

  // Flatten all events from all records into a single timeline
  const allEvents = useMemo(() => {
    const events: TimelineEvent[] = []

    attendanceRecords.forEach((record) => {
      record.events.forEach((event) => {
        events.push({
          id: event.id,
          personId: record.person.id,
          personName: record.person.name,
          personRole: record.person.role,
          eventType: event.eventType,
          timestamp: new Date(event.timestamp),
        })
      })
    })

    // Sort by timestamp
    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }, [attendanceRecords])

  // Group events by hour for better visualization
  const eventsByHour = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {}

    allEvents.forEach((event) => {
      const hour = event.timestamp.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }).split(':')[0] + ':00'

      if (!groups[hour]) {
        groups[hour] = []
      }
      groups[hour].push(event)
    })

    return groups
  }, [allEvents])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getEventIcon = (eventType: AttendanceEvent['eventType']) => {
    switch (eventType) {
      case 'entry':
        return <LogIn className="w-3.5 h-3.5" />
      case 'exit':
        return <LogOut className="w-3.5 h-3.5" />
      case 'reentry':
        return <RotateCcw className="w-3.5 h-3.5" />
    }
  }

  const getEventColor = (eventType: AttendanceEvent['eventType']) => {
    switch (eventType) {
      case 'entry':
        return {
          bg: 'bg-emerald-500',
          bgLight: 'bg-emerald-500/10',
          text: 'text-emerald-400',
          border: 'border-emerald-500/30',
        }
      case 'exit':
        return {
          bg: 'bg-red-500',
          bgLight: 'bg-red-500/10',
          text: 'text-red-400',
          border: 'border-red-500/30',
        }
      case 'reentry':
        return {
          bg: 'bg-sky-500',
          bgLight: 'bg-sky-500/10',
          text: 'text-sky-400',
          border: 'border-sky-500/30',
        }
    }
  }

  const getEventLabel = (eventType: AttendanceEvent['eventType']) => {
    switch (eventType) {
      case 'entry':
        return t('notifications.onTime')
      case 'exit':
        return t('notifications.left')
      case 'reentry':
        return t('notifications.returned')
    }
  }

  // Calculate session time range for the visual bar
  const sessionTimeRange = useMemo(() => {
    if (!currentSession) return null
    return {
      start: new Date(currentSession.startTime),
      end: new Date(currentSession.endTime),
    }
  }, [currentSession])

  // Calculate position percentage for an event on the timeline bar
  const getEventPosition = (timestamp: Date) => {
    if (!sessionTimeRange) return 0
    const totalDuration = sessionTimeRange.end.getTime() - sessionTimeRange.start.getTime()
    const eventOffset = timestamp.getTime() - sessionTimeRange.start.getTime()
    return Math.max(0, Math.min(100, (eventOffset / totalDuration) * 100))
  }

  if (allEvents.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-12 text-center">
        <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">
          {t('reports.timeline')}
        </h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          {t('reports.noData')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Visual Timeline Bar */}
      {sessionTimeRange && (
        <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <h4 className="font-semibold text-[var(--color-text)]">
              Session Overview
            </h4>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {formatTime(sessionTimeRange.start)} — {formatTime(sessionTimeRange.end)}
            </p>
          </div>

          <div className="p-5">
            {/* Timeline bar */}
            <div className="relative h-16 bg-[var(--color-bg)] rounded-xl border border-[var(--color-border)] overflow-hidden">
              {/* Session start marker */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500" />
              
              {/* Session end marker */}
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-violet-500" />

              {/* Event markers */}
              {allEvents.map((event) => {
                const position = getEventPosition(event.timestamp)
                const colors = getEventColor(event.eventType)
                
                return (
                  <div
                    key={event.id}
                    className="absolute top-1/2 -translate-y-1/2 group"
                    style={{ left: `${position}%` }}
                  >
                    <div
                      className={`w-3 h-3 rounded-full ${colors.bg} border-2 border-[var(--color-surface)] cursor-pointer transform transition-transform hover:scale-150`}
                    />
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <div className={`px-3 py-2 rounded-lg ${colors.bgLight} border ${colors.border} whitespace-nowrap`}>
                        <div className="flex items-center gap-2">
                          {event.personRole === 'teacher' ? (
                            <GraduationCap className={`w-3.5 h-3.5 ${colors.text}`} />
                          ) : (
                            <User className={`w-3.5 h-3.5 ${colors.text}`} />
                          )}
                          <span className="text-xs font-medium text-[var(--color-text)]">
                            {event.personName}
                          </span>
                        </div>
                        <div className={`text-xs ${colors.text} mt-1`}>
                          {getEventLabel(event.eventType)} • {formatTime(event.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs text-[var(--color-text-muted)]">Entry</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs text-[var(--color-text-muted)]">Exit</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-sky-500" />
                <span className="text-xs text-[var(--color-text-muted)]">Re-entry</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Event List */}
      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h4 className="font-semibold text-[var(--color-text)]">
            {t('reports.timeline')} ({allEvents.length} events)
          </h4>
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {Object.entries(eventsByHour).map(([hour, events]) => (
            <div key={hour}>
              {/* Hour header */}
              <div className="px-5 py-2 bg-[var(--color-bg)]/50 border-b border-[var(--color-border)] sticky top-0">
                <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                  {hour}
                </span>
              </div>

              {/* Events in this hour */}
              <div className="divide-y divide-[var(--color-border)]">
                {events.map((event) => {
                  const colors = getEventColor(event.eventType)
                  
                  return (
                    <div
                      key={event.id}
                      className="px-5 py-3 hover:bg-white/[0.02] transition-colors flex items-center gap-4"
                    >
                      {/* Time */}
                      <span className="text-sm font-mono text-[var(--color-text-muted)] w-20 flex-shrink-0">
                        {formatTime(event.timestamp)}
                      </span>

                      {/* Event icon */}
                      <div className={`p-2 rounded-lg ${colors.bgLight} ${colors.text}`}>
                        {getEventIcon(event.eventType)}
                      </div>

                      {/* Person info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {event.personRole === 'teacher' && (
                            <GraduationCap className="w-4 h-4 text-violet-400" />
                          )}
                          <span className="font-medium text-[var(--color-text)] truncate">
                            {event.personName}
                          </span>
                        </div>
                        <span className={`text-sm ${colors.text}`}>
                          {getEventLabel(event.eventType)}
                        </span>
                      </div>

                      {/* Role badge */}
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          event.personRole === 'teacher'
                            ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                            : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        }`}
                      >
                        {event.personRole === 'teacher' ? t('reports.teacher') : t('reports.students')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
