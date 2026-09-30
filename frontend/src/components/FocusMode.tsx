import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Focus, UserX, Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { useAttendanceStore, Person } from '../store/attendanceStore'

interface MissingStudent {
  person: Person
  expectedSince: Date
  minutesLate: number
}

export function FocusMode() {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)
  const [isFocusModeActive, setIsFocusModeActive] = useState(false)
  
  const { currentSession, attendanceRecords } = useAttendanceStore()

  const missingStudents = useMemo((): MissingStudent[] => {
    if (!currentSession) return []

    const now = new Date()
    const sessionStart = new Date(currentSession.startTime)
    
    // Get IDs of students who have arrived (present or late)
    const arrivedStudentIds = new Set(
      attendanceRecords
        .filter(r => r.person.role === 'student' && r.status !== 'absent')
        .map(r => r.person.id)
    )

    // Find students who haven't arrived yet
    const missing: MissingStudent[] = []
    
    // We need to get person info from somewhere - for now we'll use the attendance records
    // In a real app, you'd fetch the full student list from the API
    currentSession.studentIds.forEach(studentId => {
      if (!arrivedStudentIds.has(studentId)) {
        // Find if we have any record for this student (even if absent)
        const record = attendanceRecords.find(r => r.person.id === studentId)
        
        if (record) {
          const minutesLate = Math.max(0, Math.floor((now.getTime() - sessionStart.getTime()) / 60000))
          missing.push({
            person: record.person,
            expectedSince: sessionStart,
            minutesLate,
          })
        }
      }
    })

    // Sort by minutes late (most late first)
    return missing.sort((a, b) => b.minutesLate - a.minutesLate)
  }, [currentSession, attendanceRecords])

  const urgencyLevel = useMemo(() => {
    if (missingStudents.length === 0) return 'none'
    const maxLate = Math.max(...missingStudents.map(s => s.minutesLate))
    if (maxLate > 15) return 'critical'
    if (maxLate > 10) return 'warning'
    return 'normal'
  }, [missingStudents])

  const getUrgencyStyles = () => {
    switch (urgencyLevel) {
      case 'critical':
        return {
          border: 'border-red-500/30',
          bg: 'bg-red-500/5',
          icon: 'text-red-400',
          badge: 'bg-red-500/20 text-red-400',
        }
      case 'warning':
        return {
          border: 'border-amber-500/30',
          bg: 'bg-amber-500/5',
          icon: 'text-amber-400',
          badge: 'bg-amber-500/20 text-amber-400',
        }
      default:
        return {
          border: 'border-sky-500/30',
          bg: 'bg-sky-500/5',
          icon: 'text-sky-400',
          badge: 'bg-sky-500/20 text-sky-400',
        }
    }
  }

  const styles = getUrgencyStyles()

  if (!currentSession || missingStudents.length === 0) {
    return null
  }

  return (
    <div className={`rounded-2xl border ${styles.border} ${styles.bg} overflow-hidden transition-all duration-300`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${styles.bg}`}>
            <Focus className={`w-5 h-5 ${styles.icon}`} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-[var(--color-text)]">
              {t('focusMode.title')}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {t('focusMode.missingCount', { count: missingStudents.length })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {urgencyLevel === 'critical' && (
            <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
          )}
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles.badge}`}>
            {missingStudents.length}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-3">
          {/* Focus Mode Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
            <span className="text-sm text-[var(--color-text)]">
              {t('focusMode.highlightMissing')}
            </span>
            <button
              onClick={() => setIsFocusModeActive(!isFocusModeActive)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isFocusModeActive ? 'bg-sky-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  isFocusModeActive ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Missing Students List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {missingStudents.map((student) => (
              <div
                key={student.person.id}
                className={`p-3 rounded-xl border transition-all ${
                  isFocusModeActive
                    ? student.minutesLate > 15
                      ? 'bg-red-500/10 border-red-500/30 animate-pulse'
                      : student.minutesLate > 10
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-sky-500/10 border-sky-500/30'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {student.person.photoUrl ? (
                      <img
                        src={student.person.photoUrl}
                        alt={student.person.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                        <UserX className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-[var(--color-text)]">
                        {student.person.name}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {t('focusMode.expectedAt', {
                          time: student.expectedSince.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${
                      student.minutesLate > 15
                        ? 'text-red-400'
                        : student.minutesLate > 10
                        ? 'text-amber-400'
                        : 'text-sky-400'
                    }`} />
                    <span className={`text-sm font-medium ${
                      student.minutesLate > 15
                        ? 'text-red-400'
                        : student.minutesLate > 10
                        ? 'text-amber-400'
                        : 'text-sky-400'
                    }`}>
                      +{student.minutesLate} {t('common.minutes')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
