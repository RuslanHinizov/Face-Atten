import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Flame } from 'lucide-react'
import { useAttendanceStore } from '../store/attendanceStore'

// Lesson time slots (start hour)
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16]
const DAYS  = [0, 1, 2, 3, 4] // Mon–Fri only

const getHeatLevel = (value: number, max: number): number => {
  if (max === 0 || value === 0) return 0
  const r = value / max
  if (r <= 0.2) return 1
  if (r <= 0.4) return 2
  if (r <= 0.6) return 3
  if (r <= 0.8) return 4
  return 5
}

const HeatCell = memo(({ value, level, hour, dayName, isTop }: {
  value: number; level: number; hour: number; dayName: string; isTop?: boolean
}) => {
  const pos = isTop ? 'top-full mt-2' : 'bottom-full mb-2'
  return (
    <div className={`group relative w-full aspect-square rounded-lg cursor-pointer transition-all duration-200 hover:scale-110 hover:z-10 heat-${level}`}>
      {value > 0 && (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[var(--color-text)]">
          {value}
        </span>
      )}
      <div className={`absolute ${pos} left-1/2 -translate-x-1/2 px-3 py-2 bg-[var(--color-surface-elevated)] rounded-lg shadow-xl border border-[var(--color-border)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20`}>
        <p className="text-sm font-semibold text-[var(--color-text)]">{dayName} {hour}:00–{hour + 1}:00</p>
        <p className="text-xs text-[var(--color-text-muted)]">{value} келмеді</p>
      </div>
    </div>
  )
})
HeatCell.displayName = 'HeatCell'

export const AttendanceHeatMap = memo(() => {
  const { t } = useTranslation()
  const { attendanceRecords } = useAttendanceStore()

  const dayNames = useMemo(() => t('calendar.dayNames', { returnObjects: true }) as string[], [t])

  // Today's day index (0=Mon … 4=Fri)
  const todayIndex = useMemo(() => {
    const d = new Date().getDay()
    return d === 0 ? 6 : d - 1 // Sun→6, Mon→0
  }, [])

  // Build heatmap: absent students mapped to the hour they *should* have arrived (08:30 → hour 8)
  // Present/late students mapped to the hour they actually arrived
  const heatMapData = useMemo<Record<string, number>>(() => {
    const data: Record<string, number> = {}
    const students = attendanceRecords.filter(r => r.person.role === 'student')
    if (students.length === 0) return data

    students.forEach(r => {
      if (r.status === 'absent') {
        // Absent → mark 08:00 slot of today as +1 missed
        const key = `8-${todayIndex}`
        data[key] = (data[key] ?? 0) + 1
      } else if (r.firstEntry) {
        // Present/late → mark their actual arrival hour
        const h = new Date(r.firstEntry).getHours()
        const clampedH = Math.min(Math.max(h, 8), 16) // keep within grid
        const key = `${clampedH}-${todayIndex}`
        data[key] = (data[key] ?? 0) + 1
      }
    })

    return data
  }, [attendanceRecords, todayIndex])

  const maxValue = useMemo(() => Math.max(...Object.values(heatMapData), 1), [heatMapData])

  // Stats for today
  const todayStats = useMemo(() => {
    const s = attendanceRecords.filter(r => r.person.role === 'student')
    return {
      present: s.filter(r => r.status === 'present').length,
      late:    s.filter(r => r.status === 'late').length,
      absent:  s.filter(r => r.status === 'absent').length,
    }
  }, [attendanceRecords])

  const hasData = Object.keys(heatMapData).length > 0

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Flame className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{t('heatmap.title')}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{t('heatmap.subtitle')}</p>
          </div>
        </div>

        {/* Today stats pill */}
        {hasData && (
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-semibold">{todayStats.present} келді</span>
            <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-semibold">{todayStats.late} кешікті</span>
            <span className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 font-semibold">{todayStats.absent} келмеді</span>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="py-16 text-center">
          <Flame className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3 opacity-30" />
          <p className="text-sm text-[var(--color-text-muted)]">Деректер жоқ</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Камера жұмыс істегенде деректер пайда болады</p>
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              {/* Hour headers */}
              <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `56px repeat(${HOURS.length}, 1fr)` }}>
                <div />
                {HOURS.map(h => (
                  <div key={h} className="text-center text-xs font-semibold text-[var(--color-text-muted)] py-1">{h}:00</div>
                ))}
              </div>

              {/* Rows */}
              {DAYS.map((day, dayIdx) => (
                <div key={day} className={`grid gap-1 mb-1 ${dayIdx === todayIndex ? 'opacity-100' : 'opacity-40'}`}
                  style={{ gridTemplateColumns: `56px repeat(${HOURS.length}, 1fr)` }}>
                  <div className="flex items-center text-xs font-semibold text-[var(--color-text-muted)] pr-2">
                    <span className={dayIdx === todayIndex ? 'text-emerald-400' : ''}>{dayNames[dayIdx]}</span>
                    {dayIdx === todayIndex && (
                      <span className="ml-1 px-1 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] rounded">бүгін</span>
                    )}
                  </div>
                  {HOURS.map(hour => {
                    const key   = `${hour}-${day}`
                    const value = heatMapData[key] ?? 0
                    const level = getHeatLevel(value, maxValue)
                    return (
                      <HeatCell
                        key={key}
                        value={value}
                        level={level}
                        hour={hour}
                        dayName={dayNames[dayIdx]}
                        isTop={dayIdx === 0}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-border)]">
            <span className="text-xs text-[var(--color-text-muted)]">{t('heatmap.lowAbsence')}</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5].map(lvl => (
                <div key={lvl} className={`w-6 h-6 rounded heat-${lvl} border border-[var(--color-border)]`} />
              ))}
            </div>
            <span className="text-xs text-[var(--color-text-muted)]">{t('heatmap.highAbsence')}</span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] text-center mt-2">
            Тек бүгінгі сессия деректері • басқа күндер бос
          </p>
        </>
      )}
    </div>
  )
})

AttendanceHeatMap.displayName = 'AttendanceHeatMap'
export default AttendanceHeatMap
