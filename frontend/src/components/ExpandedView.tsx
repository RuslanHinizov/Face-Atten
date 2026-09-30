import { useEffect, useCallback, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Wifi, WifiOff, RefreshCw, MapPin } from 'lucide-react'
import { type Camera as CameraType } from './CameraTile'
import { FaceRecognitionOverlay } from './FaceRecognitionOverlay'
import type { IdentifiedFace } from '../store/attendanceStore'

// WebSocket URL for face metadata only
const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`

export interface ExpandedViewProps {
  camera: CameraType
  cameras: CameraType[]
  currentIndex: number
  onClose: () => void
  onNavigate: (direction: 'prev' | 'next') => void
}

/**
 * ExpandedView - TRUE FULLSCREEN camera view with MJPEG stream + WebSocket faces
 */
export function ExpandedView({
  camera,
  cameras,
  currentIndex,
  onClose,
  onNavigate
}: ExpandedViewProps) {
  const totalCameras = cameras.length
  const hasPrev = totalCameras > 1
  const hasNext = totalCameras > 1

  // State
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [streamLoaded, setStreamLoaded] = useState(false)
  const [streamKey, setStreamKey] = useState(0)
  // UI state — throttled
  const [infFps, setInfFps] = useState(0)
  const [capFps, setCapFps] = useState(0)
  const [faceCount, setFaceCount] = useState(0)
  const [resolution, setResolution] = useState({ width: 0, height: 0 })
  // Refs — instant update, no re-render
  const facesRef = useRef<IdentifiedFace[]>([])
  const resolutionRef = useRef({ width: 0, height: 0 })
  const lastUiUpdateRef = useRef(0)

  // MJPEG stream URL
  const streamUrl = `/api/stream/${camera.id}`

  // Handle MJPEG stream events
  const handleStreamLoad = () => {
    setStreamLoaded(true)
    setWsStatus('connected')
  }

  const handleStreamError = () => {
    setStreamLoaded(false)
    setWsStatus('disconnected')

    // Retry stream connection after 2 seconds
    if (streamRetryRef.current) clearTimeout(streamRetryRef.current)
    streamRetryRef.current = setTimeout(() => {
      console.log(`ExpandedView: Retrying stream for ${camera.id}...`)
      setStreamKey(k => k + 1)
      setWsStatus('connecting')
    }, 2000)
  }

  // WebSocket for face metadata only
  useEffect(() => {
    let mounted = true

    const connectWebSocket = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return

      const ws = new WebSocket(`${WS_BASE}/camera/${camera.id}`)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mounted) {
          ws.close()
          return
        }
        console.log(`ExpandedView: Camera ${camera.id} WS connected`)
      }

      ws.onmessage = (event) => {
        if (!mounted) return
        try {
          const message = JSON.parse(event.data)

          if (message.type === 'faces') {
            // Refs: instant, no re-render
            if (message.faces) facesRef.current = message.faces
            if (message.resolution) {
              resolutionRef.current = message.resolution
            }
            // UI: throttled setState (max 2/sec)
            const now = Date.now()
            if (now - lastUiUpdateRef.current > 500) {
              lastUiUpdateRef.current = now
              if (message.faces) setFaceCount(message.faces.length)
              if (message.fps !== undefined) setInfFps(message.fps)
              if (message.capture_fps !== undefined) setCapFps(message.capture_fps)
              if (message.resolution) setResolution(message.resolution)
            }
          }

          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }))
          }

          if (message.type === 'status' && message.status === 'error') {
            setWsStatus('disconnected')
          }
        } catch (e) {
          console.error('WebSocket message error:', e)
        }
      }

      ws.onclose = () => {
        console.log(`ExpandedView: Camera ${camera.id} WS closed`)
        if (mounted) {
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    setWsStatus('connecting')
    connectWebSocket()

    return () => {
      mounted = false
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
  }, [camera.id])

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onClose()
        break
      case 'ArrowLeft':
        if (hasPrev) onNavigate('prev')
        break
      case 'ArrowRight':
        if (hasNext) onNavigate('next')
        break
    }
  }, [onClose, onNavigate, hasPrev, hasNext])

  // Attach keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  return (
    <div
      data-testid="expanded-view-modal"
      data-camera-id={camera.id}
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label={`Expanded view: ${camera.name}`}
    >
      {/* Full black background */}
      <div className="absolute inset-0 bg-black" />

      {/* Camera Feed - TRUE FULLSCREEN with MJPEG */}
      <div
        data-testid="expanded-view-feed"
        className="absolute inset-0"
      >
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          {/* MJPEG Stream */}
          <div className="relative w-full h-full">
            <img
              key={streamKey}
              src={streamUrl}
              alt={camera.name}
              className={`absolute inset-0 w-full h-full ${streamLoaded ? 'opacity-100' : 'opacity-0'}`}
              style={{ objectFit: 'fill' }}
              onLoad={handleStreamLoad}
              onError={handleStreamError}
            />

            {/* Face Overlay — canvas + rAF, zero re-renders */}
            {streamLoaded && (
              <FaceRecognitionOverlay facesRef={facesRef} resolutionRef={resolutionRef} />
            )}
          </div>

          {/* Loading/Error overlay */}
          {!streamLoaded && (
            wsStatus === 'connecting' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                <div className="w-40 h-40 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <RefreshCw className="w-20 h-20 text-amber-500 animate-spin" />
                </div>
                <span className="text-amber-400 text-2xl font-medium mt-4">Connecting to camera...</span>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                <div className="w-40 h-40 rounded-full bg-slate-800/50 flex items-center justify-center">
                  <WifiOff className="w-20 h-20 text-slate-600" />
                </div>
                <span className="text-slate-500 text-2xl font-medium mt-4">Camera Offline</span>
                <span className="text-slate-600 text-sm">Unable to connect to video stream</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Top Bar - Status & Close */}
      <div className="absolute top-0 left-0 right-0 p-6 z-20 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          {/* Status Badge */}
          <div className="flex items-center gap-3">
            <div
              data-testid="expanded-view-status"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg backdrop-blur-md ${
                streamLoaded ? 'bg-emerald-500/20 border-emerald-500/30' :
                wsStatus === 'connecting' ? 'bg-amber-500/20 border-amber-500/30' :
                'bg-slate-500/20 border-slate-500/30'
              } border`}
            >
              <span className={`w-3 h-3 rounded-full ${
                streamLoaded ? 'bg-emerald-400' :
                wsStatus === 'connecting' ? 'bg-amber-400 animate-pulse' :
                'bg-slate-400'
              }`} />
              {wsStatus === 'connecting' && !streamLoaded ? (
                <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
              ) : streamLoaded ? (
                <Wifi className="w-5 h-5 text-emerald-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-slate-400" />
              )}
              <span className={`text-base font-bold ${
                streamLoaded ? 'text-emerald-400' :
                wsStatus === 'connecting' ? 'text-amber-400' :
                'text-slate-400'
              }`}>
                {streamLoaded ? 'LIVE' : wsStatus === 'connecting' ? 'Connecting' : 'Offline'}
              </span>
            </div>

            {/* CAP FPS */}
            {streamLoaded && capFps > 0 && (
              <div className="px-3 py-2.5 rounded-lg backdrop-blur-md bg-black/50 border border-white/10">
                <span className="text-white/80 font-mono text-sm">CAP {capFps}</span>
              </div>
            )}

            {/* INF FPS */}
            {streamLoaded && infFps > 0 && (
              <div className="px-3 py-2.5 rounded-lg backdrop-blur-md bg-indigo-600/50 border border-indigo-400/30">
                <span className="text-white/80 font-mono text-sm">INF {infFps}</span>
              </div>
            )}

            {/* Resolution */}
            {streamLoaded && resolution.width > 0 && (
              <div className="px-3 py-2.5 rounded-lg backdrop-blur-md bg-black/50 border border-white/10">
                <span className="text-white/80 font-mono text-sm">{resolution.width}x{resolution.height}</span>
              </div>
            )}

            {/* Face count */}
            {streamLoaded && faceCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg backdrop-blur-md bg-blue-500/20 border border-blue-500/30">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                <span className="text-blue-400 font-bold text-sm">{faceCount} detected</span>
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            data-testid="expanded-view-close"
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg backdrop-blur-md bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
            aria-label="Close expanded view"
          >
            <X className="w-5 h-5" />
            <span className="font-medium">ESC</span>
          </button>
        </div>
      </div>

      {/* Bottom Bar - Camera Info */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-24">
        <div className="flex items-end justify-between">
          <div>
            <h2 
              data-testid="expanded-view-name"
              className="text-white font-bold text-3xl"
            >
              {camera.name}
            </h2>
            {camera.location && (
              <div 
                data-testid="expanded-view-location"
                className="flex items-center gap-2 mt-2"
              >
                <MapPin className="w-5 h-5 text-slate-400" />
                <span className="text-slate-400 text-lg">{camera.location}</span>
              </div>
            )}
          </div>
          
          {/* Camera counter */}
          <div 
            data-testid="expanded-view-counter"
            className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white/10 backdrop-blur-md"
          >
            <span className="text-white font-bold text-xl">{currentIndex + 1}</span>
            <span className="text-slate-400 text-xl">/</span>
            <span className="text-slate-400 text-xl">{totalCameras}</span>
          </div>
        </div>
      </div>

      {/* Navigation - Previous */}
      {hasPrev && (
        <button
          data-testid="expanded-view-prev"
          onClick={() => onNavigate('prev')}
          className="absolute left-6 top-1/2 -translate-y-1/2 z-20 w-16 h-16 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all hover:scale-110"
          aria-label="Previous camera"
        >
          <ChevronLeft className="w-8 h-8 text-white" />
        </button>
      )}

      {/* Navigation - Next */}
      {hasNext && (
        <button
          data-testid="expanded-view-next"
          onClick={() => onNavigate('next')}
          className="absolute right-6 top-1/2 -translate-y-1/2 z-20 w-16 h-16 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all hover:scale-110"
          aria-label="Next camera"
        >
          <ChevronRight className="w-8 h-8 text-white" />
        </button>
      )}
    </div>
  )
}
