import type { IdentifiedFace, AttendanceNotification } from '../store/attendanceStore'

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'

type MessageHandler = (data: unknown) => void

// WebSocket now only handles metadata (faces), not video frames
interface WebSocketMessage {
  type: 'faces' | 'notification' | 'status' | 'error' | 'ping' | 'pong'
  cameraId?: string
  camera_id?: string
  faces?: IdentifiedFace[]
  status?: string
  message?: string
  timestamp?: string
}

interface FacesData {
  faces: IdentifiedFace[]
}

interface NotificationData {
  notification: AttendanceNotification
}

interface StatusData {
  status: 'connected' | 'disconnected' | 'error'
  message?: string
}

export type { StatusData }

export class WebSocketClient {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = parseInt(import.meta.env.VITE_WS_MAX_RECONNECT_ATTEMPTS || '5')
  private reconnectDelay = parseInt(import.meta.env.VITE_WS_RECONNECT_DELAY || '5000')
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private url: string
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private heartbeatTimeout = 30000

  constructor(endpoint: string) {
    this.url = `${WS_BASE}${endpoint}`
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          this.reconnectAttempts = 0
          this.emit('status', { status: 'connected' })
          this.startHeartbeat()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (e) {
            console.error('WebSocket message parse error:', e)
          }
        }

        this.ws.onerror = (error) => {
          this.emit('status', { status: 'error', message: 'Connection error' })
          this.emit('error', { error })
        }

        this.ws.onclose = (event) => {
          this.stopHeartbeat()
          this.emit('status', { status: 'disconnected', message: event.reason })
          this.attemptReconnect()
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  private handleMessage(message: WebSocketMessage) {
    const cameraId = message.cameraId || message.camera_id

    switch (message.type) {
      case 'faces':
        // Handle face detection metadata
        if (message.faces) {
          this.emit('faces', { faces: message.faces })
          if (cameraId) {
            this.emit(`faces:${cameraId}`, { faces: message.faces })
          }
        }
        break

      case 'status':
        this.emit('camera_status', message)
        if (cameraId) {
          this.emit(`status:${cameraId}`, message)
        }
        break

      case 'ping':
        this.send({ type: 'pong' })
        break

      case 'pong':
        // Heartbeat response received
        break

      default:
        this.emit(message.type, message)
        if (cameraId) {
          this.emit(`${message.type}:${cameraId}`, message)
        }
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' })
      }
    }, this.heartbeatTimeout)
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', { message: 'Max reconnection attempts reached' })
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1) // Exponential backoff
    
    setTimeout(() => {
      this.connect().catch(() => {
        // Reconnection failed, will try again
      })
    }, Math.min(delay, 30000)) // Cap at 30 seconds
  }

  disconnect() {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    this.reconnectAttempts = this.maxReconnectAttempts // Prevent auto-reconnect
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  off(event: string, handler: MessageHandler) {
    this.handlers.get(event)?.delete(handler)
  }

  private emit(event: string, data: unknown) {
    this.handlers.get(event)?.forEach((handler) => handler(data))
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  get connectionState(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.ws) return 'closed'
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting'
      case WebSocket.OPEN: return 'open'
      case WebSocket.CLOSING: return 'closing'
      default: return 'closed'
    }
  }
}


// Camera stream client - now only handles face metadata (video is via MJPEG)
export class CameraStreamClient extends WebSocketClient {
  private faceBuffer: Map<string, IdentifiedFace> = new Map()
  private faceBufferTimeout = 500 // ms to keep faces in buffer

  constructor(cameraId: string) {
    super(`/camera/${cameraId}`)
  }

  onFaces(callback: (faces: IdentifiedFace[]) => void) {
    return this.on('faces', (data) => {
      const facesData = data as FacesData
      if (facesData.faces) {
        // Buffer faces to handle rapid updates
        facesData.faces.forEach(face => {
          this.faceBuffer.set(face.personId, face)
        })
        callback(Array.from(this.faceBuffer.values()))

        // Clear old faces after timeout
        setTimeout(() => {
          facesData.faces.forEach(face => {
            this.faceBuffer.delete(face.personId)
          })
        }, this.faceBufferTimeout)
      }
    })
  }

  onCameraStatus(callback: (status: { status: string; error?: string }) => void) {
    return this.on('camera_status', callback as MessageHandler)
  }
}

// Attendance notification client
export class AttendanceStreamClient extends WebSocketClient {
  constructor() {
    super('/attendance')
  }

  onNotification(callback: (notification: AttendanceNotification) => void) {
    return this.on('notification', (data) => {
      const notifData = data as NotificationData
      if (notifData.notification) {
        callback({
          ...notifData.notification,
          timestamp: new Date(notifData.notification.timestamp),
        })
      }
    })
  }
}

// Singleton instances for global use
const cameraClients: Map<string, CameraStreamClient> = new Map()
let attendanceClient: AttendanceStreamClient | null = null

export function getCameraClient(cameraId: string): CameraStreamClient {
  if (!cameraClients.has(cameraId)) {
    cameraClients.set(cameraId, new CameraStreamClient(cameraId))
  }
  return cameraClients.get(cameraId)!
}

export function getAttendanceClient(): AttendanceStreamClient {
  if (!attendanceClient) {
    attendanceClient = new AttendanceStreamClient()
  }
  return attendanceClient
}

export function disconnectAll() {
  cameraClients.forEach((client) => client.disconnect())
  cameraClients.clear()
  attendanceClient?.disconnect()
  attendanceClient = null
}

// Connection status helper
export function getConnectionStatus(): {
  cameras: Map<string, 'connecting' | 'open' | 'closing' | 'closed'>
  attendance: 'connecting' | 'open' | 'closing' | 'closed'
} {
  const cameras = new Map<string, 'connecting' | 'open' | 'closing' | 'closed'>()
  cameraClients.forEach((client, id) => {
    cameras.set(id, client.connectionState)
  })
  return {
    cameras,
    attendance: attendanceClient?.connectionState || 'closed',
  }
}
