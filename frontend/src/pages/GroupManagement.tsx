import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BookOpen,
  ArrowLeft,
  Plus,
  Users,
  Globe,
  Sparkles,
  ArrowUpRight,
  Search,
  Trash2,
  Edit3,
  Eye,
  X,
  TrendingUp
} from 'lucide-react'

interface Group {
  id: string
  name: string
  description?: string
  studentIds: string[]
  color?: string
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

export function GroupManagement() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [groups, setGroups] = useState<Group[]>(demoGroups)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')

  const changeLanguage = (lang: string) => { i18n.changeLanguage(lang) }

  const filteredGroups = useMemo(() => {
    return groups.filter(g => 
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.description?.toLowerCase().includes(search.toLowerCase())
    )
  }, [groups, search])

  const totalStudents = groups.reduce((acc, g) => acc + g.studentIds.length, 0)

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return
    const newGroup: Group = {
      id: `g${Date.now()}`,
      name: newGroupName,
      description: newGroupDescription || undefined,
      studentIds: [],
      color: groupColors[groups.length % groupColors.length]
    }
    setGroups(prev => [...prev, newGroup])
    setNewGroupName('')
    setNewGroupDescription('')
    setShowAddModal(false)
  }

  const handleEditGroup = () => {
    if (!editingGroup || !newGroupName.trim()) return
    setGroups(prev => prev.map(g => 
      g.id === editingGroup.id 
        ? { ...g, name: newGroupName, description: newGroupDescription || undefined }
        : g
    ))
    setEditingGroup(null)
    setNewGroupName('')
    setNewGroupDescription('')
  }

  const handleDeleteGroup = (id: string) => {
    if (!confirm(t('groups.confirmDelete'))) return
    setGroups(prev => prev.filter(g => g.id !== id))
  }

  const openEditModal = (group: Group) => {
    setEditingGroup(group)
    setNewGroupName(group.name)
    setNewGroupDescription(group.description || '')
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-400/10 to-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-gradient-to-br from-blue-400/10 to-indigo-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--color-border)]">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="group w-11 h-11 rounded-2xl bg-[var(--color-surface)] hover:bg-gradient-to-br hover:from-purple-500 hover:to-pink-600 border border-[var(--color-border)] hover:border-transparent flex items-center justify-center transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-purple-500/25">
                <ArrowLeft className="w-5 h-5 text-[var(--color-text-secondary)] group-hover:text-white transition-colors" />
              </Link>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-rose-600 flex items-center justify-center shadow-xl shadow-purple-500/30">
                    <BookOpen className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[var(--color-surface)]">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">{t('groups.title')}</h1>
                  <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-2">
                    <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {groups.length} {t('groups.groupsCount')}</span>
                    <span className="text-[var(--color-text-muted)]">•</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {totalStudents} {t('groups.studentsTotal')}</span>
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
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-md shadow-purple-500/30 scale-105'
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
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-500 via-purple-600 to-pink-700 p-6 shadow-xl shadow-purple-500/25 hover:shadow-2xl hover:shadow-purple-500/30 transition-all duration-500">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzLTItMi00LTJjLTIgMC00IDItNCAyczIgNCA0IDRjMiAwIDQtMiA0LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
              </div>
              <p className="text-4xl font-black text-white mb-1">{groups.length}</p>
              <p className="text-sm text-purple-100 font-medium">{t('groups.stats.totalGroups')}</p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-3xl bg-[var(--color-surface)] p-5 shadow-lg hover:shadow-xl border border-[var(--color-border)] transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-3xl font-black text-[var(--color-text)]">{totalStudents}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{t('groups.stats.totalStudents')}</p>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-3xl bg-[var(--color-surface)] p-5 shadow-lg hover:shadow-xl border border-[var(--color-border)] transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-3xl font-black text-[var(--color-text)]">{Math.round(totalStudents / (groups.length || 1))}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{t('groups.stats.avgPerGroup')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)] group-focus-within:text-purple-500 transition-colors" />
            <input type="text" placeholder={t('groups.search')} value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all shadow-sm" />
          </div>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-2xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-[1.02] transition-all">
            <Plus className="w-5 h-5" />
            {t('groups.addGroup')}
          </button>
        </div>

        {/* Groups Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredGroups.map((group) => (
            <div key={group.id} className="group/card relative bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              {/* Header */}
              <div className={`h-24 bg-gradient-to-br ${group.color || 'from-slate-400 to-slate-500'} relative overflow-hidden`}>
                <div className="absolute inset-0 bg-black/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <h3 className="text-3xl font-black text-white tracking-tight">{group.name}</h3>
                </div>
                {/* Actions */}
                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(group)} className="p-2 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-colors">
                    <Edit3 className="w-4 h-4 text-white" />
                  </button>
                  <button onClick={() => handleDeleteGroup(group.id)} className="p-2 bg-red-500/80 backdrop-blur-sm rounded-xl hover:bg-red-500 transition-colors">
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              <div className="p-5">
                {group.description && (
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">{group.description}</p>
                )}

                {/* Students Count */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[var(--color-text-muted)]" />
                    <span className="text-sm text-[var(--color-text-secondary)]">{group.studentIds.length} {t('groups.students')}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${group.studentIds.length > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                    {group.studentIds.length > 0 ? t('groups.active') : t('groups.empty')}
                  </span>
                </div>

                {/* View Button */}
                <button onClick={() => navigate(`/students?group=${group.id}`)}
                  className="w-full py-2.5 text-sm font-semibold text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl transition-colors flex items-center justify-center gap-2">
                  <Eye className="w-4 h-4" />
                  {t('groups.viewStudents')}
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-[var(--color-surface)] rounded-3xl border-2 border-dashed border-[var(--color-border)]">
            <div className="w-20 h-20 rounded-3xl bg-[var(--color-surface-elevated)] flex items-center justify-center mb-4">
              <BookOpen className="w-10 h-10 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-[var(--color-text-secondary)] font-medium mb-2">{t('groups.noGroups')}</p>
            <button onClick={() => setShowAddModal(true)} className="text-purple-500 hover:text-purple-600 font-semibold hover:underline">
              {t('groups.addFirst')}
            </button>
          </div>
        )}
      </main>

      {/* Add/Edit Group Modal */}
      {(showAddModal || editingGroup) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)] rounded-3xl shadow-2xl w-full max-w-md border border-[var(--color-border)] overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-purple-500 to-pink-600">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{editingGroup ? t('groups.editGroup') : t('groups.addGroup')}</h2>
                <button onClick={() => { setShowAddModal(false); setEditingGroup(null); setNewGroupName(''); setNewGroupDescription('') }} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-2">{t('groups.modal.groupName')}</label>
                <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder={t('groups.modal.groupNamePlaceholder')}
                  className="w-full px-4 py-3.5 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text)] mb-2">{t('groups.modal.description')}</label>
                <input type="text" value={newGroupDescription} onChange={(e) => setNewGroupDescription(e.target.value)} placeholder={t('groups.modal.descriptionPlaceholder')}
                  className="w-full px-4 py-3.5 bg-[var(--color-bg)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all" />
              </div>
            </div>
            <div className="p-6 bg-[var(--color-bg)] border-t border-[var(--color-border)] flex justify-end gap-3">
              <button onClick={() => { setShowAddModal(false); setEditingGroup(null); setNewGroupName(''); setNewGroupDescription('') }} className="px-5 py-2.5 text-[var(--color-text-secondary)] font-semibold hover:bg-[var(--color-surface)] rounded-xl transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={editingGroup ? handleEditGroup : handleAddGroup} disabled={!newGroupName.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {editingGroup ? t('common.save') : t('groups.modal.add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
