import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts'
import { BarChart3, Users, Clock } from 'lucide-react'
import { useAttendanceStore } from '../store/attendanceStore'

type ViewMode = 'groups' | 'time' | 'summary'

const GROUPS = [
  { id: '418', name: 'ИП-21', total: 19 },
  { id: '428', name: 'СТ-21', total: 19 },
]

const TIME_SLOTS = [
  { label: '08:00-08:30', start: 8 * 60,      end: 8 * 60 + 30 },
  { label: '08:30-09:00', start: 8 * 60 + 30,  end: 9 * 60 },
  { label: '09:00-09:30', start: 9 * 60,        end: 9 * 60 + 30 },
  { label: '09:30-10:00', start: 9 * 60 + 30,  end: 10 * 60 },
  { label: '10:00-10:30', start: 10 * 60,       end: 10 * 60 + 30 },
  { label: '10:30+',      start: 10 * 60 + 30,  end: 24 * 60 },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 shadow-xl">
        <p className="text-sm font-semibold text-[var(--color-text)] mb-2">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-[var(--color-text-muted)]">{entry.name}:</span>
            <span className="font-semibold text-[var(--color-text)]">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function TrendChart() {
  const { t } = useTranslation()
  const { attendanceRecords } = useAttendanceStore()
  const [viewMode, setViewMode] = useState<ViewMode>('groups')

  // Real group data
  const groupData = useMemo(() => GROUPS.map(g => {
    const groupName = g.id === '418' ? 'ИП-21' : 'СТ-21'
    const records = attendanceRecords.filter(r =>
      r.person.role === 'student' && (r.person as any).group === groupName
    )
    const present = records.filter(r => r.status === 'present').length
    const late    = records.filter(r => r.status === 'late').length
    const absent  = records.filter(r => r.status === 'absent').length
    const rate    = g.total > 0 ? Math.round(((present + late) / g.total) * 100) : 0
    return { name: g.name, present, late, absent, total: g.total, rate }
  }), [attendanceRecords])

  // Entry time distribution
  const timeData = useMemo(() => {
    const arrived = attendanceRecords.filter(
      r => r.person.role === 'student' && r.status !== 'absent' && r.firstEntry
    )
    return TIME_SLOTS.map(slot => {
      const count = arrived.filter(r => {
        const d = new Date(r.firstEntry!)
        const mins = d.getHours() * 60 + d.getMinutes()
        return mins >= slot.start && mins < slot.end
      }).length
      return { label: slot.label, count }
    })
  }, [attendanceRecords])

  // Summary bar data
  const summaryData = useMemo(() => {
    const students = attendanceRecords.filter(r => r.person.role === 'student')
    const present = students.filter(r => r.status === 'present').length
    const late    = students.filter(r => r.status === 'late').length
    const absent  = students.filter(r => r.status === 'absent').length
    return [
      { name: t('reports.present') || 'Келді',    value: present, color: '#10b981' },
      { name: t('reports.late')    || 'Кешікті',  value: late,    color: '#f59e0b' },
      { name: t('reports.absent')  || 'Келмеді',  value: absent,  color: '#ef4444' },
    ]
  }, [attendanceRecords, t])

  const overallRate = useMemo(() => {
    const total = GROUPS.reduce((s, g) => s + g.total, 0)
    const attended = attendanceRecords.filter(
      r => r.person.role === 'student' && r.status !== 'absent'
    ).length
    return total > 0 ? Math.round((attended / total) * 100) : 0
  }, [attendanceRecords])

  const views: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
    { value: 'groups',  label: t('analytics.byGroup')   || 'Топтар',  icon: <Users className="w-3.5 h-3.5" /> },
    { value: 'time',    label: t('analytics.byTime')    || 'Уақыт',   icon: <Clock className="w-3.5 h-3.5" /> },
    { value: 'summary', label: t('analytics.summary')   || 'Жалпы',   icon: <BarChart3 className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-text)]">
              {t('analytics.trends') || 'Аналитика'}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {t('analytics.attendanceRate') || 'Қатысу'}: {overallRate}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[var(--color-bg)] rounded-lg">
          {views.map(v => (
            <button
              key={v.value}
              onClick={() => setViewMode(v.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === v.value
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {v.icon}
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="p-5">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'groups' ? (
              <BarChart data={groupData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="present" name={t('reports.present') || 'Келді'}   fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="late"    name={t('reports.late')    || 'Кешікті'} fill="#f59e0b" radius={[4,4,0,0]} />
                <Bar dataKey="absent"  name={t('reports.absent')  || 'Келмеді'} fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            ) : viewMode === 'time' ? (
              <BarChart data={timeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name={t('analytics.students') || 'Студент'} radius={[4,4,0,0]}>
                  {timeData.map((_entry, index) => (
                    <Cell
                      key={index}
                      fill={
                        index <= 1 ? '#10b981'   // early
                        : index <= 3 ? '#f59e0b' // on time / slight delay
                        : '#ef4444'              // late
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={summaryData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name={t('analytics.students') || 'Студент'} radius={[0,4,4,0]}>
                  {summaryData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Group rate summary */}
        {viewMode === 'groups' && (
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-[var(--color-border)]">
            {groupData.map(g => (
              <div key={g.name} className="text-center">
                <p className="text-lg font-black text-[var(--color-text)]">{g.rate}%</p>
                <p className="text-xs text-[var(--color-text-muted)]">{g.name} қатысу</p>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'time' && (
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs text-[var(--color-text-muted)]">Ерте</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-xs text-[var(--color-text-muted)]">Уақытында</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-xs text-[var(--color-text-muted)]">Кешіккен</span>
            </div>
          </div>
        )}

        {viewMode === 'summary' && (
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-[var(--color-border)]">
            {summaryData.map(s => (
              <div key={s.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-xs text-[var(--color-text-muted)]">{s.name}: {s.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
