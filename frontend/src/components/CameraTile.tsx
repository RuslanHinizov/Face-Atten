import { useState, useRef, useEffect } from 'react'
import { RefreshCw, MapPin, Camera, Maximize2, Settings } from 'lucide-react'
import { FaceRecognitionOverlay } from './FaceRecognitionOverlay'
import type { IdentifiedFace } from '../store/attendanceStore'

// WebSocket URL for face metadata
const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`

export type CameraStatus = 'connected' | 'disconnected' | 'connecting'

export interface Camera {
  id: string
  name: string
  location?: string
  status: CameraStatus
  streamUrl?: string
}

export interface CameraTileProps {
  camera: Camera
  onClick?: () => void
  onMaximize?: () => void
  onEdit?: () => void
  isCompact?: boolean
  isSelected?: boolean
}


// Status configuration for testing - returns visual properties for each status
export function getStatusConfig(status: CameraStatus): {
  bgColor: string
  textColor: string
  animate: boolean
  label: string
} {
  const config: Record<CameraStatus, {
    bgColor: string
    textColor: string
    animate: boolean
    label: string
  }> = {
    connected: {
      bgColor: 'bg-emerald-500',
      textColor: 'text-emerald-500',
      animate: false,
      label: 'Connected'
    },
    disconnected: {
      bgColor: 'bg-gray-400',
      textColor: 'text-gray-400',
      animate: false,
      label: 'Disconnected'
    },
    connecting: {
      bgColor: 'bg-amber-500',
      textColor: 'text-amber-500',
      animate: true,
      label: 'Connecting'
    }
  }
  return config[status]
}

export function CameraTile({ camera, onClick, onMaximize, onEdit, isSelected }: CameraTileProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [streamLoaded, setStreamLoaded] = useState(false)
  const [streamKey, setStreamKey] = useState(0)
  // UI state — throttled (max 2 updates/sec to prevent re-render lag)
  const [infFps, setInfFps] = useState(0)
  const [capFps, setCapFps] = useState(0)
  const [faceCount, setFaceCount] = useState(0)
  // Refs — updated instantly on every WS message, zero re-renders
  const facesRef = useRef<IdentifiedFace[]>([])
  const resolutionRef = useRef({ width: 0, height: 0 })
  const lastUiUpdateRef = useRef(0)
  const streamRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const wsReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // MJPEG stream URL
  const streamUrl = `/api/stream/${camera.id}`

  const handleStreamLoad = () => {
    setStreamLoaded(true)
  }

  const handleStreamError = () => {
    setStreamLoaded(false)
    // Retry after 3 seconds
    if (streamRetryRef.current) clearTimeout(streamRetryRef.current)
    streamRetryRef.current = setTimeout(() => {
      setStreamKey(k => k + 1)
    }, 3000)
  }

  // WebSocket for face metadata
  useEffect(() => {
    const connectWebSocket = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return

      const ws = new WebSocket(`${WS_BASE}/camera/${camera.id}`)
      wsRef.current = ws

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'faces') {
            // Refs: instant update, no re-render
            if (message.faces) facesRef.current = message.faces
            if (message.resolution) resolutionRef.current = message.resolution

            // UI: throttled setState (max 2 updates/sec)
            const now = Date.now()
            if (now - lastUiUpdateRef.current > 500) {
              lastUiUpdateRef.current = now
              if (message.faces) setFaceCount(message.faces.length)
              if (message.fps !== undefined) setInfFps(message.fps)
              if (message.capture_fps !== undefined) setCapFps(message.capture_fps)
            }
          }
          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }))
          }
        } catch (e) {
          console.error('WS message error:', e)
        }
      }

      ws.onclose = () => {
        wsReconnectRef.current = setTimeout(connectWebSocket, 3000)
      }

      ws.onerror = () => ws.close()
    }

    connectWebSocket()

    return () => {
      if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [camera.id])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRetryRef.current) clearTimeout(streamRetryRef.current)
    }
  }, [])

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        group relative overflow-hidden
        bg-slate-900
        transition-all duration-200
        aspect-video
        ${isSelected
          ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-black'
          : ''
        }
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* Video Feed - Real MJPEG stream */}
      <div className="absolute inset-0 bg-slate-900">
        {/* MJPEG Stream */}
        <img
          key={streamKey}
          src={streamUrl}
          alt={camera.name}
          className={`absolute inset-0 w-full h-full object-fill ${streamLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleStreamLoad}
          onError={handleStreamError}
        />

        {/* Face Recognition Overlay — canvas + rAF, zero re-renders */}
        {streamLoaded && (
          <FaceRecognitionOverlay facesRef={facesRef} resolutionRef={resolutionRef} />
        )}

        {/* Loading/Error overlay */}
        {!streamLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-slate-600 animate-spin" />
          </div>
        )}
      </div>

      {/* Always visible: Status + FPS */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded backdrop-blur-sm ${
          streamLoaded ? 'bg-emerald-500/80' : 'bg-slate-500/80'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${streamLoaded ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">
            {streamLoaded ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {streamLoaded && capFps > 0 && (
            <div className="px-2 py-1 rounded bg-black/60 backdrop-blur-sm">
              <span className="text-[10px] font-mono text-white">CAP {capFps}</span>
            </div>
          )}
          {streamLoaded && infFps > 0 && (
            <div className="px-2 py-1 rounded bg-indigo-600/70 backdrop-blur-sm">
              <span className="text-[10px] font-mono text-white">INF {infFps}</span>
            </div>
          )}
          {streamLoaded && faceCount > 0 && (
            <div className="px-2 py-1 rounded bg-blue-500/70 backdrop-blur-sm">
              <span className="text-[10px] font-mono text-white">{faceCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hover Overlay - Controls and info */}
      <div className={`absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col justify-center items-center p-3 transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
        {/* Center Controls */}
        <div className="flex items-center justify-center gap-2">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:scale-105"
              title="Settings"
            >
              <Settings className="w-4 h-4 text-white" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMaximize?.()
            }}
            className="w-12 h-12 rounded-lg bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-indigo-500/30"
            title="Fullscreen"
          >
            <Maximize2 className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              // Snapshot
            }}
            className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:scale-105"
            title="Snapshot"
          >
            <Camera className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Camera Info */}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white font-semibold text-sm">{camera.name}</h3>
          {camera.location && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-400">{camera.location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 left-2 w-3 h-3 bg-indigo-500 rounded-full animate-pulse" />
      )}
    </div>
  )
}
