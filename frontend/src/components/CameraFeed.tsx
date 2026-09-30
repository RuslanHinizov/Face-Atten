import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { VideoOff, Wifi, WifiOff, RefreshCw, Maximize2, Settings } from 'lucide-react'
import { FaceRecognitionOverlay } from './FaceRecognitionOverlay'
import { useAttendanceStore, type IdentifiedFace } from '../store/attendanceStore'

interface CameraFeedProps {
  cameraId: string
  title: string
  websocketUrl?: string
  onSettingsClick?: () => void
}

// WebSocket URL for face metadata (uses Vite proxy in dev)
const WS_BASE = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`

export function CameraFeed({ cameraId, title, onSettingsClick }: CameraFeedProps) {
  const { t } = useTranslation()
  const imgRef = useRef<HTMLImageElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  // Refs — canvas reads these directly, zero re-renders
  const facesRef = useRef<IdentifiedFace[]>([])
  const resolutionRef = useRef({ width: 0, height: 0 })
  const lastUiUpdateRef = useRef(0)
  // UI state — throttled max 2x/sec
  const [facesCount, setFacesCount] = useState(0)
  const [infFps, setInfFps] = useState(0)
  const [capFps, setCapFps] = useState(0)
  const [resolution, setResolution] = useState({ width: 0, height: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [streamLoaded, setStreamLoaded] = useState(false)
  const [streamError, setStreamError] = useState(false)
  const [streamKey, setStreamKey] = useState(0)  // Force img remount on reconnect
  const containerRef = useRef<HTMLDivElement>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { cameraStatuses, setCameraStatus, setDetectedFaces } = useAttendanceStore()
  const status = cameraStatuses[cameraId] || 'disconnected'

  // MJPEG stream URL (uses Vite proxy in dev, relative path)
  const streamUrl = `/api/stream/${cameraId}`

  // Handle MJPEG stream load
  const handleStreamLoad = () => {
    setStreamLoaded(true)
    setStreamError(false)
    setCameraStatus(cameraId, 'connected')
  }

  // Handle MJPEG stream error - retry after 2 seconds
  const handleStreamError = () => {
    setStreamError(true)
    setStreamLoaded(false)
    setCameraStatus(cameraId, 'disconnected')

    // Retry stream connection
    if (streamRetryRef.current) clearTimeout(streamRetryRef.current)
    streamRetryRef.current = setTimeout(() => {
      console.log(`Retrying stream for ${cameraId}...`)
      setStreamKey(k => k + 1)  // Force img remount
      setStreamError(false)
      setCameraStatus(cameraId, 'connecting')
    }, 2000)
  }

  // WebSocket for face metadata only
  useEffect(() => {
    const connectWebSocket = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return

      const ws = new WebSocket(`${WS_BASE}/camera/${cameraId}`)
      wsRef.current = ws

      ws.onopen = () => {
        console.log(`Camera ${cameraId} WS connected (faces only)`)
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          if (message.type === 'faces') {
            // Refs update instantly — canvas picks up on next rAF frame
            if (message.faces) {
              facesRef.current = message.faces
              setDetectedFaces(cameraId, message.faces)
            }
            if (message.resolution) {
              resolutionRef.current = message.resolution
            }
            // UI updates throttled — max 2x per second
            const now = Date.now()
            if (now - lastUiUpdateRef.current > 500) {
              lastUiUpdateRef.current = now
              if (message.faces) setFacesCount(message.faces.length)
              if (message.fps !== undefined) setInfFps(message.fps)
              if (message.capture_fps !== undefined) setCapFps(message.capture_fps)
              if (message.resolution) setResolution(message.resolution)
            }
          }

          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }))
          }

          if (message.type === 'status' && message.status === 'error') {
            setCameraStatus(cameraId, 'disconnected')
          }
        } catch (e) {
          console.error('WebSocket message error:', e)
        }
      }

      ws.onclose = () => {
        console.log(`Camera ${cameraId} WS disconnected`)
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    setCameraStatus(cameraId, 'connecting')
    connectWebSocket()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (streamRetryRef.current) {
        clearTimeout(streamRetryRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [cameraId, setCameraStatus, setDetectedFaces])

  const toggleFullscreen = async () => {
    if (!containerRef.current) return
    
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  return (
    <div ref={containerRef} className={`group relative rounded-2xl overflow-hidden bg-white border border-[var(--color-border)] shadow-soft hover:shadow-lg transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}>
      {/* Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="flex items-center justify-between">
          {/* Left: Title & Status */}
          <div className="flex items-center gap-3">
            <div className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md
              ${status === 'connected' 
                ? 'bg-emerald-500/90 text-white' 
                : status === 'connecting'
                ? 'bg-amber-500/90 text-white'
                : 'bg-gray-800/80 text-white'
              }
            `}>
              {status === 'connected' ? (
                <Wifi className="w-3.5 h-3.5" />
              ) : status === 'connecting' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
              <span className="text-xs font-semibold">{title}</span>
            </div>
          </div>

          {/* Right: Stats */}
          <div className="flex items-center gap-2">
            {status === 'connected' && streamLoaded && (
              <>
                {facesCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/90 text-white backdrop-blur-md">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-xs font-semibold">{facesCount} {t('dashboard.detected')}</span>
                  </div>
                )}
                {infFps > 0 && (
                  <div className="px-2.5 py-1 rounded-full bg-black/50 text-white/90 backdrop-blur-md">
                    <span className="text-xs font-mono">INF {infFps}</span>
                  </div>
                )}
                {capFps > 0 && (
                  <div className="px-2.5 py-1 rounded-full bg-black/50 text-white/90 backdrop-blur-md">
                    <span className="text-xs font-mono">CAP {capFps}</span>
                  </div>
                )}
                {resolution.width > 0 && (
                  <div className="px-2.5 py-1 rounded-full bg-black/50 text-white/90 backdrop-blur-md">
                    <span className="text-xs font-mono">{resolution.width}x{resolution.height}</span>
                  </div>
                )}
              </>
            )}
            
            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg bg-black/50 text-white/80 hover:bg-black/70 backdrop-blur-md transition-colors"
                title={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              {onSettingsClick && (
                <button 
                  onClick={onSettingsClick}
                  className="p-1.5 rounded-lg bg-black/50 text-white/80 hover:bg-black/70 backdrop-blur-md transition-colors"
                  title="Настройки камеры"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MJPEG Video Stream */}
      <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-800">
        {/* MJPEG Image - stretches to fill container */}
        <img
          key={streamKey}
          ref={imgRef}
          src={streamUrl}
          alt={title}
          className={`absolute inset-0 w-full h-full ${streamLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ objectFit: 'fill' }}
          onLoad={handleStreamLoad}
          onError={handleStreamError}
        />

        {/* Face Recognition Overlay — canvas reads refs, zero re-renders */}
        <FaceRecognitionOverlay facesRef={facesRef} resolutionRef={resolutionRef} />

        {/* Recording Indicator */}
        {status === 'connected' && streamLoaded && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/90 text-white backdrop-blur-md">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-xs font-semibold">REC</span>
          </div>
        )}

        {/* Connection Status Overlay */}
        {(status !== 'connected' || streamError) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-sm">
            <div className="text-center space-y-6 p-8">
              {status === 'connecting' && !streamError ? (
                <>
                  <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center">
                    <RefreshCw className="w-10 h-10 text-amber-400 animate-spin" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-lg">{t('dashboard.connecting')}</p>
                    <p className="text-gray-400 text-sm mt-1">{t('dashboard.pleaseWait')}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 mx-auto rounded-full bg-gray-700/50 flex items-center justify-center">
                    <VideoOff className="w-10 h-10 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-lg">{t('dashboard.connectionLost')}</p>
                    <p className="text-gray-400 text-sm mt-1">{t('dashboard.checkConnection')}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
