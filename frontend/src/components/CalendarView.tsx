import { memo, useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users } from 'lucide-react'
import { useAttendanceStore } from '../store/attendanceStore'

const TOTAL_STUDENTS = 38

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
const getFirstDayOfMonth = (year: number, month: number) => {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}
const toKey = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export const CalendarView = memo(() => {
  const { t } = useTranslation()
  const { attendanceRecords } = useAttendanceStore()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const monthNames = useMemo(() => t('calendar.monthNames', { returnObjects: true }) as string[], [t])
  const dayNames   = useMemo(() => t('calendar.dayNames',  { returnObjects: true }) as string[], [t])

  const daysInMonth    = useMemo(() => getDaysInMonth(year, month),    [year, month])
  const firstDayOfMonth = useMemo(() => getFirstDayOfMonth(year, month), [year, month])

  const today = useMemo(() => new Date(), [])
  const todayKey = useMemo(() => toKey(today.getFullYear(), today.getMonth(), today.getDate()), [today])

  // Build real attendance data: only today has real data
  const attendanceData = useMemo(() => {
    const data: Record<string, { present: number; late: number; absent: number; total: number }> = {}
    const students = attendanceRecords.filter(r => r.person.role === 'student')
    if (students.length === 0) return data

    data[todayKey] = {
      present: students.filter(r => r.status === 'present').length,
      late:    students.filter(r => r.status === 'late').length,
      absent:  students.filter(r => r.status === 'absent').length,
      total:   TOTAL_STUDENTS,
    }
    return data
  }, [attendanceRecords, todayKey])

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = []
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(d)
    while (days.length % 7 !== 0) days.push(null)
    return days
  }, [firstDayOfMonth, daysInMonth])

  const getDotColor = useCallback((day: number) => {
    const key = toKey(year, month, day)
    const d = attendanceData[key]
    if (!d || d.total === 0) return null
    const rate = ((d.present + d.late) / d.total) * 100
    if (rate >= 90) return 'bg-emerald-500'
    if (rate >= 70) return 'bg-amber-500'
    return 'bg-red-500'
  }, [attendanceData, year, month])

  const selectedData = useMemo(() => {
    if (!selectedDay) return null
    return attendanceData[toKey(year, month, selectedDay)] ?? null
  }, [selectedDay, attendanceData, year, month])

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{t('calendar.title')}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{t('calendar.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => { setCurrentDate(new Date()); setSelectedDay(null) }}
          className="btn btn-secondary text-sm"
        >
          {t('calendar.today')}
        </button>
      </div>

      {/* Month Nav */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-[var(--color-bg)] transition-colors">
          <ChevronLeft className="w-5 h-5 text-[var(--color-text-muted)]" />
        </button>
        <h3 className="text-xl font-bold text-[var(--color-text)]">{monthNames[month]} {year}</h3>
        <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-[var(--color-bg)] transition-colors">
          <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((d, i) => (
          <div key={i} className="text-center text-sm font-semibold text-[var(--color-text-muted)] py-2">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          if (day === null) return <div key={idx} className="aspect-square" />
          const key = toKey(year, month, day)
          const isToday = key === todayKey
          const dot = getDotColor(day)
          const isSelected = selectedDay === day
          const isWeekend = new Date(year, month, day).getDay() === 0 || new Date(year, month, day).getDay() === 6
          return (
            <button
              key={idx}
              onClick={() => setSelectedDay(selectedDay === day ? null : day)}
              className={`aspect-square flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all text-sm
                ${isToday    ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-[var(--color-surface)]' : ''}
                ${isSelected ? 'bg-blue-500/20' : 'hover:bg-[var(--color-bg)]'}
                ${isWeekend  ? 'opacity-40' : ''}
              `}
            >
              <span className={`font-semibold ${isToday ? 'text-blue-500' : 'text-[var(--color-text)]'}`}>{day}</span>
              {dot && <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
            </button>
          )
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="mt-4 p-4 bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)]">
          {selectedData ? (
            <div>
              <p className="font-semibold text-[var(--color-text)] mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                {selectedDay} {monthNames[month]} — нақты деректер
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 bg-emerald-500/10 rounded-xl">
                  <p className="text-xl font-black text-emerald-500">{selectedData.present}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Келді</p>
                </div>
                <div className="text-center p-2 bg-amber-500/10 rounded-xl">
                  <p className="text-xl font-black text-amber-500">{selectedData.late}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Кешікті</p>
                </div>
                <div className="text-center p-2 bg-red-500/10 rounded-xl">
                  <p className="text-xl font-black text-red-500">{selectedData.absent}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Келмеді</p>
                </div>
              </div>
              <div className="mt-3 h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                  style={{ width: `${Math.round(((selectedData.present + selectedData.late) / selectedData.total) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 text-right">
                {Math.round(((selectedData.present + selectedData.late) / selectedData.total) * 100)}% қатысу
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-2">
              Бұл күні деректер жоқ
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-xs text-[var(--color-text-muted)]">≥90%</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-xs text-[var(--color-text-muted)]">70–89%</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-xs text-[var(--color-text-muted)]">&lt;70%</span></div>
      </div>
    </div>
  )
})

CalendarView.displayName = 'CalendarView'
export default CalendarView
