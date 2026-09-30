import attendanceScreenshot from '../assets/attendance-screenshot.png'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  Globe,
  FileText,
  Users,
  GraduationCap,
  Clock,
  BarChart3,
  ArrowLeft,
  Calendar,
  Trophy,
  Flame,
  Search,
  Download,
  Printer,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserX,
  ChevronDown,
  Filter,
  X,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { AttendanceTable } from '../components/AttendanceTable'
import { TeacherAttendance } from '../components/TeacherAttendance'
import { TimelineVisualization } from '../components/TimelineVisualization'
import { SessionSummary } from '../components/SessionSummary'
import { TrendChart } from '../components/TrendChart'
import { AlertsPanel } from '../components/AlertsPanel'
import { CalendarView } from '../components/CalendarView'
import { Leaderboard } from '../components/Leaderboard'
import { AttendanceHeatMap } from '../components/AttendanceHeatMap'
import { useAttendanceStore } from '../store/attendanceStore'
import { useReportsData } from '../hooks/useReportsData'

type TabId = 'students' | 'teacher' | 'timeline' | 'analytics' | 'calendar' | 'leaderboard' | 'heatmap'

interface Tab {
  id: TabId
  labelKey: string
  icon: React.ReactNode
}

const tabs: Tab[] = [
  { id: 'students', labelKey: 'reports.students', icon: <Users className="w-4 h-4" /> },
  { id: 'teacher', labelKey: 'reports.teacher', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'timeline', labelKey: 'reports.timeline', icon: <Clock className="w-4 h-4" /> },
  { id: 'analytics', labelKey: 'reports.analytics', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'calendar', labelKey: 'calendar.title', icon: <Calendar className="w-4 h-4" /> },
  { id: 'leaderboard', labelKey: 'leaderboard.title', icon: <Trophy className="w-4 h-4" /> },
  { id: 'heatmap', labelKey: 'heatmap.title', icon: <Flame className="w-4 h-4" /> },
]

const GROUPS = [
  { value: '', label: 'Барлығы', labelRu: 'Все' },
  { value: '418', label: 'ИП-21', labelRu: 'ИП-21' },
  { value: '428', label: 'СТ-21', labelRu: 'СТ-21' },
]

export function Report() {
  const { t, i18n } = useTranslation()
  const { currentSession, attendanceRecords } = useAttendanceStore()
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const { isLoading, error, stats, refetch } = useReportsData(selectedGroup || undefined)
  const [activeTab, setActiveTab] = useState<TabId>('students')
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'late' | 'absent'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [dateFilter, setDateFilter] = useState('')

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
  }

  // Calculate stats - filter only students (use backend stats if available)
  const studentRecords = attendanceRecords.filter(r => r.person.role === 'student')
  const totalStudents = stats?.total ?? studentRecords.length
  const presentCount = stats?.present ?? studentRecords.filter(r => r.status === 'present').length
  const lateCount = stats?.late ?? studentRecords.filter(r => r.status === 'late').length
  const absentCount = stats?.absent ?? studentRecords.filter(r => r.status === 'absent').length
  const attendanceRate = totalStudents > 0 ? Math.round(((presentCount + lateCount) / totalStudents) * 100) : 0

  const handleExportPDF = () => {
    window.print()
  }

  const handleExportExcel = () => {
    const groupLabel = selectedGroup === '418' ? 'ИП-21' : selectedGroup === '428' ? 'СТ-21' : 'Все'
    const headers = ['Аты-жөні', 'Топ', 'Статус', 'Кіру уақыты', 'Барлық уақыт (мин)', 'Кешігу (мин)']
    const rows = studentRecords.map(r => [
      r.person.name,
      (r.person as any).group || groupLabel,
      r.status,
      r.firstEntry ? new Date(r.firstEntry).toLocaleTimeString() : '-',
      r.totalTimeMinutes.toString(),
      r.lateByMinutes.toString()
    ])
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const suffix = selectedGroup ? `_${groupLabel}` : ''
    a.download = `attendance${suffix}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'students':
        return (
          <div className="space-y-6 animate-fade-in">
            <SessionSummary />
            <AttendanceTable statusFilter={statusFilter} />
          </div>
        )
      case 'teacher':
        return <div className="animate-fade-in"><TeacherAttendance /></div>
      case 'timeline':
        return <div className="animate-fade-in"><TimelineVisualization /></div>
      case 'analytics':
        return (
          <div className="space-y-6 animate-fade-in">
            <TrendChart />
            <AlertsPanel />
          </div>
        )
      case 'calendar':
        return <div className="animate-fade-in"><CalendarView /></div>
      case 'leaderboard':
        return <div className="animate-fade-in"><Leaderboard /></div>
      case 'heatmap':
        return <div className="animate-fade-in"><AttendanceHeatMap /></div>
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-violet-400/10 to-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-gradient-to-br from-blue-400/10 to-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-60 h-60 bg-gradient-to-br from-pink-400/10 to-rose-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--color-border)]">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="group w-11 h-11 rounded-2xl bg-[var(--color-surface)] hover:bg-gradient-to-br hover:from-violet-500 hover:to-purple-600 border border-[var(--color-border)] hover:border-transparent flex items-center justify-center transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-violet-500/25">
                <ArrowLeft className="w-5 h-5 text-[var(--color-text-secondary)] group-hover:text-white transition-colors" />
              </Link>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-600 flex items-center justify-center shadow-xl shadow-violet-500/30">
                    <FileText className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[var(--color-surface)]">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">
                    {t('reports.title')}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    {currentSession?.name || new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="hidden lg:flex relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] group-focus-within:text-violet-500 transition-colors" />
                <input
                  type="text"
                  placeholder={t('reports.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-11 pr-4 py-2.5 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all shadow-sm text-sm"
                />
              </div>

              {/* Refresh Button */}
              <button
                onClick={refetch}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] font-medium hover:border-violet-300 hover:shadow-md transition-all text-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{t('common.refresh') || 'Refresh'}</span>
              </button>

              {/* Export Buttons */}
              <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] font-medium hover:border-violet-300 hover:shadow-md transition-all text-sm">
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02] transition-all text-sm">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Excel</span>
              </button>

              {/* Language Switcher */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface-elevated)] rounded-2xl border border-[var(--color-border)] shadow-sm backdrop-blur-sm">
                <Globe className="w-4 h-4 text-[var(--color-text-muted)]" />
                <div className="flex gap-1">
                  {['tr', 'kk', 'ru', 'en'].map((lang) => (
                    <button key={lang} onClick={() => changeLanguage(lang)}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all duration-300 ${i18n.language === lang
                        ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/30 scale-105'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]'}`}>
                      {lang.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-5 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap ${activeTab === tab.id
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30 scale-[1.02]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] hover:shadow-sm'}`}>
                {tab.icon}
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto p-6 relative">
        {/* Loading State */}
        {isLoading && (
          <div className="mb-6 p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            <span className="text-violet-300">{t('common.loading') || 'Loading data from server...'}</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-300">{error}</span>
            </div>
            <button
              onClick={refetch}
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
            >
              {t('common.retry') || 'Retry'}
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {/* Total Students */}
          <div className="col-span-2 lg:col-span-1 group relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500 via-purple-600 to-pink-700 p-6 shadow-xl shadow-violet-500/25 hover:shadow-2xl hover:shadow-violet-500/30 transition-all duration-500">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzLTItMi00LTJjLTIgMC00IDItNCAyczIgNCA0IDRjMiAwIDQtMiA0LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <TrendingUp className="w-5 h-5 text-white/60" />
              </div>
              <p className="text-4xl font-black text-white mb-1">{totalStudents}</p>
              <p className="text-sm text-violet-100 font-medium">{t('dashboard.totalStudents')}</p>
            </div>
          </div>

          {/* Present */}
          <div className="group relative overflow-hidden rounded-3xl bg-[var(--color-surface)] p-5 shadow-lg hover:shadow-xl hover:shadow-emerald-500/10 border border-[var(--color-border)] transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <UserCheck className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-3xl font-black text-[var(--color-text)]">{presentCount}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{t('dashboard.present')}</p>
              </div>
            </div>
          </div>

          {/* Late */}
          <div className="group relative overflow-hidden rounded-3xl bg-[var(--color-surface)] p-5 shadow-lg hover:shadow-xl hover:shadow-amber-500/10 border border-[var(--color-border)] transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Clock className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-3xl font-black text-[var(--color-text)]">{lateCount}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{t('dashboard.late')}</p>
              </div>
            </div>
          </div>

          {/* Absent */}
          <div className="group relative overflow-hidden rounded-3xl bg-[var(--color-surface)] p-5 shadow-lg hover:shadow-xl hover:shadow-red-500/10 border border-[var(--color-border)] transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-lg shadow-red-500/30">
                <UserX className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-3xl font-black text-[var(--color-text)]">{absentCount}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{t('dashboard.absent')}</p>
              </div>
            </div>
          </div>

          {/* Attendance Rate - Screenshot */}
          <div className="group relative overflow-hidden rounded-3xl shadow-lg hover:shadow-xl hover:shadow-indigo-500/10 border border-[var(--color-border)] transition-all duration-300 min-h-[120px]">
            <img
              src={attendanceScreenshot}
              alt="Уровень посещаемости"
              className="absolute inset-0 w-full h-full object-cover rounded-3xl"
            />
          </div>
        </div>

        {/* Group Selector */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{t('search.group')}:</span>
          <div className="flex items-center gap-1 p-1 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl shadow-sm">
            {GROUPS.map(g => (
              <button
                key={g.value}
                onClick={() => setSelectedGroup(g.value)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  selectedGroup === g.value
                    ? g.value === ''
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md'
                      : g.value === '418'
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          {selectedGroup && (
            <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface)] px-3 py-1 rounded-full border border-[var(--color-border)]">
              {selectedGroup === '418' ? 'Аудитория 418' : 'Аудитория 428'}
            </span>
          )}
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-6">
          <div className="flex flex-wrap gap-3 flex-1 w-full lg:w-auto">
            {/* Mobile Search */}
            <div className="lg:hidden relative flex-1 min-w-[200px] group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)] group-focus-within:text-violet-500 transition-colors" />
              <input type="text" placeholder={t('reports.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all shadow-sm" />
            </div>

            {/* Date Filter */}
            <div className="relative">
              <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
                className="appearance-none pl-4 pr-4 py-3.5 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all shadow-sm cursor-pointer" />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 p-1 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl shadow-sm">
              <button onClick={() => setStatusFilter('all')} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${statusFilter === 'all' ? 'bg-[var(--color-text)] text-[var(--color-surface)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]'}`}>
                {t('common.all')}
              </button>
              <button onClick={() => setStatusFilter('present')} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${statusFilter === 'present' ? 'bg-emerald-500 text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]'}`}>
                <CheckCircle className="w-4 h-4" />
              </button>
              <button onClick={() => setStatusFilter('late')} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${statusFilter === 'late' ? 'bg-amber-500 text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]'}`}>
                <Clock className="w-4 h-4" />
              </button>
              <button onClick={() => setStatusFilter('absent')} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${statusFilter === 'absent' ? 'bg-red-500 text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]'}`}>
                <UserX className="w-4 h-4" />
              </button>
            </div>

            {/* More Filters Toggle */}
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-3.5 border-2 rounded-2xl font-medium transition-all ${showFilters ? 'bg-violet-500 border-violet-500 text-white' : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-border-light)]'}`}>
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">{t('search.advanced')}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-6 bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] shadow-lg animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--color-text)]">{t('search.advanced')}</h3>
              <button onClick={() => setShowFilters(false)} className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-xl transition-colors">
                <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-2">{t('search.dateRange')}</label>
                <div className="flex gap-2">
                  <input type="date" className="flex-1 px-4 py-2.5 bg-[var(--color-surface-elevated)] border-2 border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-violet-500 transition-all" />
                  <input type="date" className="flex-1 px-4 py-2.5 bg-[var(--color-surface-elevated)] border-2 border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-violet-500 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-2">{t('search.group')}</label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border-2 border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-violet-500 transition-all"
                >
                  <option value="">{t('common.all')}</option>
                  <option value="418">ИП-21 (Аудитория 418)</option>
                  <option value="428">СТ-21 (Аудитория 428)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-2">{t('session.active')}</label>
                <select className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border-2 border-[var(--color-border)] rounded-xl text-[var(--color-text)] focus:outline-none focus:border-violet-500 transition-all">
                  <option value="">{t('common.all')}</option>
                  <option value="morning">08:30 - 10:00</option>
                  <option value="afternoon">10:00 - 11:30</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button className="px-5 py-2.5 text-[var(--color-text-secondary)] font-semibold hover:bg-[var(--color-surface-elevated)] rounded-xl transition-colors">
                {t('search.clearFilters')}
              </button>
              <button className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/30 hover:shadow-xl transition-all">
                {t('search.apply')}
              </button>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] shadow-lg overflow-hidden">
          <div className="p-6">
            {renderTabContent()}
          </div>
        </div>
      </main>
    </div>
  )
}
