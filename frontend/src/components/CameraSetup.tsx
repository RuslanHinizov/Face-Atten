import { useState, useRef } from 'react'
import { Camera, Wifi, WifiOff, RefreshCw, X, Check, AlertCircle, Info, Upload, Film, Monitor } from 'lucide-react'

interface CameraSetupProps {
  onClose: () => void
}

interface CameraConfig {
  id: string
  name: string
  source: string
  sourceType: 'rtsp' | 'webcam' | 'file'
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  error?: string
  fileName?: string
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Örnek RTSP formatları
const RTSP_EXAMPLES = [
  { brand: 'Hikvision', format: 'rtsp://admin:password@192.168.1.64:554/Streaming/Channels/101' },
  { brand: 'Dahua', format: 'rtsp://admin:password@192.168.1.108:554/cam/realmonitor?channel=1&subtype=0' },
  { brand: 'Axis', format: 'rtsp://root:password@192.168.1.90/axis-media/media.amp' },
  { brand: 'Generic', format: 'rtsp://username:password@IP_ADDRESS:554/stream' },
]

export function CameraSetup({ onClose }: CameraSetupProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingCamera, setUploadingCamera] = useState<string | null>(null)
  const [cameras, setCameras] = useState<CameraConfig[]>([
    { 
      id: 'camera-1', 
      name: 'Аудитория - Камера 1', 
      source: '', 
      sourceType: 'rtsp',
      status: 'disconnected' 
    },
    { 
      id: 'camera-2', 
      name: 'Аудитория - Камера 2 (Тест)', 
      source: '', 
      sourceType: 'file',
      status: 'disconnected' 
    },
  ])
  const [connecting, setConnecting] = useState<string | null>(null)
  const [showExamples, setShowExamples] = useState(false)

  const connectCamera = async (cameraId: string, source: string) => {
    setConnecting(cameraId)
    setCameras(prev => prev.map(c => 
      c.id === cameraId ? { ...c, status: 'connecting' as const, error: undefined } : c
    ))

    try {
      const response = await fetch(
        `${API_BASE}/api/cameras/${cameraId}/connect?source=${encodeURIComponent(source)}`,
        { method: 'POST' }
      )
      const data = await response.json()

      if (data.success) {
        setCameras(prev => prev.map(c => 
          c.id === cameraId ? { ...c, status: 'connected' as const } : c
        ))
      } else {
        setCameras(prev => prev.map(c => 
          c.id === cameraId ? { ...c, status: 'error' as const, error: 'Подключение не удалось. Проверьте URL и учетные данные.' } : c
        ))
      }
    } catch (error) {
      setCameras(prev => prev.map(c => 
        c.id === cameraId ? { ...c, status: 'error' as const, error: 'Ошибка сети. Убедитесь, что сервер запущен.' } : c
      ))
    } finally {
      setConnecting(null)
    }
  }

  const disconnectCamera = async (cameraId: string) => {
    try {
      await fetch(`${API_BASE}/api/cameras/${cameraId}/disconnect`, { method: 'POST' })
      setCameras(prev => prev.map(c => 
        c.id === cameraId ? { ...c, status: 'disconnected' as const } : c
      ))
    } catch (error) {
      console.error('Disconnect error:', error)
    }
  }

  const updateCamera = (cameraId: string, field: 'source' | 'name', value: string) => {
    setCameras(prev => prev.map(c => 
      c.id === cameraId ? { ...c, [field]: value } : c
    ))
  }

  const updateSourceType = (cameraId: string, sourceType: 'rtsp' | 'webcam' | 'file') => {
    setCameras(prev => prev.map(c => 
      c.id === cameraId 
        ? { 
            ...c, 
            sourceType, 
            source: sourceType === 'webcam' ? '0' : '',
            fileName: undefined 
          } 
        : c
    ))
  }

  const handleFileUpload = async (cameraId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setUploadingCamera(null)
      return
    }

    setUploadingCamera(cameraId)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('camera_id', cameraId)

      const response = await fetch(`${API_BASE}/api/cameras/upload-video`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setCameras(prev => prev.map(c => 
          c.id === cameraId 
            ? { ...c, source: data.file_path, fileName: file.name } 
            : c
        ))
      } else {
        setCameras(prev => prev.map(c => 
          c.id === cameraId 
            ? { ...c, error: data.error || 'Ошибка загрузки файла' } 
            : c
        ))
      }
    } catch (error) {
      setCameras(prev => prev.map(c => 
        c.id === cameraId 
          ? { ...c, error: 'Ошибка сети при загрузке файла' } 
          : c
      ))
    } finally {
      setUploadingCamera(null)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const connectAll = async () => {
    for (const camera of cameras) {
      if (camera.status !== 'connected') {
        await connectCamera(camera.id, camera.source)
      }
    }
  }

  const getStatusIcon = (status: CameraConfig['status']) => {
    switch (status) {
      case 'connected':
        return <Check className="w-4 h-4 text-emerald-500" />
      case 'connecting':
        return <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <WifiOff className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: CameraConfig['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700'
      case 'connecting':
        return 'bg-amber-50 border-amber-200 text-amber-700'
      case 'error':
        return 'bg-red-50 border-red-200 text-red-700'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-600'
    }
  }

  const getStatusText = (status: CameraConfig['status']) => {
    switch (status) {
      case 'connected': return 'Подключено'
      case 'connecting': return 'Подключение...'
      case 'error': return 'Ошибка'
      default: return 'Отключено'
    }
  }

  const connectedCount = cameras.filter(c => c.status === 'connected').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Настройка камер</h2>
                <p className="text-sm text-gray-500">
                  {connectedCount}/{cameras.length} камер подключено
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/80 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* RTSP Info */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">RTSP подключение</h3>
                <p className="text-xs text-blue-700 mb-2">
                  Введите RTSP URL камеры университета. Формат зависит от производителя камеры.
                </p>
                <button
                  onClick={() => setShowExamples(!showExamples)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
                >
                  {showExamples ? 'Скрыть примеры' : 'Показать примеры URL'}
                </button>
                
                {showExamples && (
                  <div className="mt-3 space-y-2">
                    {RTSP_EXAMPLES.map((example, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-white/70 border border-blue-100">
                        <p className="text-xs font-semibold text-blue-900">{example.brand}:</p>
                        <code className="text-xs text-blue-700 break-all">{example.format}</code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Camera List */}
          {cameras.map((camera) => (
            <div
              key={camera.id}
              className={`p-4 rounded-xl border-2 transition-all ${
                camera.status === 'connected' 
                  ? 'border-emerald-200 bg-emerald-50/30' 
                  : camera.status === 'error'
                  ? 'border-red-200 bg-red-50/30'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    camera.status === 'connected' 
                      ? 'bg-emerald-500' 
                      : camera.status === 'error'
                      ? 'bg-red-500'
                      : 'bg-gray-400'
                  }`}>
                    {camera.sourceType === 'file' ? (
                      <Film className="w-5 h-5 text-white" />
                    ) : camera.sourceType === 'webcam' ? (
                      <Monitor className="w-5 h-5 text-white" />
                    ) : (
                      <Camera className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={camera.name}
                    onChange={(e) => updateCamera(camera.id, 'name', e.target.value)}
                    className="font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                    placeholder="Название камеры"
                  />
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusColor(camera.status)}`}>
                  {getStatusIcon(camera.status)}
                  <span>{getStatusText(camera.status)}</span>
                </div>
              </div>

              <div className="space-y-3">
                {/* Source Type Selector */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">Тип источника</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateSourceType(camera.id, 'rtsp')}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        camera.sourceType === 'rtsp'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Wifi className="w-3.5 h-3.5" />
                      RTSP
                    </button>
                    <button
                      onClick={() => updateSourceType(camera.id, 'webcam')}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        camera.sourceType === 'webcam'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      Веб-камера
                    </button>
                    <button
                      onClick={() => updateSourceType(camera.id, 'file')}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        camera.sourceType === 'file'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Film className="w-3.5 h-3.5" />
                      Видео файл
                    </button>
                  </div>
                </div>

                {/* Source Input based on type */}
                {camera.sourceType === 'rtsp' && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">RTSP URL</label>
                    <input
                      type="text"
                      value={camera.source}
                      onChange={(e) => updateCamera(camera.id, 'source', e.target.value)}
                      placeholder="rtsp://admin:password@192.168.1.64:554/stream"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 bg-white"
                      disabled={camera.status === 'connecting'}
                    />
                  </div>
                )}

                {camera.sourceType === 'webcam' && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Веб-камера</label>
                    <select
                      value={camera.source}
                      onChange={(e) => updateCamera(camera.id, 'source', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 bg-white"
                      disabled={camera.status === 'connecting'}
                    >
                      <option value="0">Камера 0 (по умолчанию)</option>
                      <option value="1">Камера 1</option>
                      <option value="2">Камера 2</option>
                    </select>
                  </div>
                )}

                {camera.sourceType === 'file' && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Видео файл</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={camera.fileName || camera.source}
                        readOnly
                        placeholder="Выберите видео файл..."
                        className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-600"
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/*,.mp4,.avi,.mkv,.mov"
                        onChange={(e) => handleFileUpload(camera.id, e)}
                        className="hidden"
                      />
                      <button
                        onClick={() => {
                          setUploadingCamera(camera.id)
                          fileInputRef.current?.click()
                        }}
                        disabled={uploadingCamera === camera.id}
                        className="px-4 py-2.5 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 transition-colors flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingCamera === camera.id ? 'Загрузка...' : 'Выбрать'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Поддерживаемые форматы: MP4, AVI, MKV, MOV</p>
                  </div>
                )}

                <div className="flex gap-2">
                  {camera.status === 'connected' ? (
                    <button
                      onClick={() => disconnectCamera(camera.id)}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <WifiOff className="w-4 h-4" />
                      Отключить
                    </button>
                  ) : (
                    <button
                      onClick={() => connectCamera(camera.id, camera.source)}
                      disabled={connecting === camera.id || !camera.source}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {connecting === camera.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wifi className="w-4 h-4" />
                      )}
                      Подключить
                    </button>
                  )}
                </div>

                {camera.error && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-100">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{camera.error}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">
              Убедитесь, что камеры доступны в сети университета
            </p>
            <div className="flex gap-3">
              <button
                onClick={connectAll}
                disabled={connecting !== null}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Wifi className="w-4 h-4" />
                Подключить все
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300 transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
