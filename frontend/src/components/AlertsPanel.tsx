import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Clock,
  UserX,
  TrendingDown,
  User,
  CheckCircle,
  Users,
} from 'lucide-react'
import { useAttendanceStore } from '../store/attendanceStore'

interface Alert {
  id: string
  type: 'chronic_late' | 'chronic_absent' | 'attendance_drop' | 'group_low'
  severity: 'warning' | 'critical' | 'info'
  personName?: string
  group?: string
  message: string
  details: string
}

const GROUPS = [
  { id: '418', name: 'ИП-21', total: 19 },
  { id: '428', name: 'СТ-21', total: 19 },
]

export function AlertsPanel() {
  const { t } = useTranslation()
  const { attendanceRecords } = useAttendanceStore()

  const alerts = useMemo(() => {
    const list: Alert[] = []
    const students = attendanceRecords.filter(r => r.person.role === 'student')

    // 1. Кешіккен студенттер (барлығы)
    const lateStudents = students.filter(r => r.status === 'late')
    lateStudents.forEach(r => {
      const mins = r.lateByMinutes ?? 0
      list.push({
        id: `late-${r.person.id}`,
        type: 'chronic_late',
        severity: mins >= 20 ? 'critical' : 'warning',
        personName: r.person.name,
        group: (r.person as any).group,
        message: t('analytics.chronicLate') || 'Кешікті',
        details: mins > 0
          ? `${mins} минут кешікті`
          : 'Сабақ басталғаннан кейін келді',
      })
    })

    // 2. Келмеген студенттер (барлығы)
    const absentStudents = students.filter(r => r.status === 'absent')
    absentStudents.forEach(r => {
      list.push({
        id: `absent-${r.person.id}`,
        type: 'chronic_absent',
        severity: 'critical',
        personName: r.person.name,
        group: (r.person as any).group,
        message: t('analytics.chronicAbsent') || 'Келмеді',
        details: 'Бүгінгі сабаққа қатыспады',
      })
    })

    // 3. Топ бойынша қатысу төмен болса
    GROUPS.forEach(g => {
      const groupName = g.id === '418' ? 'ИП-21' : 'СТ-21'
      const groupRecords = students.filter(r => (r.person as any).group === groupName)
      const attended = groupRecords.filter(r => r.status !== 'absent').length
      const rate = g.total > 0 ? Math.round((attended / g.total) * 100) : 100

      if (rate < 70) {
        list.push({
          id: `group-low-${g.id}`,
          type: 'group_low',
          severity: 'critical',
          group: groupName,
          message: `${groupName} — қатысу төмен`,
          details: `Қатысу деңгейі: ${rate}% (${attended}/${g.total} студент)`,
        })
      }
    })

    // 4. Жалпы қатысу төмен болса
    const totalAll = GROUPS.reduce((s, g) => s + g.total, 0)
    const attendedAll = students.filter(r => r.status !== 'absent').length
    const overallRate = totalAll > 0 ? Math.round((attendedAll / totalAll) * 100) : 100

    if (overallRate < 60) {
      list.push({
        id: 'overall-drop',
        type: 'attendance_drop',
        severity: 'critical',
        message: t('analytics.attendanceDrop') || 'Жалпы қатысу күрт төмендеді',
        details: `Жалпы қатысу: ${overallRate}% — норма 70%`,
      })
    }

    return list
  }, [attendanceRecords, t])

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'chronic_late':    return <Clock className="w-5 h-5" />
      case 'chronic_absent':  return <UserX className="w-5 h-5" />
      case 'attendance_drop': return <TrendingDown className="w-5 h-5" />
      case 'group_low':       return <Users className="w-5 h-5" />
    }
  }

  const getColors = (severity: Alert['severity']) => {
    switch (severity) {
      case 'warning':  return { bg: 'bg-amber-500/5', border: 'border-amber-500/20', icon: 'bg-amber-500/10 text-amber-400', badge: 'bg-amber-500/20 text-amber-400' }
      case 'critical': return { bg: 'bg-red-500/5',   border: 'border-red-500/20',   icon: 'bg-red-500/10 text-red-400',     badge: 'bg-red-500/20 text-red-400' }
      case 'info':     return { bg: 'bg-blue-500/5',  border: 'border-blue-500/20',  icon: 'bg-blue-500/10 text-blue-400',   badge: 'bg-blue-500/20 text-blue-400' }
    }
  }

  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const warningCount  = alerts.filter(a => a.severity === 'warning').length

  return (
    <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-text)]">
              {t('analytics.alerts') || 'Ескертулер'}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {alerts.length > 0 ? `${alerts.length} белсенді ескерту` : 'Барлығы жақсы'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              {criticalCount} сыни
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {warningCount} ескерту
            </span>
          )}
        </div>
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-[var(--color-text)]">
              Ескерту жоқ
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Қатысу деңгейі қалыпты
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {alerts.map(alert => {
              const colors = getColors(alert.severity)
              return (
                <div key={alert.id} className={`p-4 ${colors.bg} hover:bg-white/[0.02] transition-colors`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${colors.icon} flex-shrink-0`}>
                      {getAlertIcon(alert.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-sm font-semibold ${colors.icon.split(' ')[1]}`}>
                          {alert.message}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded ${colors.badge}`}>
                          {alert.severity === 'critical' ? 'сыни' : 'ескерту'}
                        </span>
                        {alert.group && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[var(--color-border)] text-[var(--color-text-muted)]">
                            {alert.group}
                          </span>
                        )}
                      </div>

                      {alert.personName && (
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                          <span className="text-sm text-[var(--color-text)]">{alert.personName}</span>
                        </div>
                      )}

                      <p className="text-xs text-[var(--color-text-muted)]">{alert.details}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg)]/50">
          <p className="text-xs text-[var(--color-text-muted)] text-center">
            Нақты деректер негізінде • {new Date().toLocaleTimeString('kk-KZ', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  )
}
