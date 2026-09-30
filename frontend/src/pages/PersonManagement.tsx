import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Users,
  UserPlus,
  Camera,
  Trash2,
  Upload,
  GraduationCap,
  ArrowLeft,
  Search,
  RefreshCw,
  AlertCircle,
  BookOpen,
  ChevronDown,
  Plus,
  Calendar,
  Globe,
  Download,
  Eye,
  CheckCircle,
  Clock,
  TrendingUp,
  Award,
  Grid3X3,
  List,
  Sparkles,
  ArrowUpRight,
  X
} from 'lucide-react'
import { getPersons, addPerson, deletePerson, uploadFaceImages } from '../services/api'
import type { Person } from '../services/mockData'

interface Group {
  id: string
  name: string
  description?: string
  studentIds: string[]
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

interface StudentStats {
  attendanceRate: number
  streak: number
  totalClasses: number
  attended: number
  late: number
  absent: number
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
  { id: 'g1', name: 'ИП-21', description: 'Аудитория 418', studentIds: ['418_1','418_2','418_3','418_4','418_5','418_6','418_7','418_8','418_9','418_10','418_11','418_12','418_13','418_14','418_15','418_16','418_17','418_18','418_19'], color: groupColors[0] },
  { id: 'g2', name: 'СТ-21', description: 'Аудитория 428', studentIds: ['428_1','428_2','428_3','428_4','428_5','428_6','428_8','428_9','428_10','428_11','428_12','428_13','428_14','428_15','428_16','428_17','428_18','428_19','428_21'], color: groupColors[1] },
]

const demoSchedule: ScheduleItem[] = [
  { id: 's1', groupId: 'g1', dayOfWeek: 0, startTime: '08:30', endTime: '09:50', subject: 'Алгоритмдер', room: '101' },
  { id: 's2', groupId: 'g1', dayOfWeek: 0, startTime: '10:00', endTime: '11:20', subject: 'Деректер қоры', room: '203' },
  { id: 's3', groupId: 'g1', dayOfWeek: 1, startTime: '08:30', endTime: '09:50', subject: 'Веб-технологиялар', room: '305' },
  { id: 's4', groupId: 'g2', dayOfWeek: 0, startTime: '08:30', endTime: '09:50', subject: 'Компьютерлік желілер', room: '202' },
  { id: 's5', groupId: 'g3', dayOfWeek: 0, startTime: '10:00', endTime: '11:20', subject: 'Java бағдарламалау', room: '104' },
]

const mockStudentStats: Record<string, StudentStats> = {
  '1': { attendanceRate: 95, streak: 12, totalClasses: 40, attended: 38, late: 1, absent: 1 },
  '2': { attendanceRate: 88, streak: 5, totalClasses: 40, attended: 35, late: 3, absent: 2 },
  '3': { attendanceRate: 72, streak: 2, totalClasses: 40, attended: 29, late: 5, absent: 6 },
  '4': { attendanceRate: 98, streak: 20, totalClasses: 40, attended: 39, late: 1, absent: 0 },
  '5': { attendanceRate: 65, streak: 0, totalClasses: 40, attended: 26, late: 4, absent: 10 },
}

export function PersonManagement() {
  const { t, i18n } = useTranslation()
  const [persons, setPersons] = useState<Person[]>([])
  const [groups, setGroups] = useState<Group[]>(demoGroups)
  const [schedule, setSchedule] = useState<ScheduleItem[]>(demoSchedule)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'students' | 'groups' | 'schedule'>('students')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'withFace' | 'withoutFace'>('all')

  const [showAddModal, setShowAddModal] = useState(false)
  const [showFaceModal, setShowFaceModal] = useState<string | null>(null)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showLessonDetailModal, setShowLessonDetailModal] = useState<ScheduleItem | null>(null)

  // New student form fields
  const [newName, setNewName] = useState('')
  const [newSurname, setNewSurname] = useState('')
  const [newPatronymic, setNewPatronymic] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newStudentId, setNewStudentId] = useState('')
  const [newBirthDate, setNewBirthDate] = useState('')
  const [newGender, setNewGender] = useState<'male' | 'female' | ''>('')
  const [newGroupId, setNewGroupId] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [adding, setAdding] = useState(false)

  const [faceImages, setFaceImages] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')

  const [newScheduleGroupId, setNewScheduleGroupId] = useState('')
  const [newScheduleDay, setNewScheduleDay] = useState(0)
  const [newScheduleStart, setNewScheduleStart] = useState('08:30')
  const [newScheduleEnd, setNewScheduleEnd] = useState('09:50')
  const [newScheduleSubject, setNewScheduleSubject] = useState('')
  const [newScheduleRoom, setNewScheduleRoom] = useState('')

  const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

  const changeLanguage = (lang: string) => { i18n.changeLanguage(lang) }

  useEffect(() => { fetchPersons() }, [])

  const fetchPersons = async () => {
    setLoading(true)
    try {
      const data = await getPersons()
      setPersons(data.filter(p => p.role === 'student'))
    } catch (error) {
      console.error('Error fetching persons:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddPerson = async () => {
    if (!newName.trim() || !newSurname.trim()) return
    setAdding(true)
    try {
      const fullName = `${newSurname} ${newName}${newPatronymic ? ' ' + newPatronymic : ''}`
      const newPerson = await addPerson(fullName, 'student')
      if (newGroupId) {
        setGroups(prev => prev.map(g => g.id === newGroupId ? { ...g, studentIds: [...g.studentIds, newPerson.id] } : g))
      }
      // Reset all form fields
      setNewName('')
      setNewSurname('')
      setNewPatronymic('')
      setNewEmail('')
      setNewPhone('')
      setNewStudentId('')
      setNewBirthDate('')
      setNewGender('')
      setNewGroupId('')
      setNewAddress('')
      setNewNotes('')
      setShowAddModal(false)
      fetchPersons()
    } catch (error) {
      console.error('Error adding person:', error)
    } finally {
      setAdding(false)
    }
  }

  const handleDeletePerson = async (id: string) => {
    if (!confirm(t('persons.confirmDelete'))) return
    try {
      await deletePerson(id)
      setGroups(prev => prev.map(g => ({ ...g, studentIds: g.studentIds.filter(sid => sid !== id) })))
      setSelectedStudents(prev => prev.filter(sid => sid !== id))
      fetchPersons()
    } catch (error) {
      console.error('Error deleting person:', error)
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(t('persons.confirmBulkDelete', { count: selectedStudents.length }))) return
    for (const id of selectedStudents) {
      try { await deletePerson(id) } catch (error) { console.error('Error deleting person:', error) }
    }
    setGroups(prev => prev.map(g => ({ ...g, studentIds: g.studentIds.filter(sid => !selectedStudents.includes(sid)) })))
    setSelectedStudents([])
    fetchPersons()
  }

  const handleUploadFaceImages = async (personId: string) => {
    if (faceImages.length < 1) { alert(t('persons.selectPhoto')); return }
    setUploading(true)
    try {
      const result = await uploadFaceImages(personId, faceImages)
      if (result.success) { setFaceImages([]); setShowFaceModal(null); fetchPersons(); alert(result.message) }
    } catch (error) {
      console.error('Error uploading faces:', error)
      alert(t('persons.uploadError'))
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setFaceImages(prev => [...prev, ...files].slice(0, 10))
  }

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return
    const newGroup: Group = { id: `g${Date.now()}`, name: newGroupName, description: newGroupDescription || undefined, studentIds: [], color: groupColors[groups.length % groupColors.length] }
    setGroups(prev => [...prev, newGroup])
    setNewGroupName('')
    setNewGroupDescription('')
    setShowGroupModal(false)
  }

  const handleAddSchedule = () => {
    if (!newScheduleGroupId || !newScheduleSubject.trim()) return
    const newItem: ScheduleItem = { id: `s${Date.now()}`, groupId: newScheduleGroupId, dayOfWeek: newScheduleDay, startTime: newScheduleStart, endTime: newScheduleEnd, subject: newScheduleSubject, room: newScheduleRoom }
    setSchedule(prev => [...prev, newItem])
    setNewScheduleSubject('')
    setNewScheduleRoom('')
    setShowScheduleModal(false)
  }

  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'Group', 'Has Face', 'Attendance Rate']
    const rows = filteredPersons.map(p => {
      const group = groups.find(g => g.studentIds.includes(p.id))
      const stats = mockStudentStats[p.id]
      return [p.id, p.name, group?.name || '-', p.has_face_encoding ? 'Yes' : 'No', stats?.attendanceRate || '-']
    })
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'students.csv'
    a.click()
  }

  const handleImportCSV = () => { alert(t('persons.importSuccess')); setShowImportModal(false) }

  const getStudentsInGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId)
    if (!group) return []
    return persons.filter(p => group.studentIds.includes(p.id))
  }

  const getGroupSchedule = (groupId: string) => schedule.filter(s => s.groupId === groupId)

  const toggleStudentSelection = (id: string) => {
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id])
  }

  const selectAllStudents = () => {
    if (selectedStudents.length === filteredPersons.length) { setSelectedStudents([]) }
    else { setSelectedStudents(filteredPersons.map(p => p.id)) }
  }

  const filteredPersons = useMemo(() => {
    let result = selectedGroup ? getStudentsInGroup(selectedGroup) : persons.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    if (statusFilter === 'withFace') result = result.filter(p => p.has_face_encoding)
    else if (statusFilter === 'withoutFace') result = result.filter(p => !p.has_face_encoding)
    return result
  }, [persons, selectedGroup, search, statusFilter, groups])

  const studentsWithFace = persons.filter(p => p.has_face_encoding).length
  const studentsWithoutFace = persons.length - studentsWithFace
  const avgAttendance = useMemo(() => {
    const rates = Object.values(mockStudentStats).map(s => s.attendanceRate)
    return rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0
  }, [])

  const getStudentStats = (id: string): StudentStats => mockStudentStats[id] || { attendanceRate: 0, streak: 0, totalClasses: 0, attended: 0, late: 0, absent: 0 }
  const getAttendanceColor = (rate: number) => { if (rate >= 90) return 'text-emerald-600 bg-emerald-50'; if (rate >= 75) return 'text-amber-600 bg-amber-50'; return 'text-red-600 bg-red-50' }


  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/10 to-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-gradient-to-br from-emerald-400/10 to-teal-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--color-border)]">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="group w-11 h-11 rounded-2xl bg-[var(--color-surface)] hover:bg-gradient-to-br hover:from-blue-500 hover:to-indigo-600 border border-[var(--color-border)] hover:border-transparent flex items-center justify-center transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-blue-500/25">
                <ArrowLeft className="w-5 h-5 text-[var(--color-text-secondary)] group-hover:text-white transition-colors" />
              </Link>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30">
                    <GraduationCap className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[var(--color-surface)]">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">
                    {t('persons.title')}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-2">
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {persons.length} {t('persons.studentsCount')}</span>
                    <span className="text-[var(--color-text-muted)]">•</span>
                    <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {groups.length} {t('persons.groupsCount')}</span>
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
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30 scale-105'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]'}`}>
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-5">
            {[
              { id: 'students', icon: Users, label: t('persons.tabs.students') },
              { id: 'groups', icon: BookOpen, label: t('persons.tabs.groups') },
              { id: 'schedule', icon: Calendar, label: t('persons.tabs.schedule') }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-5 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 flex items-center gap-2.5 ${activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] hover:shadow-sm'}`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto p-6 relative">
        {/* Students Tab */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            {/* Enhanced Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="col-span-2 lg:col-span-1 group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 p-6 shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/30 transition-all duration-500">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzLTItMi00LTJjLTIgMC00IDItNCAyczIgNCA0IDRjMiAwIDQtMiA0LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                  </div>
                  <p className="text-4xl font-black text-white mb-1">{persons.length}</p>
                  <p className="text-sm text-blue-100 font-medium">{t('persons.stats.totalStudents')}</p>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-3xl bg-[var(--color-surface)] p-5 shadow-lg hover:shadow-xl hover:shadow-emerald-500/10 border border-[var(--color-border)] transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <Camera className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-[var(--color-text)]">{studentsWithFace}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{t('persons.stats.faceRegistered')}</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-1000" style={{ width: `${persons.length ? (studentsWithFace / persons.length) * 100 : 0}%` }} />
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-3xl bg-[var(--color-surface)] p-5 shadow-lg hover:shadow-xl hover:shadow-amber-500/10 border border-[var(--color-border)] transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <AlertCircle className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-[var(--color-text)]">{studentsWithoutFace}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{t('persons.stats.needPhoto')}</p>
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-3xl bg-[var(--color-surface)] p-5 shadow-lg hover:shadow-xl hover:shadow-purple-500/10 border border-[var(--color-border)] transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <BookOpen className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-[var(--color-text)]">{groups.length}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{t('persons.stats.groups')}</p>
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-3xl bg-[var(--color-surface)] p-5 shadow-lg hover:shadow-xl hover:shadow-indigo-500/10 border border-[var(--color-border)] transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <TrendingUp className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-[var(--color-text)]">{avgAttendance}%</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{t('persons.avgAttendance')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Search, Filters and Actions */}
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex flex-wrap gap-3 flex-1 w-full lg:w-auto">
                <div className="relative flex-1 min-w-[280px] max-w-md group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)] group-focus-within:text-blue-500 transition-colors" />
                  <input type="text" placeholder={t('persons.search')} value={search} onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" />
                </div>

                <div className="relative">
                  <select value={selectedGroup || ''} onChange={(e) => setSelectedGroup(e.target.value || null)}
                    className="appearance-none pl-4 pr-10 py-3.5 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm cursor-pointer">
                    <option value="">{t('persons.allGroups')}</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)] pointer-events-none" />
                </div>

                <div className="flex items-center gap-1 p-1 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl shadow-sm">
                  <button onClick={() => setStatusFilter('all')} className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter === 'all' ? 'bg-[var(--color-text)] text-[var(--color-surface)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]'}`}>
                    {t('common.all')}
                  </button>
                  <button onClick={() => setStatusFilter('withFace')} className={`px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${statusFilter === 'withFace' ? 'bg-emerald-500 text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]'}`}>
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button onClick={() => setStatusFilter('withoutFace')} className={`px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${statusFilter === 'withoutFace' ? 'bg-amber-500 text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]'}`}>
                    <AlertCircle className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1 p-1 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl shadow-sm">
                  <button onClick={() => setViewMode('grid')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-[var(--color-text)] text-[var(--color-surface)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]'}`}>
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-[var(--color-text)] text-[var(--color-surface)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]'}`}>
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                {selectedStudents.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
                    <span className="text-sm font-medium text-red-700 dark:text-red-400">{selectedStudents.length} {t('persons.selected')}</span>
                    <button onClick={handleBulkDelete} className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setSelectedStudents([])} className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-3 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] font-medium hover:border-[var(--color-border-light)] hover:shadow-md transition-all">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('persons.export')}</span>
                </button>
                <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-4 py-3 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] font-medium hover:border-[var(--color-border-light)] hover:shadow-md transition-all">
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('persons.import')}</span>
                </button>
                <button onClick={fetchPersons} className="p-3 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] hover:border-[var(--color-border-light)] hover:shadow-md transition-all">
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] transition-all">
                  <UserPlus className="w-5 h-5" />
                  {t('persons.addStudent')}
                </button>
              </div>
            </div>

            {/* Bulk Select */}
            {filteredPersons.length > 0 && (
              <div className="flex items-center gap-3">
                <button onClick={selectAllStudents} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectedStudents.length === filteredPersons.length ? 'bg-blue-500 border-blue-500' : 'border-[var(--color-border)]'}`}>
                    {selectedStudents.length === filteredPersons.length && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                  </div>
                  {selectedStudents.length === filteredPersons.length ? t('persons.deselectAll') : t('persons.selectAll')}
                </button>
                <span className="text-sm text-[var(--color-text-muted)]">({filteredPersons.length} {t('persons.studentsCount')})</span>
              </div>
            )}


            {/* Students Grid/List */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
                  <p className="text-[var(--color-text-secondary)] font-medium">{t('common.loading')}</p>
                </div>
              </div>
            ) : filteredPersons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-[var(--color-surface)] rounded-3xl border-2 border-dashed border-[var(--color-border)]">
                <div className="w-20 h-20 rounded-3xl bg-[var(--color-surface-elevated)] flex items-center justify-center mb-4">
                  <Users className="w-10 h-10 text-[var(--color-text-muted)]" />
                </div>
                <p className="text-[var(--color-text-secondary)] font-medium mb-2">{t('persons.noStudents')}</p>
                <button onClick={() => setShowAddModal(true)} className="text-blue-500 hover:text-blue-600 font-semibold hover:underline">
                  {t('persons.addFirst')}
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredPersons.map((person) => {
                  const personGroup = groups.find(g => g.studentIds.includes(person.id))
                  const stats = getStudentStats(person.id)
                  const isSelected = selectedStudents.includes(person.id)
                  return (
                    <div key={person.id} className={`group relative bg-[var(--color-surface)] rounded-3xl border-2 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isSelected ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-[var(--color-border)] hover:border-[var(--color-border-light)]'}`}>
                      {/* Selection Checkbox */}
                      <button onClick={() => toggleStudentSelection(person.id)} className={`absolute top-4 left-4 z-10 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-sm opacity-0 group-hover:opacity-100'}`}>
                        {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                      </button>

                      {/* Card Header with Gradient */}
                      <div className={`h-24 bg-gradient-to-br ${personGroup?.color || 'from-slate-400 to-slate-500'} relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-black/10" />
                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--color-surface)] to-transparent" />
                      </div>

                      {/* Avatar */}
                      <div className="relative -mt-12 px-5">
                        <div className="relative inline-block">
                          <div className="w-20 h-20 rounded-2xl bg-[var(--color-surface)] border-4 border-[var(--color-surface)] shadow-lg overflow-hidden">
                            {person.photo_url ? (
                              <img src={person.photo_url} alt={person.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-br ${personGroup?.color || 'from-slate-400 to-slate-500'} flex items-center justify-center`}>
                                <span className="text-2xl font-bold text-white">{person.name[0]}</span>
                              </div>
                            )}
                          </div>
                          {person.has_face_encoding ? (
                            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-xl flex items-center justify-center border-2 border-[var(--color-surface)] shadow-md">
                              <Camera className="w-4 h-4 text-white" />
                            </div>
                          ) : (
                            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-amber-500 rounded-xl flex items-center justify-center border-2 border-[var(--color-surface)] shadow-md animate-pulse">
                              <AlertCircle className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5 pt-3">
                        <h3 className="font-bold text-[var(--color-text)] text-lg truncate mb-1">{person.name}</h3>
                        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                          {personGroup ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-surface-elevated)] rounded-lg">
                              <BookOpen className="w-3.5 h-3.5" />
                              {personGroup.name}
                            </span>
                          ) : t('persons.groupNotAssigned')}
                        </p>

                        {/* Mini Stats */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          <div className="text-center p-2 bg-[var(--color-surface-elevated)] rounded-xl">
                            <p className={`text-lg font-bold ${stats.attendanceRate >= 90 ? 'text-emerald-600' : stats.attendanceRate >= 75 ? 'text-amber-600' : 'text-red-600'}`}>{stats.attendanceRate}%</p>
                            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">{t('persons.attendance')}</p>
                          </div>
                          <div className="text-center p-2 bg-[var(--color-surface-elevated)] rounded-xl">
                            <p className="text-lg font-bold text-blue-600">{stats.streak}</p>
                            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">{t('persons.streak')}</p>
                          </div>
                          <div className="text-center p-2 bg-[var(--color-surface-elevated)] rounded-xl">
                            <p className="text-lg font-bold text-[var(--color-text)]">{stats.totalClasses}</p>
                            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">{t('persons.classes')}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Link to={`/persons/${person.id}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border)] text-[var(--color-text)] font-medium rounded-xl transition-colors">
                            <Eye className="w-4 h-4" />
                            {t('persons.viewProfile')}
                          </Link>
                          {!person.has_face_encoding && (
                            <button onClick={() => setShowFaceModal(person.id)} className="p-2.5 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-xl transition-colors">
                              <Camera className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleDeletePerson(person.id)} className="p-2.5 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* List View */
              <div className="bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[var(--color-surface-elevated)] border-b border-[var(--color-border)]">
                        <th className="px-4 py-4 text-left">
                          <button onClick={selectAllStudents} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectedStudents.length === filteredPersons.length ? 'bg-blue-500 border-blue-500' : 'border-[var(--color-border)]'}`}>
                            {selectedStudents.length === filteredPersons.length && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                          </button>
                        </th>
                        <th className="px-4 py-4 text-left text-sm font-semibold text-[var(--color-text-secondary)]">{t('persons.student')}</th>
                        <th className="px-4 py-4 text-left text-sm font-semibold text-[var(--color-text-secondary)]">{t('persons.tabs.groups')}</th>
                        <th className="px-4 py-4 text-center text-sm font-semibold text-[var(--color-text-secondary)]">{t('persons.faceStatus')}</th>
                        <th className="px-4 py-4 text-center text-sm font-semibold text-[var(--color-text-secondary)]">{t('persons.attendance')}</th>
                        <th className="px-4 py-4 text-center text-sm font-semibold text-[var(--color-text-secondary)]">{t('persons.streak')}</th>
                        <th className="px-4 py-4 text-right text-sm font-semibold text-[var(--color-text-secondary)]">{t('persons.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {filteredPersons.map((person) => {
                        const personGroup = groups.find(g => g.studentIds.includes(person.id))
                        const stats = getStudentStats(person.id)
                        const isSelected = selectedStudents.includes(person.id)
                        return (
                          <tr key={person.id} className={`hover:bg-[var(--color-surface-elevated)] transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                            <td className="px-4 py-4">
                              <button onClick={() => toggleStudentSelection(person.id)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-[var(--color-border)]'}`}>
                                {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                              </button>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                                  {person.photo_url ? (
                                    <img src={person.photo_url} alt={person.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-sm font-bold text-white">{person.name[0]}</span>
                                  )}
                                </div>
                                <span className="font-semibold text-[var(--color-text)]">{person.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {personGroup ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-surface-elevated)] text-[var(--color-text)] text-sm font-medium rounded-lg">
                                  <BookOpen className="w-3.5 h-3.5" />
                                  {personGroup.name}
                                </span>
                              ) : (
                                <span className="text-[var(--color-text-muted)] text-sm">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-center">
                              {person.has_face_encoding ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-medium rounded-lg">
                                  <CheckCircle className="w-4 h-4" />
                                </span>
                              ) : (
                                <button onClick={() => setShowFaceModal(person.id)} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors">
                                  <Camera className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-1 text-sm font-bold rounded-lg ${getAttendanceColor(stats.attendanceRate)}`}>
                                {stats.attendanceRate}%
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)]">
                                <Award className="w-4 h-4 text-amber-500" />
                                {stats.streak}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Link to={`/persons/${person.id}`} className="p-2 text-[var(--color-text-muted)] hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                                  <Eye className="w-4 h-4" />
                                </Link>
                                <button onClick={() => handleDeletePerson(person.id)} className="p-2 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}


        {/* Groups Tab */}
        {activeTab === 'groups' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-[var(--color-text)]">{t('persons.groupsList')}</h2>
              <button onClick={() => setShowGroupModal(true)} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] transition-all">
                <Plus className="w-5 h-5" />
                {t('persons.addGroup')}
              </button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {groups.map((group) => {
                const students = getStudentsInGroup(group.id)
                const groupSchedule = getGroupSchedule(group.id)
                return (
                  <div key={group.id} className="group relative bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    {/* Header */}
                    <div className={`h-20 bg-gradient-to-br ${group.color || 'from-slate-400 to-slate-500'} relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-black/10" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <h3 className="text-2xl font-black text-white tracking-tight">{group.name}</h3>
                      </div>
                    </div>

                    <div className="p-5">
                      {group.description && (
                        <p className="text-sm text-[var(--color-text-secondary)] mb-4">{group.description}</p>
                      )}

                      {/* Students Preview */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex -space-x-2">
                          {students.slice(0, 5).map((s) => (
                            <div key={s.id} className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 border-2 border-[var(--color-surface)] flex items-center justify-center overflow-hidden shadow-sm">
                              {s.photo_url ? (
                                <img src={s.photo_url} alt={s.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-white">{s.name[0]}</span>
                              )}
                            </div>
                          ))}
                          {students.length > 5 && (
                            <div className="w-9 h-9 rounded-full bg-[var(--color-surface-elevated)] border-2 border-[var(--color-surface)] flex items-center justify-center shadow-sm">
                              <span className="text-xs font-bold text-[var(--color-text-secondary)]">+{students.length - 5}</span>
                            </div>
                          )}
                        </div>
                        <span className="px-3 py-1.5 bg-[var(--color-surface-elevated)] text-[var(--color-text)] text-sm font-semibold rounded-xl">
                          {students.length} {t('persons.students')}
                        </span>
                      </div>

                      {/* Schedule Info */}
                      {groupSchedule.length > 0 && (
                        <button onClick={() => { setSelectedGroup(group.id); setActiveTab('schedule') }}
                          className="w-full flex items-center justify-between p-3 bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border)] rounded-xl transition-colors group/btn mb-4">
                          <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm font-medium">{t('persons.scheduleTitle')} ({groupSchedule.length})</span>
                          </div>
                          <ArrowUpRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover/btn:text-[var(--color-text-secondary)] group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-all" />
                        </button>
                      )}

                      {students.length === 0 && (
                        <p className="text-sm text-[var(--color-text-muted)] mb-4">{t('persons.noStudentsInGroup')}</p>
                      )}

                      <button onClick={() => { setSelectedGroup(group.id); setActiveTab('students') }}
                        className="w-full py-2.5 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors">
                        {t('persons.viewStudents')} →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            {/* Header with Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Main Header Card */}
              <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 p-6 shadow-xl shadow-purple-500/25">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzLTItMi00LTJjLTIgMC00IDItNCAyczIgNCA0IDRjMiAwIDQtMiA0LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
                <div className="relative flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">{t('persons.scheduleGrid')}</h2>
                        <p className="text-purple-100 text-sm">{t('persons.scheduleSubtitle')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-4">
                      <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl">
                        <span className="text-white/80 text-sm">{t('persons.totalLessons')}: </span>
                        <span className="text-white font-bold text-lg">{schedule.length}</span>
                      </div>
                      <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl">
                        <span className="text-white/80 text-sm">{t('persons.activeGroups')}: </span>
                        <span className="text-white font-bold text-lg">{groups.filter(g => schedule.some(s => s.groupId === g.id)).length}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setShowScheduleModal(true)} className="flex items-center gap-2 px-6 py-3.5 bg-white text-purple-600 font-bold rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all">
                    <Plus className="w-5 h-5" />
                    {t('persons.addLesson')}
                  </button>
                </div>
              </div>

              {/* Today's Schedule Card */}
              <div className="relative overflow-hidden rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--color-text)]">{t('persons.todaySchedule')}</h3>
                    <p className="text-xs text-[var(--color-text-secondary)]">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {schedule.filter(s => s.dayOfWeek === new Date().getDay() - 1).slice(0, 3).map((item) => {
                    const group = groups.find(g => g.id === item.groupId)
                    return (
                      <div key={item.id} className="flex items-center gap-3 p-2 bg-[var(--color-surface-elevated)] rounded-xl">
                        <div className={`w-1.5 h-8 rounded-full bg-gradient-to-b ${group?.color || 'from-slate-400 to-slate-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--color-text)] truncate">{item.subject}</p>
                          <p className="text-xs text-[var(--color-text-secondary)]">{group?.name} • {item.startTime}</p>
                        </div>
                      </div>
                    )
                  })}
                  {schedule.filter(s => s.dayOfWeek === new Date().getDay() - 1).length === 0 && (
                    <p className="text-sm text-[var(--color-text-muted)] text-center py-4">{t('persons.noLessonsToday')}</p>
                  )}
                </div>
              </div>

              {/* Quick Filter Card */}
              <div className="relative overflow-hidden rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--color-text)]">{t('persons.filterByGroup')}</h3>
                    <p className="text-xs text-[var(--color-text-secondary)]">{t('persons.selectToFilter')}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <button onClick={() => setSelectedGroup(null)} className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all ${!selectedGroup ? 'bg-amber-500 text-white' : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'}`}>
                    {t('persons.allGroups')}
                  </button>
                  {groups.slice(0, 3).map((group) => (
                    <button key={group.id} onClick={() => setSelectedGroup(group.id)} className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${selectedGroup === group.id ? 'bg-amber-500 text-white' : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'}`}>
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${group.color || 'from-slate-400 to-slate-500'}`} />
                      {group.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Weekly Schedule Grid */}
            <div className="bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] overflow-hidden shadow-xl">
              {/* Time Header */}
              <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{t('persons.weeklySchedule')}</h3>
                      <p className="text-slate-400 text-sm">{selectedGroup ? groups.find(g => g.id === selectedGroup)?.name : t('persons.allGroups')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedGroup && (
                      <button onClick={() => setSelectedGroup(null)} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors">
                        <X className="w-4 h-4" />
                        {t('persons.clearFilter')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Schedule Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--color-surface-elevated)]">
                      <th className="px-6 py-5 text-left">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[var(--color-text-muted)]" />
                          <span className="text-sm font-bold text-[var(--color-text)] uppercase tracking-wider">{t('persons.tabs.groups')}</span>
                        </div>
                      </th>
                      {dayKeys.map((day, index) => {
                        const isToday = new Date().getDay() - 1 === index
                        return (
                          <th key={day} className={`px-4 py-5 text-center min-w-[140px] ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                            <div className={`inline-flex flex-col items-center ${isToday ? 'text-blue-600' : 'text-[var(--color-text-secondary)]'}`}>
                              <span className="text-xs font-medium uppercase tracking-wider">{t(`persons.daysFull.${day}`)}</span>
                              {isToday && (
                                <span className="mt-1 px-2 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full">{t('persons.today')}</span>
                              )}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {(selectedGroup ? groups.filter(g => g.id === selectedGroup) : groups).map((group, groupIndex) => (
                      <tr key={group.id} className={`hover:bg-[var(--color-surface-elevated)] transition-colors ${groupIndex % 2 === 0 ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-surface-elevated)]/30'}`}>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className={`w-1.5 h-14 rounded-full bg-gradient-to-b ${group.color || 'from-slate-400 to-slate-500'}`} />
                            <div>
                              <span className="font-bold text-[var(--color-text)] text-lg">{group.name}</span>
                              <p className="text-sm text-[var(--color-text-secondary)]">{group.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-[var(--color-text-muted)]">{group.studentIds.length} {t('persons.studentsCount')}</span>
                                <span className="text-[var(--color-text-muted)]">•</span>
                                <span className="text-xs text-[var(--color-text-muted)]">{schedule.filter(s => s.groupId === group.id).length} {t('persons.lessonsCount')}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        {dayKeys.map((_, dayIndex) => {
                          const daySchedule = schedule.filter(s => s.groupId === group.id && s.dayOfWeek === dayIndex)
                          const isToday = new Date().getDay() - 1 === dayIndex
                          return (
                            <td key={dayIndex} className={`px-3 py-4 ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                              {daySchedule.length > 0 ? (
                                <div className="space-y-2">
                                  {daySchedule.map((item) => (
                                    <div key={item.id} onClick={() => setShowLessonDetailModal(item)} className={`group relative bg-gradient-to-br ${group.color || 'from-slate-400 to-slate-500'} text-white p-3 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer`}>
                                      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 rounded-2xl transition-colors" />
                                      <div className="relative">
                                        <div className="font-bold text-sm truncate mb-1">{item.subject}</div>
                                        <div className="flex items-center gap-1.5 text-white/80 text-xs">
                                          <Clock className="w-3 h-3" />
                                          <span>{item.startTime} - {item.endTime}</span>
                                        </div>
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20">
                                          <div className="flex items-center gap-1 text-white/70 text-xs">
                                            <BookOpen className="w-3 h-3" />
                                            <span>#{item.room}</span>
                                          </div>
                                          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                            <Eye className="w-3 h-3 text-white/80" />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center h-20">
                                  <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-elevated)] flex items-center justify-center">
                                    <span className="text-[var(--color-text-muted)] text-lg">—</span>
                                  </div>
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer Stats */}
              <div className="bg-[var(--color-surface-elevated)] px-6 py-4 border-t border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600" />
                      <span className="text-sm text-[var(--color-text-secondary)]">{t('persons.morningClasses')}: {schedule.filter(s => parseInt(s.startTime) < 12).length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-500 to-orange-600" />
                      <span className="text-sm text-[var(--color-text-secondary)]">{t('persons.afternoonClasses')}: {schedule.filter(s => parseInt(s.startTime) >= 12).length}</span>
                    </div>
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)]">
                    {t('persons.lastUpdated')}: {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 shadow-sm">
              <div className="flex items-center gap-6 flex-wrap">
                <span className="text-sm font-semibold text-[var(--color-text)]">{t('persons.groupColors')}:</span>
                {groups.map((group) => (
                  <div key={group.id} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-lg bg-gradient-to-br ${group.color || 'from-slate-400 to-slate-500'}`} />
                    <span className="text-sm text-[var(--color-text-secondary)]">{group.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>


      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 relative overflow-hidden flex-shrink-0">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzLTItMi00LTJjLTIgMC00IDItNCAyczIgNCA0IDRjMiAwIDQtMiA0LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <UserPlus className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{t('persons.modal.addStudent')}</h2>
                  <p className="text-blue-100 text-sm mt-0.5">{t('persons.modal.fillAllFields')}</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-xl transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Form Content - Scrollable */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Personal Info Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  {t('persons.modal.personalInfo')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.surname')} *</label>
                    <input type="text" value={newSurname} onChange={(e) => setNewSurname(e.target.value)} placeholder={t('persons.modal.surnamePlaceholder')}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.firstName')} *</label>
                    <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('persons.modal.firstNamePlaceholder')}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.patronymic')}</label>
                    <input type="text" value={newPatronymic} onChange={(e) => setNewPatronymic(e.target.value)} placeholder={t('persons.modal.patronymicPlaceholder')}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.birthDate')}</label>
                    <input type="date" value={newBirthDate} onChange={(e) => setNewBirthDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.gender')}</label>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setNewGender('male')}
                        className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-all ${newGender === 'male' ? 'bg-blue-500 border-blue-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                        {t('persons.modal.male')}
                      </button>
                      <button type="button" onClick={() => setNewGender('female')}
                        className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-all ${newGender === 'female' ? 'bg-pink-500 border-pink-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-pink-300'}`}>
                        {t('persons.modal.female')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Academic Info Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-purple-500" />
                  {t('persons.modal.academicInfo')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.studentId')}</label>
                    <input type="text" value={newStudentId} onChange={(e) => setNewStudentId(e.target.value)} placeholder={t('persons.modal.studentIdPlaceholder')}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.selectGroup')}</label>
                    <select value={newGroupId} onChange={(e) => setNewGroupId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all">
                      <option value="">{t('persons.modal.selectGroupPlaceholder')}</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name} - {g.description}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact Info Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-500" />
                  {t('persons.modal.contactInfo')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.email')}</label>
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={t('persons.modal.emailPlaceholder')}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.phone')}</label>
                    <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+7 (___) ___-__-__"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.address')}</label>
                  <input type="text" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder={t('persons.modal.addressPlaceholder')}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all" />
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-500" />
                  {t('persons.modal.additionalInfo')}
                </h3>
                <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder={t('persons.modal.notesPlaceholder')} rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all resize-none" />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
              <p className="text-sm text-slate-500">
                <span className="text-red-500">*</span> {t('persons.modal.requiredFields')}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowAddModal(false)} className="px-6 py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl transition-colors">
                  {t('persons.modal.cancel')}
                </button>
                <button onClick={handleAddPerson} disabled={adding || !newName.trim() || !newSurname.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all flex items-center gap-2">
                  {adding ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {t('persons.modal.adding')}
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      {t('persons.modal.addStudent')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-purple-500 to-pink-600">
              <h2 className="text-xl font-bold text-white">{t('persons.modal.addGroup')}</h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.groupName')}</label>
                <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder={t('persons.modal.groupNamePlaceholder')}
                  className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.description')}</label>
                <input type="text" value={newGroupDescription} onChange={(e) => setNewGroupDescription(e.target.value)} placeholder={t('persons.modal.descriptionPlaceholder')}
                  className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all" />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowGroupModal(false)} className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl transition-colors">
                {t('persons.modal.cancel')}
              </button>
              <button onClick={handleAddGroup} disabled={!newGroupName.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {t('persons.modal.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-emerald-500 to-teal-600">
              <h2 className="text-xl font-bold text-white">{t('persons.modal.addLesson')}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.selectGroupRequired')}</label>
                <select value={newScheduleGroupId} onChange={(e) => setNewScheduleGroupId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all">
                  <option value="">—</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.day')}</label>
                <select value={newScheduleDay} onChange={(e) => setNewScheduleDay(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all">
                  {dayKeys.map((day, i) => <option key={day} value={i}>{t(`persons.daysFull.${day}`)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.startTime')}</label>
                  <input type="time" value={newScheduleStart} onChange={(e) => setNewScheduleStart(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.endTime')}</label>
                  <input type="time" value={newScheduleEnd} onChange={(e) => setNewScheduleEnd(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.subject')}</label>
                <input type="text" value={newScheduleSubject} onChange={(e) => setNewScheduleSubject(e.target.value)} placeholder={t('persons.modal.subjectPlaceholder')}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('persons.modal.room')}</label>
                <input type="text" value={newScheduleRoom} onChange={(e) => setNewScheduleRoom(e.target.value)} placeholder={t('persons.modal.roomPlaceholder')}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all" />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowScheduleModal(false)} className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl transition-colors">
                {t('persons.modal.cancel')}
              </button>
              <button onClick={handleAddSchedule} disabled={!newScheduleGroupId || !newScheduleSubject.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {t('persons.modal.addLessonBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Face Modal */}
      {showFaceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-amber-500 to-orange-600">
              <h2 className="text-xl font-bold text-white">{t('persons.modal.uploadFace')}</h2>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-sm text-amber-800">
                  <strong>{t('persons.modal.uploadImportant')}</strong> {t('persons.modal.uploadHint')}
                </p>
              </div>

              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer hover:border-amber-500 hover:bg-amber-50/50 transition-all group">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 group-hover:bg-amber-100 flex items-center justify-center mx-auto mb-4 transition-colors">
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-amber-600 transition-colors" />
                </div>
                <p className="text-slate-700 font-semibold">{t('persons.modal.clickToSelect')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('persons.modal.fileTypes')}</p>
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />

              {faceImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {faceImages.map((file, i) => (
                    <div key={i} className="relative group/img">
                      <img src={URL.createObjectURL(file)} alt={`Face ${i + 1}`} className="w-16 h-16 object-cover rounded-xl border-2 border-slate-200" />
                      <button onClick={() => setFaceImages(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs shadow-lg opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {faceImages.length > 0 && (
                <p className="text-sm text-slate-500">{t('persons.modal.selected')}: {faceImages.length} {t('persons.modal.photos')}</p>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => { setShowFaceModal(null); setFaceImages([]) }} className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl transition-colors">
                {t('persons.modal.cancel')}
              </button>
              <button onClick={() => handleUploadFaceImages(showFaceModal)} disabled={uploading || faceImages.length === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/30 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {uploading ? t('persons.modal.uploading') : t('persons.modal.upload')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-cyan-500 to-blue-600">
              <h2 className="text-xl font-bold text-white">{t('persons.importStudents')}</h2>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <p className="text-sm text-blue-800">{t('persons.importHint')}</p>
              </div>

              <div onClick={() => importFileRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all group">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center mx-auto mb-4 transition-colors">
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
                <p className="text-slate-700 font-semibold">{t('persons.selectCSV')}</p>
                <p className="text-xs text-slate-500 mt-1">CSV, Excel</p>
              </div>

              <input ref={importFileRef} type="file" accept=".csv,.xlsx" onChange={handleImportCSV} className="hidden" />
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowImportModal(false)} className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl transition-colors">
                {t('persons.modal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Detail Modal */}
      {showLessonDetailModal && (() => {
        const lessonGroup = groups.find(g => g.id === showLessonDetailModal.groupId)
        const studentsInGroup = lessonGroup ? persons.filter(p => lessonGroup.studentIds.includes(p.id)) : []
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
              {/* Header */}
              <div className={`p-6 bg-gradient-to-br ${lessonGroup?.color || 'from-slate-500 to-slate-600'} relative overflow-hidden`}>
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzLTItMi00LTJjLTIgMC00IDItNCAyczIgNCA0IDRjMiAwIDQtMiA0LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <BookOpen className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">{showLessonDetailModal.subject}</h2>
                        <p className="text-white/80 text-sm mt-0.5">{lessonGroup?.name} • {lessonGroup?.description}</p>
                      </div>
                    </div>
                    <button onClick={() => setShowLessonDetailModal(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                {/* Time & Room Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">{t('persons.modal.startTime')} - {t('persons.modal.endTime')}</p>
                        <p className="text-lg font-bold text-slate-800">{showLessonDetailModal.startTime} - {showLessonDetailModal.endTime}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">{t('persons.modal.room')}</p>
                        <p className="text-lg font-bold text-slate-800">#{showLessonDetailModal.room}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Day Info */}
                <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl p-4 border border-violet-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-xs text-violet-600 uppercase tracking-wider">{t('persons.modal.day')}</p>
                      <p className="text-lg font-bold text-violet-800">{t(`persons.daysFull.${dayKeys[showLessonDetailModal.dayOfWeek]}`)}</p>
                    </div>
                  </div>
                </div>

                {/* Students in Group */}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-500" />
                    {t('persons.students')} ({studentsInGroup.length})
                  </h3>
                  {studentsInGroup.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {studentsInGroup.map((student) => {
                        const stats = mockStudentStats[student.id]
                        return (
                          <div key={student.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center overflow-hidden">
                                {student.photo_url ? (
                                  <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-sm font-bold text-white">{student.name[0]}</span>
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">{student.name}</p>
                                <p className="text-xs text-slate-500">{student.has_face_encoding ? '✓ ' + t('persons.stats.faceRegistered') : '⚠ ' + t('persons.stats.needPhoto')}</p>
                              </div>
                            </div>
                            {stats && (
                              <span className={`px-2.5 py-1 text-sm font-bold rounded-lg ${stats.attendanceRate >= 90 ? 'bg-emerald-100 text-emerald-700' : stats.attendanceRate >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                {stats.attendanceRate}%
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-slate-50 rounded-2xl">
                      <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500">{t('persons.noStudentsInGroup')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                <button onClick={() => { setShowLessonDetailModal(null); setSelectedGroup(showLessonDetailModal.groupId); setActiveTab('students') }}
                  className="px-5 py-2.5 text-blue-600 font-semibold hover:bg-blue-50 rounded-xl transition-colors flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  {t('persons.viewStudents')}
                </button>
                <button onClick={() => setShowLessonDetailModal(null)} className="px-5 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all">
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
