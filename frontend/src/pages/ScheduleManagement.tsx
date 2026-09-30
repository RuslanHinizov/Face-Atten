import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Calendar,
  ArrowLeft,
  Plus,
  Clock,
  BookOpen,
  Globe,
  Sparkles,
  ArrowUpRight,
  Trash2,
  Users,
  X,
  MapPin,
  ChevronDown
} from 'lucide-react'

interface Group {
  id: string
  name: string
  description?: string
  color?: string
}

interface ScheduleItem {
  id: string
  groupId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  subject: string
  room: string
}

const groupColors = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-purple-500 to-pink-600',
  'from-rose-500 to-red-600',
  'from-cyan-500 to-blue-600',
]

const demoGroups: Group[] = [
  { id: 'g1', name: 'ИП-21', description: 'Аудитория 418', color: groupColors[0] },
  { id: 'g2', name: 'СТ-21', description: 'Аудитория 428', color: groupColors[1] },
]

const demoSchedule: ScheduleItem[] = [
  // ========== ИП-21 (g1) — Аудитория 418 ==========
  // Дүйсенбі
  { id: 's1',  groupId: 'g1', dayOfWeek: 0, startTime: '08:30', endTime: '09:50', subject: 'Алгоритмдер',                   room: '418' },
  { id: 's2',  groupId: 'g1', dayOfWeek: 0, startTime: '10:00', endTime: '11:20', subject: 'Деректер қоры',                  room: '418' },
  { id: 's3',  groupId: 'g1', dayOfWeek: 0, startTime: '14:00', endTime: '15:20', subject: 'Ағылшын тілі',                   room: '312' },
  // Сейсенбі
  { id: 's4',  groupId: 'g1', dayOfWeek: 1, startTime: '08:30', endTime: '09:50', subject: 'Веб-технологиялар',              room: '418' },
  { id: 's5',  groupId: 'g1', dayOfWeek: 1, startTime: '10:00', endTime: '11:20', subject: 'Математикалық талдау',           room: '201' },
  { id: 's6',  groupId: 'g1', dayOfWeek: 1, startTime: '11:30', endTime: '12:50', subject: 'Бағдарламалау технологиялары',   room: '418' },
  // Сәрсенбі
  { id: 's7',  groupId: 'g1', dayOfWeek: 2, startTime: '08:30', endTime: '09:50', subject: 'Математика',                    room: '201' },
  { id: 's8',  groupId: 'g1', dayOfWeek: 2, startTime: '10:00', endTime: '11:20', subject: 'Операциялық жүйелер',            room: '418' },
  { id: 's9',  groupId: 'g1', dayOfWeek: 2, startTime: '14:00', endTime: '15:20', subject: 'Веб-технологиялар (зертхана)',   room: '418' },
  // Бейсенбі
  { id: 's10', groupId: 'g1', dayOfWeek: 3, startTime: '08:30', endTime: '09:50', subject: 'Желілік технологиялар',          room: '418' },
  { id: 's11', groupId: 'g1', dayOfWeek: 3, startTime: '10:00', endTime: '11:20', subject: 'Физика',                         room: '305' },
  { id: 's12', groupId: 'g1', dayOfWeek: 3, startTime: '14:00', endTime: '15:20', subject: 'Деректер қоры (зертхана)',       room: '418' },
  // Жұма
  { id: 's13', groupId: 'g1', dayOfWeek: 4, startTime: '08:30', endTime: '09:50', subject: 'Алгоритмдер (практика)',         room: '418' },
  { id: 's14', groupId: 'g1', dayOfWeek: 4, startTime: '10:00', endTime: '11:20', subject: 'Ақпараттық қауіпсіздік',         room: '418' },
  { id: 's15', groupId: 'g1', dayOfWeek: 4, startTime: '11:30', endTime: '12:50', subject: 'Ағылшын тілі',                   room: '312' },

  // ========== СТ-21 (g2) — Аудитория 428 ==========
  // Дүйсенбі
  { id: 's16', groupId: 'g2', dayOfWeek: 0, startTime: '08:30', endTime: '09:50', subject: 'Компьютерлік желілер',           room: '428' },
  { id: 's17', groupId: 'g2', dayOfWeek: 0, startTime: '10:00', endTime: '11:20', subject: 'Java бағдарламалау',             room: '428' },
  { id: 's18', groupId: 'g2', dayOfWeek: 0, startTime: '14:00', endTime: '15:20', subject: 'Математика',                    room: '201' },
  // Сейсенбі
  { id: 's19', groupId: 'g2', dayOfWeek: 1, startTime: '08:30', endTime: '09:50', subject: 'Физика',                         room: '305' },
  { id: 's20', groupId: 'g2', dayOfWeek: 1, startTime: '10:00', endTime: '11:20', subject: 'Математикалық талдау',           room: '201' },
  { id: 's21', groupId: 'g2', dayOfWeek: 1, startTime: '14:00', endTime: '15:20', subject: 'Ақпараттық қауіпсіздік',         room: '428' },
  // Сәрсенбі
  { id: 's22', groupId: 'g2', dayOfWeek: 2, startTime: '08:30', endTime: '09:50', subject: 'Деректер қоры',                  room: '428' },
  { id: 's23', groupId: 'g2', dayOfWeek: 2, startTime: '10:00', endTime: '11:20', subject: 'Java бағдарламалау (зертхана)',  room: '428' },
  { id: 's24', groupId: 'g2', dayOfWeek: 2, startTime: '11:30', endTime: '12:50', subject: 'Ағылшын тілі',                   room: '312' },
  // Бейсенбі
  { id: 's25', groupId: 'g2', dayOfWeek: 3, startTime: '08:30', endTime: '09:50', subject: 'Компьютерлік желілер (практика)', room: '428' },
  { id: 's26', groupId: 'g2', dayOfWeek: 3, startTime: '10:00', endTime: '11:20', subject: 'Операциялық жүйелер',            room: '428' },
  { id: 's27', groupId: 'g2', dayOfWeek: 3, startTime: '14:00', endTime: '15:20', subject: 'Ағылшын тілі',                   room: '312' },
  // Жұма
  { id: 's28', groupId: 'g2', dayOfWeek: 4, startTime: '08:30', endTime: '09:50', subject: 'Ақпараттық қауіпсіздік (зертхана)', room: '428' },
  { id: 's29', groupId: 'g2', dayOfWeek: 4, startTime: '10:00', endTime: '11:20', subject: 'Физика (зертхана)',               room: '305' },
  { id: 's30', groupId: 'g2', dayOfWeek: 4, startTime: '11:30', endTime: '12:50', subject: 'Деректер қоры (практика)',        room: '428' },
]

export function ScheduleManagement() {
  const { t, i18n } = useTranslation()
  const [groups] = useState<Group[]>(demoGroups)
  const [schedule, setSchedule] = useState<ScheduleItem[]>(demoSchedule)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedLesson, setSelectedLesson] = useState<ScheduleItem | null>(null)

  const [newScheduleGroupId, setNewScheduleGroupId] = useState('')
  const [newScheduleDay, setNewScheduleDay] = useState(0)
  const [newScheduleStart, setNewScheduleStart] = useState('08:30')
  const [newScheduleEnd, setNewScheduleEnd] = useState('09:50')
  const [newScheduleSubject, setNewScheduleSubject] = useState('')
  const [newScheduleRoom, setNewScheduleRoom] = useState('')

  const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

  const changeLanguage = (lang: string) => { i18n.changeLanguage(lang) }

  const filteredSchedule = useMemo(() => {
    if (!selectedGroup) return schedule
    return schedule.filter(s => s.groupId === selectedGroup)
  }, [schedule, selectedGroup])

  const todaySchedule = useMemo(() => {
    const today = new Date().getDay()
    const dayIndex = today === 0 ? 6 : today - 1
    return schedule.filter(s => s.dayOfWeek === dayIndex)
  }, [schedule])

  const handleAddSchedule = () => {
    if (!newScheduleGroupId || !newScheduleSubject.trim()) return
    const newItem: ScheduleItem = {
      id: `s${Date.now()}`,
      groupId: newScheduleGroupId,
      dayOfWeek: newScheduleDay,
      startTime: newScheduleStart,
      endTime: newScheduleEnd,
      subject: newScheduleSubject,
      room: newScheduleRoom
    }
    setSchedule(prev => [...prev, newItem])
    resetForm()
    setShowAddModal(false)
  }

  const handleDeleteSchedule = (id: string) => {
    if (!confirm(t('schedule.confirmDelete'))) return
    setSchedule(prev => prev.filter(s => s.id !== id))
  }

  const resetForm = () => {
    setNewScheduleGroupId('')
    setNewScheduleDay(0)
    setNewScheduleStart('08:30')
    setNewScheduleEnd('09:50')
    setNewScheduleSubject('')
    setNewScheduleRoom('')
  }

  const getGroupById = (id: string) => groups.find(g => g.id === id)

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-emerald-400/10 to-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-gradient-to-br from-violet-400/10 to-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--color-border)]">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="group w-11 h-11 rounded-2xl bg-[var(--color-surface)] hover:bg-gradient-to-br hover:from-emerald-500 hover:to-teal-600 border border-[var(--color-border)] hover:border-transparent flex items-center justify-center transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-emerald-500/25">
                <ArrowLeft className="w-5 h-5 text-[var(--color-text-secondary)] group-hover:text-white transition-colors" />
              </Link>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                    <Calendar className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border-2 border-[var(--color-surface)]">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">{t('schedule.title')}</h1>
                  <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-2">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {schedule.length} {t('schedule.lessonsCount')}</span>
                    <span className="text-[var(--color-text-muted)]">•</span>
                    <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {groups.length} {t('schedule.groupsCount')}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface-elevated)] rounded-2xl border border-[var(--color-border)] shadow-sm backdrop-blur-sm">
              <Globe className="w-4 h-4 text-[var(--color-text-muted)]" />
              <div className="flex gap-1">
                {['tr', 'kk', 'ru', 'en'].map((lang) => (
                  <button key={lang} onClick={() => changeLanguage(lang)}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all duration-300 ${i18n.language === lang
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30 scale-105'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]'}`}>
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto p-6 relative">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-6 shadow-xl shadow-emerald-500/25">
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-white/60" />
              </div>
              <p className="text-4xl font-black text-white mb-1">{schedule.length}</p>
              <p className="text-sm text-emerald-100 font-medium">{t('schedule.stats.totalLessons')}</p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-3xl bg-[var(--color-surface)] p-5 shadow-lg border border-[var(--color-border)]">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Clock className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-3xl font-black text-[var(--color-text)]">{todaySchedule.length}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{t('schedule.stats.todayLessons')}</p>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-3xl bg-[var(--color-surface)] p-5 shadow-lg border border-[var(--color-border)]">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-3xl font-black text-[var(--color-text)]">{groups.length}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{t('schedule.stats.activeGroups')}</p>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-3xl bg-[var(--color-surface)] p-5 shadow-lg border border-[var(--color-border)]">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
                <MapPin className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-3xl font-black text-[var(--color-text)]">{new Set(schedule.map(s => s.room)).size}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{t('schedule.stats.rooms')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Group Filter */}
            <div className="relative">
              <button
                onClick={() => setSelectedGroup(selectedGroup ? null : groups[0]?.id || null)}
                className="flex items-center gap-2 px-4 py-3 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] hover:border-emerald-500 transition-all"
              >
                <Users className="w-4 h-4 text-[var(--color-text-muted)]" />
                <span>{selectedGroup ? getGroupById(selectedGroup)?.name : t('schedule.allGroups')}</span>
                <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
              </button>
              {selectedGroup && (
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Group Pills */}
            <div className="flex gap-2 flex-wrap">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(selectedGroup === group.id ? null : group.id)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    selectedGroup === group.id
                      ? `bg-gradient-to-r ${group.color} text-white shadow-md`
                      : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] border border-[var(--color-border)]'
                  }`}
                >
                  {group.name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-5 h-5" />
            {t('schedule.addLesson')}
          </button>
        </div>

        {/* Weekly Schedule Grid */}
        <div className="bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] overflow-hidden shadow-lg">
          <div className="p-5 border-b border-[var(--color-border)] bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
            <h3 className="text-lg font-bold text-[var(--color-text)]">{t('schedule.weeklySchedule')}</h3>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
                {dayKeys.map((day, index) => {
                  const today = new Date().getDay()
                  const isToday = (today === 0 ? 6 : today - 1) === index
                  return (
                    <div
                      key={day}
                      className={`p-4 text-center font-semibold ${
                        isToday
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'text-[var(--color-text-secondary)]'
                      }`}
                    >
                      <span className="text-sm">{t(`schedule.days.${day}`)}</span>
                      {isToday && (
                        <span className="ml-2 px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full">
                          {t('schedule.today')}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Schedule Grid */}
              <div className="grid grid-cols-7 min-h-[400px]">
                {dayKeys.map((_, dayIndex) => {
                  const dayLessons = filteredSchedule.filter(s => s.dayOfWeek === dayIndex)
                  return (
                    <div
                      key={dayIndex}
                      className="border-r border-[var(--color-border)] last:border-r-0 p-2 space-y-2"
                    >
                      {dayLessons.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                          <p className="text-xs text-[var(--color-text-muted)]">{t('schedule.noLessons')}</p>
                        </div>
                      ) : (
                        dayLessons
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                          .map((lesson) => {
                            const group = getGroupById(lesson.groupId)
                            return (
                              <div
                                key={lesson.id}
                                onClick={() => setSelectedLesson(lesson)}
                                className={`group/lesson p-3 rounded-xl bg-gradient-to-br ${group?.color || 'from-slate-400 to-slate-500'} cursor-pointer hover:scale-[1.02] transition-all shadow-sm hover:shadow-md`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-white/90">
                                    {lesson.startTime} - {lesson.endTime}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteSchedule(lesson.id)
                                    }}
                                    className="opacity-0 group-hover/lesson:opacity-100 p-1 bg-white/20 rounded-lg hover:bg-red-500 transition-all"
                                  >
                                    <Trash2 className="w-3 h-3 text-white" />
                                  </button>
                                </div>
                                <p className="text-sm font-semibold text-white truncate">{lesson.subject}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-white/80">{group?.name}</span>
                                  <span className="text-white/50">•</span>
                                  <span className="flex items-center gap-1 text-xs text-white/80">
                                    <MapPin className="w-3 h-3" />
                                    {lesson.room}
                                  </span>
                                </div>
                              </div>
                            )
                          })
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Lesson Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)] rounded-3xl shadow-2xl w-full max-w-lg border border-[var(--color-border)] overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-emerald-500 to-teal-600">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{t('schedule.addLesson')}</h2>
                <button
                  onClick={() => { setShowAddModal(false); resetForm() }}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Group Select */}
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-2">{t('schedule.modal.group')}</label>
                <select
                  value={newScheduleGroupId}
                  onChange={(e) => setNewScheduleGroupId(e.target.value)}
                  className="w-full px-4 py-3.5 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                >
                  <option value="">{t('schedule.modal.selectGroup')}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Day Select */}
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-2">{t('schedule.modal.day')}</label>
                <select
                  value={newScheduleDay}
                  onChange={(e) => setNewScheduleDay(Number(e.target.value))}
                  className="w-full px-4 py-3.5 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                >
                  {dayKeys.map((day, index) => (
                    <option key={day} value={index}>{t(`schedule.daysFull.${day}`)}</option>
                  ))}
                </select>
              </div>

              {/* Time Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text)] mb-2">{t('schedule.modal.startTime')}</label>
                  <input
                    type="time"
                    value={newScheduleStart}
                    onChange={(e) => setNewScheduleStart(e.target.value)}
                    className="w-full px-4 py-3.5 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text)] mb-2">{t('schedule.modal.endTime')}</label>
                  <input
                    type="time"
                    value={newScheduleEnd}
                    onChange={(e) => setNewScheduleEnd(e.target.value)}
                    className="w-full px-4 py-3.5 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-2">{t('schedule.modal.subject')}</label>
                <input
                  type="text"
                  value={newScheduleSubject}
                  onChange={(e) => setNewScheduleSubject(e.target.value)}
                  placeholder={t('schedule.modal.subjectPlaceholder')}
                  className="w-full px-4 py-3.5 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                />
              </div>

              {/* Room */}
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-2">{t('schedule.modal.room')}</label>
                <input
                  type="text"
                  value={newScheduleRoom}
                  onChange={(e) => setNewScheduleRoom(e.target.value)}
                  placeholder={t('schedule.modal.roomPlaceholder')}
                  className="w-full px-4 py-3.5 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                />
              </div>
            </div>

            <div className="p-6 bg-[var(--color-bg)] border-t border-[var(--color-border)] flex justify-end gap-3">
              <button
                onClick={() => { setShowAddModal(false); resetForm() }}
                className="px-5 py-2.5 text-[var(--color-text-secondary)] font-semibold hover:bg-[var(--color-surface)] rounded-xl transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddSchedule}
                disabled={!newScheduleGroupId || !newScheduleSubject.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {t('schedule.modal.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Detail Modal */}
      {selectedLesson && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)] rounded-3xl shadow-2xl w-full max-w-md border border-[var(--color-border)] overflow-hidden">
            <div className={`p-6 bg-gradient-to-r ${getGroupById(selectedLesson.groupId)?.color || 'from-slate-500 to-slate-600'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedLesson.subject}</h2>
                  <p className="text-white/80 text-sm">{getGroupById(selectedLesson.groupId)?.name}</p>
                </div>
                <button
                  onClick={() => setSelectedLesson(null)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-4 bg-[var(--color-bg)] rounded-2xl">
                <Clock className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-sm text-[var(--color-text-muted)]">{t('schedule.detail.time')}</p>
                  <p className="font-semibold text-[var(--color-text)]">{selectedLesson.startTime} - {selectedLesson.endTime}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-[var(--color-bg)] rounded-2xl">
                <Calendar className="w-5 h-5 text-violet-500" />
                <div>
                  <p className="text-sm text-[var(--color-text-muted)]">{t('schedule.detail.day')}</p>
                  <p className="font-semibold text-[var(--color-text)]">{t(`schedule.daysFull.${dayKeys[selectedLesson.dayOfWeek]}`)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-[var(--color-bg)] rounded-2xl">
                <MapPin className="w-5 h-5 text-rose-500" />
                <div>
                  <p className="text-sm text-[var(--color-text-muted)]">{t('schedule.detail.room')}</p>
                  <p className="font-semibold text-[var(--color-text)]">{selectedLesson.room}</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-[var(--color-bg)] border-t border-[var(--color-border)] flex justify-between">
              <button
                onClick={() => {
                  handleDeleteSchedule(selectedLesson.id)
                  setSelectedLesson(null)
                }}
                className="px-5 py-2.5 text-red-500 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t('common.delete')}
              </button>
              <button
                onClick={() => setSelectedLesson(null)}
                className="px-5 py-2.5 bg-[var(--color-surface)] text-[var(--color-text)] font-semibold rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)] transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
