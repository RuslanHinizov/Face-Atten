import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Video,
  Plus
} from 'lucide-react'
import { CameraGrid } from '../components/CameraGrid'
import { useAttendanceStore, type CameraConfig } from '../store/attendanceStore'
import { CameraControlPanel } from '../components/CameraControlPanel'
import { AddCameraModal } from '../components/AddCameraModal'
import { useState } from 'react'
import type { Camera, CameraStatus } from '../components/CameraTile'

/**
 * Maps store camera config to CameraTile compatible Camera type
 */
function mapCameraConfigToCamera(config: CameraConfig): Camera {
  const status: CameraStatus = config.status === 'error' ? 'disconnected' : config.status
  return {
    id: config.id,
    name: config.name,
    location: config.location || undefined,
    status,
    streamUrl: config.streamUrl
  }
}

/**
 * CameraGridPage - Dedicated page for viewing all cameras in a grid layout
 * 
 * Features:
 * - Header with navigation back to dashboard
 * - Language switcher
 * - Camera status summary
 * - Full CameraGrid component integration
 * 
 * Requirements: 1.1 - Grid view page for monitoring multiple classrooms
 */
export function CameraGridPage() {
  const { t, i18n } = useTranslation()
  const { cameras: storeCameras, addCamera, updateCamera, removeCamera } = useAttendanceStore()

  // Convert store camera record to array
  const cameras: Camera[] = useMemo(() => {
    return Object.values(storeCameras).map(mapCameraConfigToCamera)
  }, [storeCameras])

  // State for controls
  const location = useLocation()
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(() => {
    // Check for initial selection from navigation
    const state = location.state as { selectedCameraId?: string }
    if (state?.selectedCameraId) {
      const cam = cameras.find(c => c.id === state.selectedCameraId)
      return cam || null
    }
    return null
  })
  const [filter, setFilter] = useState<'all' | 'offline' | 'motion'>('all')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingCamera, setEditingCamera] = useState<CameraConfig | null>(null)

  // Calculate camera status counts
  const statusCounts = useMemo(() => {
    const counts = { connected: 0, disconnected: 0, connecting: 0 }
    cameras.forEach(cam => {
      if (cam.status in counts) {
        counts[cam.status as keyof typeof counts]++
      }
    })
    return counts
  }, [cameras])



  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
  }

  // Filter cameras based on active filter
  const filteredCameras = useMemo(() => {
    if (filter === 'all') return cameras
    if (filter === 'offline') return cameras.filter(c => c.status === 'disconnected')
    // For demo, treat all connected cameras as having motion if selected
    if (filter === 'motion') return cameras.filter(c => c.status === 'connected')
    return cameras
  }, [cameras, filter])

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header - Compact & Dark */}
      <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800">
        <div className="max-w-[1920px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Branding & Back */}
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="group flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-400 transition-all"
                title={t('cameraGrid.backToDashboard')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>

              <div className="h-8 w-px bg-slate-800 hidden sm:block" />

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Video className="w-4 h-4 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-base font-bold text-white tracking-tight leading-none">
                    {t('cameraGrid.title')}
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    {cameras.length} active units
                  </p>
                </div>
              </div>

              {/* Add Camera Button */}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="ml-4 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span className="text-xs font-bold">Add Camera</span>
              </button>
            </div>

            {/* Right: Quick Stats & Lang */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  <span className="text-xs font-medium text-slate-300">{statusCounts.connected} Online</span>
                </div>
                <div className="w-px h-4 bg-slate-700" />
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-xs font-medium text-slate-300">{statusCounts.disconnected} Offline</span>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700/50">
                {['tr', 'kk', 'ru', 'en'].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => changeLanguage(lang)}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${i18n.language === lang
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
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

      {/* Main Layout: Grid + Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Camera Grid Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-gradient-to-br from-slate-950 to-black relative">
          <CameraGrid
            cameras={filteredCameras}
            onCameraClick={setSelectedCamera}
            onCameraEdit={(camera) => {
              // Convert Camera back to CameraConfig for editing
              const cameraConfig = storeCameras[camera.id]
              if (cameraConfig) {
                setEditingCamera(cameraConfig)
                setIsAddModalOpen(true)
              }
            }}
            selectedCameraId={selectedCamera?.id}
          />
        </main>

        {/* Sidebar Control Panel (Right) */}
        <aside className="hidden xl:block w-80 bg-slate-950 border-l border-slate-800 p-4 overflow-y-auto">
          <div className="h-full pr-1"> {/* Added small padding-right to show rounding */}
            <CameraControlPanel
              selectedCamera={selectedCamera}
              activeFilter={filter}
              onFilterChange={setFilter}
              onEditClick={(camera) => {
                const cameraConfig = storeCameras[camera.id]
                if (cameraConfig) {
                  setEditingCamera(cameraConfig)
                  setIsAddModalOpen(true)
                }
              }}
            />
          </div>
        </aside>
      </div>

      <AddCameraModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false)
          setEditingCamera(null)
        }}
        onAdd={(data) => {
          addCamera({
            id: `camera-${Date.now()}`,
            status: 'connecting',
            ...data
          })
        }}
        onEdit={(id, updates) => {
          updateCamera(id, updates)
          // If the edited camera was the selected one, update the selection state too
          if (selectedCamera?.id === id) {
            const updatedConfig = { ...storeCameras[id], ...updates }
            setSelectedCamera(mapCameraConfigToCamera(updatedConfig as CameraConfig))
          }
        }}
        onDelete={(id) => {
          removeCamera(id)
          if (selectedCamera?.id === id) {
            setSelectedCamera(null)
          }
        }}
        initialData={editingCamera}
      />
    </div>
  )
}
