import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  Globe,
  Activity,
  FileText,
  Video,
  Users,
  Settings,
  ArrowRight,
  QrCode,
  Calendar,
  Plus,
  MapPin,
  Signal,
  WifiOff,
  RefreshCw,
  Sparkles,
  BookOpen,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAttendanceStore } from '../store/attendanceStore'
import { LiveNotificationPanel } from '../components/LiveNotificationPanel'
import { QRCodeAttendance } from '../components/QRCodeAttendance'
import { AutoReportScheduler } from '../components/AutoReportScheduler'
import {
  LiveCounterWidget,
  QuickStatsWidget,
  TodaySummaryWidget,
  PerformanceTrendWidget,
  AchievementWidget,
  RecentActivityWidget
} from '../components/DashboardWidgets'
import { useDashboardData } from '../hooks/useDashboardData'

export function Dashboard() {
  const { t, i18n } = useTranslation()
  const [showQRModal, setShowQRModal] = useState(false)
  const [showReportScheduler, setShowReportScheduler] = useState(false)
  const { isLoading, error, refetch } = useDashboardData()

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
  }

  const { cameras: storeCameras, attendanceRecords } = useAttendanceStore()
  const navigate = useNavigate()
  const cameras = Object.values(storeCameras)

  // Per-group stats derived from attendance records
  const groupStats = [
    { group: '418', name: 'ИП-21', color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/25' },
    { group: '428', name: 'СТ-21', color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/25' },
  ].map(g => {
    const groupRecords = attendanceRecords.filter(r =>
      r.person.role === 'student' && (r.person as any).group === g.name
    )
    const present = groupRecords.filter(r => r.status === 'present').length
    const late = groupRecords.filter(r => r.status === 'late').length
    const total = g.group === '418' ? 19 : 19
    const absent = total - present - late
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0
    return { ...g, present, late, absent, total, rate }
  })

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--color-border)]">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[var(--color-surface)]">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-[var(--color-text)] tracking-tight">
                  {t('dashboard.title')}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    {t('session.active')}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              {/* Quick Actions */}
              <button
                onClick={() => setShowQRModal(true)}
                className="btn btn-ghost"
                title={t('qr.title')}
              >
                <QrCode className="w-5 h-5" />
              </button>

              <button
                onClick={() => setShowReportScheduler(true)}
                className="btn btn-ghost"
                title={t('autoReport.title')}
              >
                <Calendar className="w-5 h-5" />
              </button>

              {/* Refresh Button */}
              <button
                onClick={refetch}
                disabled={isLoading}
                className="btn btn-ghost"
                title={t('common.refresh') || 'Refresh'}
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              {/* Nav Buttons */}
              <Link to="/reports" className="btn btn-secondary">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">{t('nav.reports')}</span>
              </Link>

              <Link to="/persons" className="btn btn-secondary">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">{t('nav.persons')}</span>
              </Link>

              <Link to="/groups" className="btn btn-secondary">
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">{t('nav.groups')}</span>
              </Link>

              <Link to="/schedule" className="btn btn-secondary">
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">{t('nav.schedule')}</span>
              </Link>

              <Link to="/settings" className="btn btn-ghost">
                <Settings className="w-5 h-5" />
              </Link>

              {/* Language Switcher */}
              <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]">
                <Globe className="w-4 h-4 text-[var(--color-text-muted)]" />
                <div className="flex gap-1">
                  {['ru', 'kk', 'en', 'tr'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => changeLanguage(lang)}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        i18n.language === lang
                          ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-blue-500/30'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]'
                      }`}
                    >
                      {lang.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1920px] mx-auto p-6">
        <div className="space-y-6">
          {/* Loading State */}
          {isLoading && (
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="text-blue-600 dark:text-blue-400">{t('common.loading') || 'Loading data from server...'}</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span className="text-red-600 dark:text-red-400">{error}</span>
              </div>
              <button
                onClick={refetch}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400 rounded-lg text-sm transition-colors"
              >
                {t('common.retry') || 'Retry'}
              </button>
            </div>
          )}

          {/* Dashboard Widgets Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <LiveCounterWidget />
            <div className="lg:col-span-2">
              <QuickStatsWidget />
            </div>
          </div>

          {/* Per-Group Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupStats.map(g => (
              <div key={g.group} className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${g.color} p-5 shadow-xl ${g.shadow}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-white/70 text-sm font-medium">Топ / Группа</p>
                    <p className="text-white text-2xl font-black">{g.name}</p>
                    <p className="text-white/60 text-xs">Аудитория {g.group}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-4xl font-black">{g.rate}%</p>
                    <p className="text-white/70 text-sm">қатысу / явка</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 bg-white/20 rounded-2xl p-3 text-center">
                    <p className="text-white text-xl font-bold">{g.present}</p>
                    <p className="text-white/70 text-xs">келді</p>
                  </div>
                  <div className="flex-1 bg-white/20 rounded-2xl p-3 text-center">
                    <p className="text-white text-xl font-bold">{g.late}</p>
                    <p className="text-white/70 text-xs">кешікті</p>
                  </div>
                  <div className="flex-1 bg-white/20 rounded-2xl p-3 text-center">
                    <p className="text-white text-xl font-bold">{g.absent}</p>
                    <p className="text-white/70 text-xs">келмеді</p>
                  </div>
                  <div className="flex-1 bg-white/20 rounded-2xl p-3 text-center">
                    <p className="text-white text-xl font-bold">{g.total}</p>
                    <p className="text-white/70 text-xs">барлығы</p>
                  </div>
                </div>
                <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white/80 rounded-full transition-all duration-1000" style={{ width: `${g.rate}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Second Row - Summary & Trends */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <TodaySummaryWidget />
            <PerformanceTrendWidget />
            <AchievementWidget />
            <RecentActivityWidget />
          </div>

          {/* Camera Section Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">{t('dashboard.liveFeeds')}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {cameras.length} {t('cameraGrid.activeUnits')}
                </p>
              </div>
            </div>
          </div>

          {/* Camera List */}
          <div className="card overflow-hidden">
            {cameras.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg)] flex items-center justify-center mx-auto mb-4">
                  <Video className="w-8 h-8 text-[var(--color-text-muted)]" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t('cameraGrid.noCameras')}</h3>
                <p className="text-[var(--color-text-muted)] text-sm mb-4">{t('cameraGrid.addCameraHint')}</p>
                <button
                  onClick={() => navigate('/camera-grid')}
                  className="btn btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  {t('cameraGrid.addCamera')}
                </button>
              </div>
            ) : (
              <>
                {/* Camera Previews with Live Stream */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                  {cameras.map((camera) => (
                    <div
                      key={camera.id}
                      className="relative rounded-xl overflow-hidden bg-black cursor-pointer group"
                      onClick={() => navigate('/camera-grid', { state: { selectedCameraId: camera.id } })}
                    >
                      {/* Live Video Stream - triggers face recognition on backend */}
                      <img
                        src={`/api/stream/${camera.id}`}
                        alt={camera.name}
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />

                      {/* Camera Info Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-white text-sm">
                              {camera.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="flex items-center gap-1 text-xs text-white/70">
                                <MapPin className="w-3 h-3" />
                                {camera.location}
                              </span>
                            </div>
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            camera.status === 'connected'
                              ? 'bg-emerald-500/80 text-white'
                              : 'bg-red-500/80 text-white'
                          }`}>
                            {camera.status === 'connected' && <Signal className="w-3 h-3" />}
                            {camera.status === 'disconnected' && <WifiOff className="w-3 h-3" />}
                            {camera.status === 'connected' ? 'LIVE' : 'Offline'}
                          </div>
                        </div>
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ArrowRight className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-[var(--color-bg)] border-t border-[var(--color-border)]">
                  <button
                    onClick={() => navigate('/camera-grid')}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-primary text-white font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.01] transition-all"
                  >
                    <Video className="w-5 h-5" />
                    {t('dashboard.viewAllCameras')}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <LiveNotificationPanel position="bottom-right" maxNotifications={10} />

      {showQRModal && (
        <QRCodeAttendance onClose={() => setShowQRModal(false)} />
      )}

      {showReportScheduler && (
        <AutoReportScheduler isOpen={showReportScheduler} onClose={() => setShowReportScheduler(false)} />
      )}
    </div>
  )
}
