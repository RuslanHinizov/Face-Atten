import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy, Medal, Star, Users } from 'lucide-react'
import { useAttendanceStore } from '../store/attendanceStore'

type FilterGroup = 'all' | '418' | '428'

const RankBadge = memo(({ rank }: { rank: number }) => {
  if (rank === 1) return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30">
      <span className="text-xl">🥇</span>
    </div>
  )
  if (rank === 2) return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center shadow-lg">
      <span className="text-xl">🥈</span>
    </div>
  )
  if (rank === 3) return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
      <span className="text-xl">🥉</span>
    </div>
  )
  return (
    <div className="w-10 h-10 rounded-full bg-[var(--color-bg)] flex items-center justify-center border border-[var(--color-border)]">
      <span className="text-lg font-bold text-[var(--color-text-muted)]">{rank}</span>
    </div>
  )
})
RankBadge.displayName = 'RankBadge'

export const Leaderboard = memo(() => {
  const { t } = useTranslation()
  const { attendanceRecords } = useAttendanceStore()
  const [filterGroup, setFilterGroup] = useState<FilterGroup>('all')

  const leaderboardData = useMemo(() => {
    const students = attendanceRecords.filter(r => r.person.role === 'student')

    return students
      .map(r => {
        const group = (r.person as any).group as string | undefined
        // Rank score: present=100, late=75, absent=0
        const score = r.status === 'present' ? 100 : r.status === 'late' ? 75 : 0
        return {
          id: r.id,
          name: r.person.name,
          photoUrl: (r.person as any).photoUrl as string | undefined,
          group: group ?? '—',
          status: r.status as 'present' | 'late' | 'absent',
          score,
          lateByMinutes: r.lateByMinutes ?? 0,
          entryTime: r.firstEntry ? new Date(r.firstEntry).toLocaleTimeString('kk-KZ', { hour: '2-digit', minute: '2-digit' }) : null,
        }
      })
      // Sort: present first (by entry time asc), late second (by late minutes asc), absent last
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score
        if (a.status === 'late' && b.status === 'late') return a.lateByMinutes - b.lateByMinutes
        return a.name.localeCompare(b.name)
      })
  }, [attendanceRecords])

  const filtered = useMemo(() => {
    if (filterGroup === 'all') return leaderboardData
    const groupName = filterGroup === '418' ? 'ИП-21' : 'СТ-21'
    return leaderboardData.filter(e => e.group === groupName)
  }, [leaderboardData, filterGroup])

  const top3 = filtered.slice(0, 3)

  const statusLabel = (s: string) =>
    s === 'present' ? 'Келді' : s === 'late' ? 'Кешікті' : 'Келмеді'
  const statusColor = (s: string) =>
    s === 'present' ? 'text-emerald-500' : s === 'late' ? 'text-amber-500' : 'text-red-500'

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[var(--color-border)] bg-gradient-to-r from-purple-500/10 to-blue-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text)]">{t('leaderboard.title')}</h2>
              <p className="text-sm text-[var(--color-text-muted)]">{filtered.length} студент</p>
            </div>
          </div>

          {/* Group filter */}
          <div className="flex items-center gap-1 p-1 bg-[var(--color-bg)] rounded-xl">
            {([['all', 'Барлығы'], ['418', 'ИП-21'], ['428', 'СТ-21']] as [FilterGroup, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterGroup(val)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  filterGroup === val
                    ? 'bg-purple-500 text-white shadow'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top 3 podium */}
      {top3.length >= 1 && (
        <div className="p-6 bg-gradient-to-b from-[var(--color-bg)] to-transparent">
          <div className="flex items-end justify-center gap-4">
            {/* 2nd */}
            {top3[1] && (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center mb-2 shadow-lg border-2 border-gray-400">
                  <span className="text-2xl font-bold text-white">{top3[1].name[0]}</span>
                </div>
                <div className="text-2xl">🥈</div>
                <p className="text-sm font-semibold text-[var(--color-text)] text-center max-w-[80px] truncate">{top3[1].name.split(' ')[0]}</p>
                <p className={`text-sm font-bold ${statusColor(top3[1].status)}`}>{statusLabel(top3[1].status)}</p>
              </div>
            )}
            {/* 1st */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center mb-2 shadow-xl border-2 border-yellow-400">
                  <span className="text-3xl font-bold text-white">{top3[0].name[0]}</span>
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                  <Star className="w-5 h-5 text-yellow-800 fill-yellow-800" />
                </div>
              </div>
              <div className="text-3xl">🥇</div>
              <p className="text-sm font-bold text-[var(--color-text)] text-center max-w-[100px] truncate">{top3[0].name.split(' ')[0]}</p>
              <p className={`text-sm font-bold ${statusColor(top3[0].status)}`}>{statusLabel(top3[0].status)}</p>
            </div>
            {/* 3rd */}
            {top3[2] && (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mb-2 shadow-lg border-2 border-orange-400">
                  <span className="text-2xl font-bold text-white">{top3[2].name[0]}</span>
                </div>
                <div className="text-2xl">🥉</div>
                <p className="text-sm font-semibold text-[var(--color-text)] text-center max-w-[80px] truncate">{top3[2].name.split(' ')[0]}</p>
                <p className={`text-sm font-bold ${statusColor(top3[2].status)}`}>{statusLabel(top3[2].status)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full list */}
      <div className="p-4 space-y-1 max-h-[400px] overflow-y-auto">
        <div className="flex items-center gap-2 px-4 py-2">
          <Medal className="w-4 h-4 text-[var(--color-text-muted)]" />
          <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
            {t('leaderboard.topPerformers')}
          </h3>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--color-text-muted)]">Деректер жоқ</p>
          </div>
        ) : (
          filtered.map((entry, idx) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                idx < 3
                  ? 'bg-gradient-to-r from-purple-500/5 to-transparent border border-purple-500/10'
                  : 'hover:bg-[var(--color-bg)]'
              }`}
            >
              <RankBadge rank={idx + 1} />

              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                <span className="text-base font-bold text-white">{entry.name[0]}</span>
              </div>

              {/* Name + group */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--color-text)] truncate text-sm">{entry.name}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${statusColor(entry.status)}`}>
                    {statusLabel(entry.status)}
                    {entry.status === 'late' && entry.lateByMinutes > 0 && ` (${entry.lateByMinutes} мин)`}
                    {entry.status === 'present' && entry.entryTime && ` · ${entry.entryTime}`}
                  </span>
                </div>
              </div>

              {/* Group badge */}
              <span className={`px-2 py-0.5 text-xs font-bold rounded-lg ${
                entry.group === 'ИП-21'
                  ? 'bg-blue-500/10 text-blue-400'
                  : entry.group === 'СТ-21'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
              }`}>
                {entry.group}
              </span>

              {/* Score */}
              <div className="text-right flex-shrink-0">
                <p className={`text-base font-black ${statusColor(entry.status)}`}>{entry.score}%</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
})

Leaderboard.displayName = 'Leaderboard'
export default Leaderboard
