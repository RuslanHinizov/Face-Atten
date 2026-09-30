import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GraduationCap,
  Clock,
  LogIn,
  LogOut,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  User,
} from 'lucide-react'
import { useAttendanceStore, AttendanceEvent } from '../store/attendanceStore'

export function TeacherAttendance() {
  const { t } = useTranslation()
  const { attendanceRecords } = useAttendanceStore()

  const teacherRecord = useMemo(() => {
    return attendanceRecords.find((r) => r.person.role === 'teacher')
  }, [attendanceRecords])

  const formatTime = (date: Date | undefined) => {
    if (!date) return '—'
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
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

  // Calculate extended absences (> 5 minutes)
  const extendedAbsences = useMemo(() => {
    if (!teacherRecord) return []

    const absences: { start: Date; end: Date; duration: number }[] = []
    const events = [...teacherRecord.events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    let lastExit: Date | null = null

    for (const event of events) {
      if (event.eventType === 'exit') {
        lastExit = new Date(event.timestamp)
      } else if ((event.eventType === 'entry' || event.eventType === 'reentry') && lastExit) {
        const duration = (new Date(event.timestamp).getTime() - lastExit.getTime()) / 60000
        if (duration > 5) {
          absences.push({
            start: lastExit,
            end: new Date(event.timestamp),
            duration,
          })
        }
        lastExit = null
      }
    }

    return absences
  }, [teacherRecord])

  const getEventIcon = (eventType: AttendanceEvent['eventType']) => {
    switch (eventType) {
      case 'entry':
        return <LogIn className="w-4 h-4" />
      case 'exit':
        return <LogOut className="w-4 h-4" />
      case 'reentry':
        return <RotateCcw className="w-4 h-4" />
    }
  }

  const getEventColor = (eventType: AttendanceEvent['eventType']) => {
    switch (eventType) {
      case 'entry':
        return {
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-400',
          border: 'border-emerald-500/20',
        }
      case 'exit':
        return {
          bg: 'bg-red-500/10',
          text: 'text-red-400',
          border: 'border-red-500/20',
        }
      case 'reentry':
        return {
          bg: 'bg-sky-500/10',
          text: 'text-sky-400',
          border: 'border-sky-500/20',
        }
    }
  }

  const getEventLabel = (eventType: AttendanceEvent['eventType']) => {
    switch (eventType) {
      case 'entry':
        return t('notifications.teacherArrived')
      case 'exit':
        return t('notifications.teacherLeft')
      case 'reentry':
        return t('notifications.returned')
    }
  }

  // Check if teacher is currently present
  const isCurrentlyPresent = useMemo(() => {
    if (!teacherRecord || teacherRecord.events.length === 0) return false
    const lastEvent = teacherRecord.events[teacherRecord.events.length - 1]
    return lastEvent.eventType !== 'exit'
  }, [teacherRecord])

  if (!teacherRecord) {
    return (
      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-12 text-center">
        <GraduationCap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">
          {t('reports.teacher')}
        </h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          {t('reports.noData')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Teacher Info Card */}
      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
              {teacherRecord.person.photoUrl ? (
                <img
                  src={teacherRecord.person.photoUrl}
                  alt={teacherRecord.person.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-violet-400" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-semibold text-[var(--color-text)]">
                  {teacherRecord.person.name}
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    isCurrentlyPresent
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {isCurrentlyPresent ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      {t('dashboard.teacherPresent')}
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3" />
                      {t('dashboard.teacherAbsent')}
                    </>
                  )}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                  <div className="flex items-center gap-2 mb-1">
                    <LogIn className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {t('reports.entryTime')}
                    </span>
                  </div>
                  <span className="text-lg font-semibold text-[var(--color-text)] font-mono">
                    {formatTime(teacherRecord.firstEntry)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-sky-400" />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {t('reports.totalTime')}
                    </span>
                  </div>
                  <span className="text-lg font-semibold text-[var(--color-text)]">
                    {formatDuration(teacherRecord.totalTimeMinutes)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      Extended Absences
                    </span>
                  </div>
                  <span className="text-lg font-semibold text-[var(--color-text)]">
                    {extendedAbsences.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Timeline */}
      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h4 className="font-semibold text-[var(--color-text)]">
            {t('reports.timeline')}
          </h4>
        </div>

        <div className="p-5">
          {teacherRecord.events.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
              {t('reports.noData')}
            </p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-[var(--color-border)]" />

              <div className="space-y-4">
                {[...teacherRecord.events]
                  .sort(
                    (a, b) =>
                      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  )
                  .map((event) => {
                    const colors = getEventColor(event.eventType)
                    return (
                      <div key={event.id} className="relative flex items-start gap-4 pl-10">
                        {/* Timeline dot */}
                        <div
                          className={`absolute left-3 w-4 h-4 rounded-full ${colors.bg} border-2 ${colors.border} flex items-center justify-center`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${colors.text.replace('text-', 'bg-')}`} />
                        </div>

                        {/* Event card */}
                        <div
                          className={`flex-1 p-3 rounded-xl ${colors.bg} border ${colors.border}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={colors.text}>{getEventIcon(event.eventType)}</span>
                              <span className={`text-sm font-medium ${colors.text}`}>
                                {getEventLabel(event.eventType)}
                              </span>
                            </div>
                            <span className="text-xs text-[var(--color-text-muted)] font-mono">
                              {formatTime(event.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Extended Absences Warning */}
      {extendedAbsences.length > 0 && (
        <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-500/20 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h4 className="font-semibold text-amber-400">
              Extended Absences ({'>'}5 min)
            </h4>
          </div>

          <div className="p-5 space-y-3">
            {extendedAbsences.map((absence, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/10"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {formatTime(absence.start)} → {formatTime(absence.end)}
                  </span>
                </div>
                <span className="text-sm font-medium text-amber-400">
                  {Math.round(absence.duration)} {t('common.minutes')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
