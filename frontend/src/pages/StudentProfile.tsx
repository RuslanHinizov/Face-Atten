import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Award,
  CheckCircle,
  XCircle,
  Globe,
  Camera,
  Mail,
  Phone,
  BookOpen,
  Edit,
  Download,
  X
} from 'lucide-react'

// Mock student data
const mockStudentData = {
  id: '1',
  name: 'Асанов Нұрлан',
  email: 'asanov.nurlan@university.kz',
  phone: '+7 (777) 123-45-67',
  group: 'ИП-21',
  faculty: 'Ақпараттық технологиялар',
  enrollmentYear: 2021,
  photoUrl: null,
  hasFaceEncoding: true,
  stats: {
    totalClasses: 120,
    attended: 108,
    late: 8,
    absent: 4,
    attendanceRate: 90,
    punctualityRate: 93,
    streak: 12,
    longestStreak: 25
  },
  monthlyData: [
    { month: 'Қыркүйек', attended: 18, late: 1, absent: 1, total: 20 },
    { month: 'Қазан', attended: 20, late: 2, absent: 0, total: 22 },
    { month: 'Қараша', attended: 17, late: 2, absent: 1, total: 20 },
    { month: 'Желтоқсан', attended: 15, late: 1, absent: 2, total: 18 },
    { month: 'Қаңтар', attended: 19, late: 1, absent: 0, total: 20 },
    { month: 'Ақпан', attended: 19, late: 1, absent: 0, total: 20 }
  ],
  recentActivity: [
    { date: '2024-01-15', subject: 'Алгоритмдер', status: 'present', time: '08:28' },
    { date: '2024-01-15', subject: 'Деректер қоры', status: 'present', time: '10:02' },
    { date: '2024-01-14', subject: 'Веб-технологиялар', status: 'late', time: '08:42', lateBy: 12 },
    { date: '2024-01-14', subject: 'Java бағдарламалау', status: 'present', time: '09:58' },
    { date: '2024-01-13', subject: 'Алгоритмдер', status: 'present', time: '08:25' },
    { date: '2024-01-12', subject: 'Деректер қоры', status: 'absent' },
    { date: '2024-01-11', subject: 'Веб-технологиялар', status: 'present', time: '08:30' },
  ],
  subjects: [
    { name: 'Алгоритмдер', attended: 28, total: 30, rate: 93 },
    { name: 'Деректер қоры', attended: 26, total: 30, rate: 87 },
    { name: 'Веб-технологиялар', attended: 27, total: 30, rate: 90 },
    { name: 'Java бағдарламалау', attended: 27, total: 30, rate: 90 },
  ]
}

export function StudentProfile() {
  const { t, i18n } = useTranslation()
  const { studentId: _studentId } = useParams<{ studentId: string }>()
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'subjects'>('overview')
  const [showEditModal, setShowEditModal] = useState(false)

  // In production, fetch student data based on _studentId
  const student = mockStudentData

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
  }

  const handleDownloadReport = () => {
    // Generate CSV report
    const headers = ['Date', 'Subject', 'Status', 'Time']
    const rows = student.recentActivity.map(a => [
      a.date,
      a.subject,
      a.status,
      a.time || '-'
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${student.name}_attendance_report.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />
      case 'late':
        return <Clock className="w-4 h-4 text-amber-500" />
      case 'absent':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string, lateBy?: number) => {
    switch (status) {
      case 'present':
        return (
          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-lg">
            {t('profile.present')}
          </span>
        )
      case 'late':
        return (
          <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-lg">
            {t('profile.late')} {lateBy && `(${lateBy} ${t('profile.min')})`}
          </span>
        )
      case 'absent':
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-lg">
            {t('profile.absent')}
          </span>
        )
      default:
        return null
    }
  }

  // Calculate trend
  const trend = useMemo(() => {
    const recent = student.monthlyData.slice(-2)
    if (recent.length < 2) return 0
    const currentRate = (recent[1].attended / recent[1].total) * 100
    const previousRate = (recent[0].attended / recent[0].total) * 100
    return currentRate - previousRate
  }, [student.monthlyData])

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/persons"
                className="w-10 h-10 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-[var(--color-text-muted)]" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-[var(--color-text)]">
                  {t('profile.title')}
                </h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {student.group} • {student.faculty}
                </p>
              </div>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]">
              <Globe className="w-4 h-4 text-[var(--color-text-muted)]" />
              <div className="flex gap-1">
                {['tr', 'kk', 'ru', 'en'].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => changeLanguage(lang)}
                    className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
                      i18n.language === lang
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Profile Card */}
          <div className="col-span-12 lg:col-span-4">
            <div className="card p-6 sticky top-24">
              {/* Avatar */}
              <div className="text-center mb-6">
                <div className="relative inline-block">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-lg">
                    {student.photoUrl ? (
                      <img
                        src={student.photoUrl}
                        alt={student.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl font-bold text-white">
                        {student.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  {student.hasFaceEncoding && (
                    <div className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-[var(--color-surface)]">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <h2 className="text-xl font-bold text-[var(--color-text)] mt-4">
                  {student.name}
                </h2>
                <p className="text-[var(--color-text-muted)]">{student.group}</p>
              </div>

              {/* Contact Info */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="text-[var(--color-text)]">{student.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="text-[var(--color-text)]">{student.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <BookOpen className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="text-[var(--color-text)]">{student.faculty}</span>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{student.stats.attendanceRate}%</p>
                  <p className="text-xs text-emerald-600/80">{t('profile.attendanceRate')}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{student.stats.punctualityRate}%</p>
                  <p className="text-xs text-amber-600/80">{t('profile.punctuality')}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 space-y-2">
                <button 
                  onClick={() => setShowEditModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] transition-all"
                >
                  <Edit className="w-4 h-4" />
                  {t('profile.editProfile')}
                </button>
                <button 
                  onClick={handleDownloadReport}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:border-slate-300 hover:shadow-md transition-all"
                >
                  <Download className="w-4 h-4" />
                  {t('profile.downloadReport')}
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Tabs */}
            <div className="flex gap-2 p-1.5 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]">
              {(['overview', 'history', 'subjects'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-[var(--color-primary)] text-white shadow-sm'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]'
                  }`}
                >
                  {tab === 'overview' && t('profile.tabOverview')}
                  {tab === 'history' && t('profile.tabHistory')}
                  {tab === 'subjects' && t('profile.tabSubjects')}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="card p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-[var(--color-text)]">
                          {student.stats.totalClasses}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">{t('profile.totalClasses')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="card p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-emerald-600">{student.stats.attended}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{t('profile.attended')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="card p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-amber-600">{student.stats.late}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{t('profile.lateCount')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="card p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                        <XCircle className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-600">{student.stats.absent}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{t('profile.absentCount')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trend & Streak */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-[var(--color-text)]">{t('profile.trend')}</h3>
                      {trend >= 0 ? (
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <p className={`text-3xl font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)]">{t('profile.vsLastMonth')}</p>
                  </div>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-[var(--color-text)]">{t('profile.streak')}</h3>
                      <Award className="w-5 h-5 text-amber-500" />
                    </div>
                    <p className="text-3xl font-bold text-amber-600">{student.stats.streak}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {t('profile.longestStreak')}: {student.stats.longestStreak}
                    </p>
                  </div>
                </div>

                {/* Monthly Chart */}
                <div className="card p-5">
                  <h3 className="font-semibold text-[var(--color-text)] mb-4">{t('profile.monthlyAttendance')}</h3>
                  <div className="space-y-3">
                    {student.monthlyData.map((month) => (
                      <div key={month.month}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-[var(--color-text)]">{month.month}</span>
                          <span className="text-[var(--color-text-muted)]">
                            {month.attended}/{month.total} ({Math.round((month.attended / month.total) * 100)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-[var(--color-bg)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                            style={{ width: `${(month.attended / month.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-[var(--color-border)]">
                  <h3 className="font-semibold text-[var(--color-text)]">{t('profile.recentActivity')}</h3>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {student.recentActivity.map((activity, index) => (
                    <div key={index} className="p-4 hover:bg-[var(--color-bg)] transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(activity.status)}
                          <div>
                            <p className="font-medium text-[var(--color-text)]">{activity.subject}</p>
                            <p className="text-sm text-[var(--color-text-muted)]">
                              {activity.date} {activity.time && `• ${activity.time}`}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(activity.status, activity.lateBy)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subjects Tab */}
            {activeTab === 'subjects' && (
              <div className="space-y-4">
                {student.subjects.map((subject) => (
                  <div key={subject.name} className="card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-[var(--color-text)]">{subject.name}</h4>
                          <p className="text-sm text-[var(--color-text-muted)]">
                            {subject.attended}/{subject.total} {t('profile.classes')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${
                          subject.rate >= 90 ? 'text-emerald-600' :
                          subject.rate >= 75 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {subject.rate}%
                        </p>
                      </div>
                    </div>
                    <div className="h-2 bg-[var(--color-bg)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          subject.rate >= 90 ? 'bg-emerald-500' :
                          subject.rate >= 75 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${subject.rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">{t('profile.editProfile')}</h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('profile.name')}</label>
                <input 
                  type="text" 
                  defaultValue={student.name}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('profile.email')}</label>
                <input 
                  type="email" 
                  defaultValue={student.email}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('profile.phone')}</label>
                <input 
                  type="tel" 
                  defaultValue={student.phone}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-200 bg-slate-50">
              <button 
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2.5 border-2 border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-100 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={() => {
                  alert(t('profile.saveSuccess'))
                  setShowEditModal(false)
                }}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-xl hover:shadow-lg transition-all"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
