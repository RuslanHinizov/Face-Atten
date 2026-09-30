import { useState, useRef, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Camera, ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
  Check, X, User, Loader2, CheckCircle2, RotateCcw,
  Home, CircleDot
} from 'lucide-react'

const API_BASE = '/api'

interface EnrollmentStatusData {
  session_id: string
  person_name: string
  current_stage: number
  total_stages: number
  stages_completed: string[]
  status: string
}

interface FrameResult {
  face_detected: boolean
  bbox: number[] | null
  landmarks: number[][] | null
  yaw: number
  pitch: number
  roll: number
  stage: number
  stage_name: string
  stage_label?: string
  captured: boolean
  completed: boolean
  progress: number
  total: number
  message: string
  error?: string
  stable?: number
  stable_required?: number
  debug?: {
    yaw?: number
    pitch?: number
    roll?: number
    face_size?: string
    blur?: number
    stage?: string
    matched?: boolean
    stable?: number
    pool?: string
    face_sizes?: number[][]
    min_required?: number
    blur_score?: number
    blur_threshold?: number
  }
}

const STAGE_INFO: Record<string, { label: string; icon: React.ReactNode; instruction: string }> = {
  straight: {
    label: 'Прямо',
    icon: <CircleDot className="w-6 h-6" />,
    instruction: 'Смотрите прямо в камеру',
  },
  left: {
    label: 'Влево',
    icon: <ArrowLeft className="w-6 h-6" />,
    instruction: 'Поверните голову влево',
  },
  right: {
    label: 'Вправо',
    icon: <ArrowRight className="w-6 h-6" />,
    instruction: 'Поверните голову вправо',
  },
  up: {
    label: 'Вверх',
    icon: <ArrowUp className="w-6 h-6" />,
    instruction: 'Поднимите голову вверх',
  },
  down: {
    label: 'Вниз',
    icon: <ArrowDown className="w-6 h-6" />,
    instruction: 'Опустите голову вниз',
  },
}

const STAGES_ORDER = ['straight', 'left', 'right', 'up', 'down']

type Phase = 'form' | 'capture' | 'summary'

export function Enrollment() {
  // Form state
  const [name, setName] = useState('')
  const [role, setRole] = useState<'student' | 'teacher'>('student')

  // Session state
  const [phase, setPhase] = useState<Phase>('form')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Capture state
  const [currentStage, setCurrentStage] = useState(0)
  const [stageName, setStageName] = useState('straight')
  const [message, setMessage] = useState('')
  const [faceDetected, setFaceDetected] = useState(false)
  const [bbox, setBbox] = useState<number[] | null>(null)
  const [capturedStages, setCapturedStages] = useState<string[]>([])
  const [flashGreen, setFlashGreen] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [stableProgress, setStableProgress] = useState(0) // 0..1 approach to capture
  const [debugInfo, setDebugInfo] = useState<FrameResult['debug']>(undefined)

  // Summary state
  const [finalizing, setFinalizing] = useState(false)
  const [enrollResult, setEnrollResult] = useState<{
    success: boolean
    person_id?: string
    name?: string
    embeddings_count?: number
    message: string
  } | null>(null)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sendIntervalRef = useRef<number | null>(null)

  // Start webcam
  const startWebcam = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Камера недоступна. Браузер блокирует доступ — откройте через HTTPS или localhost.')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err: any) {
      console.error('Camera error:', err)
      setError(`Камера: ${err.message || err.name || 'Доступ запрещён'}`)
    }
  }, [])

  // Stop webcam
  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // Send frame to WebSocket
  const sendFrame = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Mirror the frame so backend sees what the user sees
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (blob && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          blob.arrayBuffer().then((buf) => {
            wsRef.current?.send(buf)
          })
        }
      },
      'image/jpeg',
      0.8
    )
  }, [])

  // Connect WebSocket
  const connectWebSocket = useCallback(
    (sid: string) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/enrollment/${sid}`)

      ws.onopen = () => {
        // Start sending frames at ~5 fps
        sendIntervalRef.current = window.setInterval(sendFrame, 200)
      }

      ws.onmessage = (evt) => {
        try {
          const data: FrameResult = JSON.parse(evt.data)

          if (data.error) {
            setError(data.error)
            return
          }

          // Skip the initial "connected" message
          if ((data as any).type === 'connected') return

          setFaceDetected(data.face_detected)
          setBbox(data.bbox)
          setMessage(data.message)
          setCurrentStage(data.stage)
          setStageName(data.stage_name)

          // Stable progress for oval glow (0..1)
          if (data.stable_required && data.stable_required > 0) {
            setStableProgress((data.stable || 0) / data.stable_required)
          } else {
            setStableProgress(0)
          }

          // Debug info
          if (data.debug) {
            setDebugInfo(data.debug)
          }

          if (data.captured) {
            setCapturedStages((prev) => {
              // The stage that was just captured is the one BEFORE current
              const capturedName = STAGES_ORDER[data.progress - 1]
              if (capturedName && !prev.includes(capturedName)) {
                return [...prev, capturedName]
              }
              return prev
            })
            // Green flash
            setFlashGreen(true)
            setTimeout(() => setFlashGreen(false), 500)
          }

          if (data.completed) {
            setCompleted(true)
            // Mark WS as completed so onerror/onclose don't show error
            if (wsRef.current) (wsRef.current as any)._completed = true
            // Stop sending frames
            if (sendIntervalRef.current) {
              clearInterval(sendIntervalRef.current)
              sendIntervalRef.current = null
            }
            // Move to summary after a short delay
            setTimeout(() => {
              setPhase('summary')
            }, 1500)
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onerror = () => {
        // Don't show error if enrollment already completed
        if (!(wsRef.current as any)?._completed) {
          setError('Ошибка WebSocket соединения')
        }
      }

      ws.onclose = () => {
        if (sendIntervalRef.current) {
          clearInterval(sendIntervalRef.current)
          sendIntervalRef.current = null
        }
      }

      wsRef.current = ws
    },
    [sendFrame]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sendIntervalRef.current) clearInterval(sendIntervalRef.current)
      wsRef.current?.close()
      stopWebcam()
    }
  }, [stopWebcam])

  // Start enrollment session
  const handleStart = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/enrollment/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), role }),
      })

      if (!res.ok) throw new Error('Failed to start enrollment')

      const data: EnrollmentStatusData = await res.json()
      setSessionId(data.session_id)
      setPhase('capture')

      // Start webcam then connect WS
      await startWebcam()
      connectWebSocket(data.session_id)
    } catch (err: any) {
      setError(err.message || 'Ошибка запуска регистрации')
    } finally {
      setLoading(false)
    }
  }

  // Cancel enrollment
  const handleCancel = async () => {
    if (sendIntervalRef.current) clearInterval(sendIntervalRef.current)
    wsRef.current?.close()
    stopWebcam()

    if (sessionId) {
      try {
        await fetch(`${API_BASE}/enrollment/${sessionId}`, { method: 'DELETE' })
      } catch {
        // ignore
      }
    }

    // Reset state
    setPhase('form')
    setSessionId(null)
    setCurrentStage(0)
    setStageName('straight')
    setCapturedStages([])
    setCompleted(false)
    setMessage('')
    setFaceDetected(false)
    setBbox(null)
    setError(null)
    setEnrollResult(null)
  }

  // Complete enrollment
  const handleComplete = async () => {
    if (!sessionId) return
    setFinalizing(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/enrollment/${sessionId}/complete`, {
        method: 'POST',
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(err.detail || 'Failed to complete enrollment')
      }

      const data = await res.json()
      setEnrollResult(data)
      stopWebcam()
    } catch (err: any) {
      setError(err.message || 'Ошибка завершения регистрации')
    } finally {
      setFinalizing(false)
    }
  }

  // Draw face overlay on video
  const drawOverlay = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) return
    const video = videoRef.current

    // We use an overlay canvas for drawing
    const overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement
    if (!overlayCanvas) return

    const vw = video.videoWidth || 640
    const vh = video.videoHeight || 480
    overlayCanvas.width = vw
    overlayCanvas.height = vh

    const ctx = overlayCanvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, vw, vh)

    // Draw face guide oval with dynamic glow based on stability progress
    const sp = stableProgress
    if (sp > 0) {
      // Glow effect — stronger as stability grows
      const glowAlpha = 0.15 + sp * 0.35
      ctx.strokeStyle = `rgba(34, 197, 94, ${glowAlpha})`
      ctx.lineWidth = 8 + sp * 12
      ctx.beginPath()
      ctx.ellipse(vw / 2, vh / 2 - 10, 60, 80, 0, 0, 2 * Math.PI)
      ctx.stroke()
    }

    // Main oval border
    if (sp >= 1) {
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 3
      ctx.setLineDash([])
    } else if (sp > 0) {
      // Transition: white → green as stability grows
      const g = Math.round(150 + sp * 105)
      ctx.strokeStyle = `rgb(${Math.round(255 - sp * 220)}, ${g}, ${Math.round(94 + (1 - sp) * 80)})`
      ctx.lineWidth = 2.5
      ctx.setLineDash([])
    } else if (faceDetected) {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 4])
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 4])
    }
    ctx.beginPath()
    ctx.ellipse(vw / 2, vh / 2 - 10, 60, 80, 0, 0, 2 * Math.PI)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw bbox if face detected
    if (bbox && faceDetected) {
      const [x1, y1, x2, y2] = bbox
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 2
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
    }

    // Draw direction arrow
    if (stageName && stageName !== 'done' && stageName !== 'straight') {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.8)'
      ctx.font = 'bold 48px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const arrows: Record<string, string> = {
        left: '\u2190',
        right: '\u2192',
        up: '\u2191',
        down: '\u2193',
      }
      const arrow = arrows[stageName]
      if (arrow) {
        ctx.fillText(arrow, vw / 2, vh - 60)
      }
    }

    requestAnimationFrame(drawOverlay)
  }, [faceDetected, bbox, stageName, stableProgress])

  // Start overlay drawing when in capture phase
  useEffect(() => {
    if (phase === 'capture') {
      requestAnimationFrame(drawOverlay)
    }
  }, [phase, drawOverlay])

  // ============ RENDER ============

  // Form phase
  if (phase === 'form') {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-xl border border-[var(--color-border)] p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Camera className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[var(--color-text)]">
                  Регистрация лица
                </h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Запись с веб-камеры для распознавания
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                  ФИО
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Иванов Иван Иванович"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                  Роль
                </label>
                <div className="flex gap-2">
                  {(['student', 'teacher'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                        role === r
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-[var(--color-bg)] text-[var(--color-text)] border-[var(--color-border)] hover:border-blue-300'
                      }`}
                    >
                      {r === 'student' ? 'Студент' : 'Преподаватель'}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleStart}
                disabled={!name.trim() || loading}
                className="w-full px-4 py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Запуск...
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    Начать регистрацию
                  </>
                )}
              </button>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">
                Как это работает:
              </h3>
              <ol className="text-xs text-[var(--color-text-muted)] space-y-1 list-decimal list-inside">
                <li>Камера включится автоматически</li>
                <li>Следуйте инструкциям на экране</li>
                <li>Поворачивайте голову в указанном направлении</li>
                <li>Система автоматически захватит 5 ракурсов</li>
                <li>Подтвердите и сохраните</li>
              </ol>
            </div>

            <div className="mt-4 text-center">
              <Link
                to="/persons"
                className="text-sm text-[var(--color-text-muted)] hover:text-blue-500 transition-colors"
              >
                Или загрузите фото вручную
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Capture phase
  if (phase === 'capture') {
    const stageInfo = STAGE_INFO[stageName] || STAGE_INFO.straight

    return (
      <div className="min-h-screen bg-black flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 backdrop-blur-sm z-10">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
            <span className="text-sm">Отмена</span>
          </button>

          <div className="text-center">
            <div className="text-white font-medium text-sm">{name}</div>
            <div className="text-white/50 text-xs">
              {capturedStages.length}/{STAGES_ORDER.length} ракурсов
            </div>
          </div>

          <div className="w-20" />
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 px-4 py-2 bg-gray-900/60">
          {STAGES_ORDER.map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                capturedStages.includes(s)
                  ? 'bg-green-500'
                  : i === currentStage
                  ? 'bg-blue-500 animate-pulse'
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Video area */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
          <div className="relative w-full h-full max-w-4xl overflow-hidden">
          {/* Green flash overlay */}
          {flashGreen && (
            <div className="absolute inset-0 bg-green-500/30 z-20 transition-opacity animate-pulse" />
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80">
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 max-w-sm mx-4 text-center">
                <X className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <p className="text-red-400 font-medium mb-2">Ошибка камеры</p>
                <p className="text-red-300/70 text-sm mb-4">{error}</p>
                <button
                  onClick={handleCancel}
                  className="px-6 py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
                >
                  Назад
                </button>
              </div>
            </div>
          )}

          {/* Mirrored video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Overlay canvas for drawing guides */}
          <canvas
            id="overlay-canvas"
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Hidden canvas for frame capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Stage instruction overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  completed
                    ? 'bg-green-500'
                    : faceDetected
                    ? 'bg-blue-500'
                    : 'bg-white/20'
                } transition-colors`}
              >
                {completed ? (
                  <CheckCircle2 className="w-6 h-6 text-white" />
                ) : (
                  <div className="text-white">{stageInfo.icon}</div>
                )}
              </div>
            </div>

            <p className="text-white text-center text-lg font-medium mb-1">
              {completed ? 'Все ракурсы собраны!' : stageInfo.instruction}
            </p>
            <p className="text-white/60 text-center text-sm">{message}</p>

            {!completed && (
              <p className="text-white/40 text-center text-xs mt-2">
                Поворачивайте голову медленно
              </p>
            )}
          </div>

          {/* Debug panel */}
          {debugInfo && (
            <div className="absolute top-14 right-2 bg-black/70 text-white/80 text-[10px] font-mono p-2 rounded-lg leading-relaxed z-10">
              <div>yaw: <span className={Math.abs(debugInfo.yaw || 0) > 15 ? 'text-yellow-400' : 'text-green-400'}>{debugInfo.yaw?.toFixed(1)}</span></div>
              <div>pitch: <span className={Math.abs(debugInfo.pitch || 0) > 10 ? 'text-yellow-400' : 'text-green-400'}>{debugInfo.pitch?.toFixed(1)}</span></div>
              <div>face: {debugInfo.face_size}</div>
              <div>blur: {debugInfo.blur?.toFixed(0)}</div>
              <div>match: <span className={debugInfo.matched ? 'text-green-400' : 'text-red-400'}>{debugInfo.matched ? 'YES' : 'no'}</span></div>
              <div>pool: {debugInfo.pool || `${debugInfo.stable || 0}/12`}</div>
            </div>
          )}

          {/* Stage pills at top */}
          <div className="absolute top-4 left-0 right-0 flex justify-center gap-2 px-4">
            {STAGES_ORDER.map((s, i) => {
              const info = STAGE_INFO[s]
              const isDone = capturedStages.includes(s)
              const isCurrent = i === currentStage && !completed

              return (
                <div
                  key={s}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isDone
                      ? 'bg-green-500/80 text-white'
                      : isCurrent
                      ? 'bg-blue-500/80 text-white ring-2 ring-blue-400'
                      : 'bg-white/10 text-white/40'
                  }`}
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <span className="w-3.5 h-3.5 flex items-center justify-center">
                      {i + 1}
                    </span>
                  )}
                  {info.label}
                </div>
              )
            })}
          </div>
          </div>
        </div>
      </div>
    )
  }

  // Summary phase
  if (phase === 'summary') {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-xl border border-[var(--color-border)] p-8">
            {enrollResult ? (
              // Final result
              <>
                <div className="flex flex-col items-center mb-6">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                      enrollResult.success ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}
                  >
                    {enrollResult.success ? (
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    ) : (
                      <X className="w-8 h-8 text-red-500" />
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-[var(--color-text)]">
                    {enrollResult.success ? 'Регистрация завершена!' : 'Ошибка'}
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    {enrollResult.message}
                  </p>
                </div>

                {enrollResult.success && (
                  <div className="bg-[var(--color-bg)] rounded-xl p-4 mb-6 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-muted)]">Имя</span>
                      <span className="text-[var(--color-text)] font-medium">
                        {enrollResult.name}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-muted)]">Эмбеддингов</span>
                      <span className="text-[var(--color-text)] font-medium">
                        {enrollResult.embeddings_count}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-muted)]">ID</span>
                      <span className="text-[var(--color-text)] font-mono text-xs">
                        {enrollResult.person_id}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Link
                    to="/persons"
                    className="flex-1 px-4 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] font-medium text-center hover:bg-[var(--color-surface)] transition-all flex items-center justify-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    К списку
                  </Link>
                  <button
                    onClick={handleCancel}
                    className="flex-1 px-4 py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Ещё одного
                  </button>
                </div>

                <div className="mt-4 text-center">
                  <Link
                    to="/"
                    className="text-sm text-[var(--color-text-muted)] hover:text-blue-500 transition-colors inline-flex items-center gap-1"
                  >
                    <Home className="w-3.5 h-3.5" />
                    На главную
                  </Link>
                </div>
              </>
            ) : (
              // Pre-confirm
              <>
                <div className="flex flex-col items-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <h2 className="text-xl font-bold text-[var(--color-text)]">
                    Все ракурсы собраны!
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    {name} &mdash; {capturedStages.length} фото
                  </p>
                </div>

                {/* Stage checkmarks */}
                <div className="bg-[var(--color-bg)] rounded-xl p-4 mb-6">
                  <div className="grid grid-cols-5 gap-2">
                    {STAGES_ORDER.map((s) => {
                      const info = STAGE_INFO[s]
                      const isDone = capturedStages.includes(s)
                      return (
                        <div key={s} className="flex flex-col items-center gap-1.5">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isDone ? 'bg-green-500/10' : 'bg-gray-500/10'
                            }`}
                          >
                            {isDone ? (
                              <Check className="w-5 h-5 text-green-500" />
                            ) : (
                              <X className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            {info.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {error && (
                  <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm mb-4">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleCancel}
                    className="flex-1 px-4 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] font-medium hover:bg-[var(--color-surface)] transition-all"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={finalizing}
                    className="flex-1 px-4 py-3 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {finalizing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Сохранение...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Подтвердить
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
