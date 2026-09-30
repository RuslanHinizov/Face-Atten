import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Mail,
  Clock,
  Calendar,
  Settings,
  Plus,
  Trash2,
  CheckCircle,
  X,
  Send,
  FileText,
  Users
} from 'lucide-react'

interface ScheduledReport {
  id: string
  name: string
  type: 'daily' | 'weekly' | 'monthly'
  recipients: string[]
  time: string
  dayOfWeek?: number
  dayOfMonth?: number
  enabled: boolean
  lastSent?: Date
  includeStats: boolean
  includeAbsentList: boolean
  includeLateList: boolean
}

interface AutoReportSchedulerProps {
  isOpen: boolean
  onClose: () => void
}

export function AutoReportScheduler({ isOpen, onClose }: AutoReportSchedulerProps) {
  const { t } = useTranslation()
  const [reports, setReports] = useState<ScheduledReport[]>([
    {
      id: '1',
      name: 'Күнделікті есеп',
      type: 'daily',
      recipients: ['admin@university.kz', 'dean@university.kz'],
      time: '18:00',
      enabled: true,
      lastSent: new Date(Date.now() - 86400000),
      includeStats: true,
      includeAbsentList: true,
      includeLateList: true
    },
    {
      id: '2',
      name: 'Апталық есеп',
      type: 'weekly',
      recipients: ['admin@university.kz'],
      time: '09:00',
      dayOfWeek: 1,
      enabled: true,
      includeStats: true,
      includeAbsentList: true,
      includeLateList: false
    }
  ])
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null)
  const [showManualSendModal, setShowManualSendModal] = useState(false)
  const [manualSendDate, setManualSendDate] = useState(new Date().toISOString().split('T')[0])
  const [manualSendRecipients, setManualSendRecipients] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'daily' as 'daily' | 'weekly' | 'monthly',
    recipients: '',
    time: '18:00',
    dayOfWeek: 1,
    dayOfMonth: 1,
    includeStats: true,
    includeAbsentList: true,
    includeLateList: true
  })

  const handleSave = () => {
    const newReport: ScheduledReport = {
      id: editingReport?.id || Date.now().toString(),
      name: formData.name,
      type: formData.type,
      recipients: formData.recipients.split(',').map(e => e.trim()).filter(Boolean),
      time: formData.time,
      dayOfWeek: formData.type === 'weekly' ? formData.dayOfWeek : undefined,
      dayOfMonth: formData.type === 'monthly' ? formData.dayOfMonth : undefined,
      enabled: true,
      includeStats: formData.includeStats,
      includeAbsentList: formData.includeAbsentList,
      includeLateList: formData.includeLateList
    }

    if (editingReport) {
      setReports(prev => prev.map(r => r.id === editingReport.id ? newReport : r))
    } else {
      setReports(prev => [...prev, newReport])
    }

    setShowAddModal(false)
    setEditingReport(null)
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'daily',
      recipients: '',
      time: '18:00',
      dayOfWeek: 1,
      dayOfMonth: 1,
      includeStats: true,
      includeAbsentList: true,
      includeLateList: true
    })
  }

  const handleEdit = (report: ScheduledReport) => {
    setEditingReport(report)
    setFormData({
      name: report.name,
      type: report.type,
      recipients: report.recipients.join(', '),
      time: report.time,
      dayOfWeek: report.dayOfWeek || 1,
      dayOfMonth: report.dayOfMonth || 1,
      includeStats: report.includeStats,
      includeAbsentList: report.includeAbsentList,
      includeLateList: report.includeLateList
    })
    setShowAddModal(true)
  }

  const handleDelete = (id: string) => {
    if (confirm(t('autoReport.confirmDelete'))) {
      setReports(prev => prev.filter(r => r.id !== id))
    }
  }

  const toggleEnabled = (id: string) => {
    setReports(prev => prev.map(r =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ))
  }

  const sendNow = (report: ScheduledReport) => {
    // In production, this would trigger an API call
    alert(`${t('autoReport.sendingTo')}: ${report.recipients.join(', ')}`)
    setReports(prev => prev.map(r =>
      r.id === report.id ? { ...r, lastSent: new Date() } : r
    ))
  }

  const sendManualReport = () => {
    if (!manualSendDate || !manualSendRecipients.trim()) {
      alert(t('autoReport.manualSend.validation'))
      return
    }
    
    const recipients = manualSendRecipients.split(',').map(e => e.trim()).filter(Boolean)
    const selectedDate = new Date(manualSendDate)
    
    // In production, this would trigger an API call to generate and send report for the selected date
    alert(t('autoReport.manualSend.sending', { 
      date: selectedDate.toLocaleDateString(), 
      recipients: recipients.join(', ') 
    }))
    
    setShowManualSendModal(false)
    setManualSendDate(new Date().toISOString().split('T')[0])
    setManualSendRecipients('')
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'daily': return t('autoReport.daily')
      case 'weekly': return t('autoReport.weekly')
      case 'monthly': return t('autoReport.monthly')
      default: return type
    }
  }

  const getDayLabel = (day: number) => {
    const days = [
      t('autoReport.sunday'),
      t('autoReport.monday'),
      t('autoReport.tuesday'),
      t('autoReport.wednesday'),
      t('autoReport.thursday'),
      t('autoReport.friday'),
      t('autoReport.saturday')
    ]
    return days[day]
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-2xl border border-[var(--color-border)] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[var(--color-border)] bg-gradient-to-r from-blue-500 to-cyan-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{t('autoReport.title')}</h2>
                <p className="text-sm text-white/80">{t('autoReport.subtitle')}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Manual Send Button */}
          <div className="mb-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-800 dark:text-emerald-200">{t('autoReport.manualSend.title')}</h3>
                  <p className="text-sm text-emerald-600 dark:text-emerald-300">{t('autoReport.manualSend.subtitle')}</p>
                </div>
              </div>
              <button
                onClick={() => setShowManualSendModal(true)}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {t('autoReport.manualSend.buttonText')}
              </button>
            </div>
          </div>

          {/* Add Button */}
          <button
            onClick={() => {
              resetForm()
              setEditingReport(null)
              setShowAddModal(true)
            }}
            className="w-full p-4 border-2 border-dashed border-[var(--color-border)] rounded-xl text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors flex items-center justify-center gap-2 mb-4"
          >
            <Plus className="w-5 h-5" />
            {t('autoReport.addSchedule')}
          </button>

          {/* Reports List */}
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className={`p-4 rounded-xl border transition-all ${
                  report.enabled
                    ? 'bg-[var(--color-bg)] border-[var(--color-border)]'
                    : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      report.type === 'daily' ? 'bg-blue-50 text-blue-600' :
                      report.type === 'weekly' ? 'bg-purple-50 text-purple-600' :
                      'bg-amber-50 text-amber-600'
                    }`}>
                      {report.type === 'daily' ? <Clock className="w-5 h-5" /> :
                       report.type === 'weekly' ? <Calendar className="w-5 h-5" /> :
                       <FileText className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--color-text)]">{report.name}</h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {getTypeLabel(report.type)} • {report.time}
                        {report.type === 'weekly' && ` • ${getDayLabel(report.dayOfWeek!)}`}
                        {report.type === 'monthly' && ` • ${report.dayOfMonth} ${t('autoReport.dayOfMonth')}`}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Users className="w-3 h-3 text-[var(--color-text-muted)]" />
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {report.recipients.length} {t('autoReport.recipients')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => sendNow(report)}
                      className="p-2 rounded-lg hover:bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                      title={t('autoReport.sendNow')}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(report)}
                      className="p-2 rounded-lg hover:bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="p-2 rounded-lg hover:bg-red-50 text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleEnabled(report.id)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        report.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          report.enabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {report.lastSent && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    {t('autoReport.lastSent')}: {report.lastSent.toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface)] rounded-xl shadow-xl w-full max-w-md border border-[var(--color-border)]">
              <div className="p-4 border-b border-[var(--color-border)]">
                <h3 className="font-semibold text-[var(--color-text)]">
                  {editingReport ? t('autoReport.editSchedule') : t('autoReport.addSchedule')}
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                    {t('autoReport.reportName')}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)]"
                    placeholder={t('autoReport.namePlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                    {t('autoReport.frequency')}
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'daily' | 'weekly' | 'monthly' }))}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)]"
                  >
                    <option value="daily">{t('autoReport.daily')}</option>
                    <option value="weekly">{t('autoReport.weekly')}</option>
                    <option value="monthly">{t('autoReport.monthly')}</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                      {t('autoReport.time')}
                    </label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                      className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)]"
                    />
                  </div>
                  {formData.type === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                        {t('autoReport.dayOfWeek')}
                      </label>
                      <select
                        value={formData.dayOfWeek}
                        onChange={(e) => setFormData(prev => ({ ...prev, dayOfWeek: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)]"
                      >
                        {[1, 2, 3, 4, 5, 6, 0].map(day => (
                          <option key={day} value={day}>{getDayLabel(day)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {formData.type === 'monthly' && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                        {t('autoReport.dayOfMonth')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="28"
                        value={formData.dayOfMonth}
                        onChange={(e) => setFormData(prev => ({ ...prev, dayOfMonth: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)]"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                    {t('autoReport.emailRecipients')}
                  </label>
                  <textarea
                    value={formData.recipients}
                    onChange={(e) => setFormData(prev => ({ ...prev, recipients: e.target.value }))}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] resize-none"
                    rows={2}
                    placeholder="email1@example.com, email2@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--color-text)]">
                    {t('autoReport.includeInReport')}
                  </label>
                  {[
                    { key: 'includeStats', label: t('autoReport.statistics') },
                    { key: 'includeAbsentList', label: t('autoReport.absentList') },
                    { key: 'includeLateList', label: t('autoReport.lateList') }
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData[key as keyof typeof formData] as boolean}
                        onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)]"
                      />
                      <span className="text-sm text-[var(--color-text)]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t border-[var(--color-border)] flex gap-2">
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingReport(null)
                  }}
                  className="flex-1 btn btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 btn btn-primary"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Send Modal */}
        {showManualSendModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface)] rounded-xl shadow-xl w-full max-w-md border border-[var(--color-border)]">
              <div className="p-4 border-b border-[var(--color-border)] bg-gradient-to-r from-emerald-500 to-teal-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-white">{t('autoReport.manualSend.modalTitle')}</h3>
                  </div>
                  <button
                    onClick={() => setShowManualSendModal(false)}
                    className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>{t('autoReport.manualSend.tip')}</strong> {t('autoReport.manualSend.tipText')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                    {t('autoReport.manualSend.dateLabel')}
                  </label>
                  <input
                    type="date"
                    value={manualSendDate}
                    onChange={(e) => setManualSendDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {t('autoReport.manualSend.dateHelp')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                    {t('autoReport.manualSend.emailLabel')}
                  </label>
                  <textarea
                    value={manualSendRecipients}
                    onChange={(e) => setManualSendRecipients(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    rows={3}
                    placeholder="admin@university.kz, dean@university.kz, manager@university.kz"
                  />
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {t('autoReport.manualSend.emailHelp')}
                  </p>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      <p className="font-medium mb-1">{t('autoReport.manualSend.contentTitle')}</p>
                      <ul className="text-xs space-y-0.5">
                        <li>• {t('autoReport.manualSend.contentItems.attendance')}</li>
                        <li>• {t('autoReport.manualSend.contentItems.lists')}</li>
                        <li>• {t('autoReport.manualSend.contentItems.stats')}</li>
                        <li>• {t('autoReport.manualSend.contentItems.analysis')}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-[var(--color-border)] flex gap-3">
                <button
                  onClick={() => setShowManualSendModal(false)}
                  className="flex-1 px-4 py-2.5 text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-bg)] rounded-lg transition-colors"
                >
                  {t('autoReport.manualSend.cancel')}
                </button>
                <button
                  onClick={sendManualReport}
                  disabled={!manualSendDate || !manualSendRecipients.trim()}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {t('autoReport.manualSend.send')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
