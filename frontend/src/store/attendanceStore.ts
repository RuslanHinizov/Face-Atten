import { create } from 'zustand'

export interface Person {
  id: string
  name: string
  role: 'student' | 'teacher'
  photoUrl?: string
  group?: string
}

export interface AttendanceEvent {
  id: string
  eventType: 'entry' | 'exit' | 'reentry'
  timestamp: Date
  cameraId: string
}

export interface AttendanceRecord {
  id: string
  sessionId: string
  person: Person
  status: 'present' | 'late' | 'absent'
  firstEntry?: Date
  events: AttendanceEvent[]
  totalTimeMinutes: number
  lateByMinutes: number
}

export interface Session {
  id: string
  name: string
  courseCode?: string
  startTime: Date
  endTime: Date
  teacherId?: string
  studentIds: string[]
  status: 'scheduled' | 'active' | 'completed'
}

export interface AttendanceNotification {
  id: string
  personId: string
  personName: string
  personRole: 'student' | 'teacher' | 'unknown'
  eventType: 'entry' | 'exit' | 'reentry' | 'late' | 'unknown'
  timestamp: Date
  color: 'green' | 'yellow' | 'red' | 'blue' | 'gray'
  lateByMinutes?: number
  cameraId?: string
}

export interface IdentifiedFace {
  id: string
  personId: string
  personName: string
  role: 'student' | 'teacher'
  bbox: [number, number, number, number]  // [x1, y1, x2, y2] in pixels
  confidence: number
  status: 'on_time' | 'late' | 'exit' | 'reentry'
}

export type CameraStatus = 'connected' | 'disconnected' | 'connecting' | 'error'
export type Language = 'ru' | 'kk' | 'en' | 'tr' | 'de' | 'zh'

export interface CameraConfig {
  id: string
  name: string
  location: string
  status: CameraStatus
  streamUrl?: string
  rtspUrl?: string
}

interface AttendanceStore {
  // State
  currentSession: Session | null
  attendanceRecords: AttendanceRecord[]
  notifications: AttendanceNotification[]
  cameraStatuses: Record<string, CameraStatus>
  cameras: Record<string, CameraConfig> // New: Full camera config
  detectedFaces: Record<string, IdentifiedFace[]>
  language: Language
  isLoading: boolean
  error: string | null
  totalStudents: number // Total students from database

  // Actions
  setSession: (session: Session | null) => void
  addAttendanceRecord: (record: AttendanceRecord) => void
  updateAttendanceRecord: (id: string, updates: Partial<AttendanceRecord>) => void
  setAttendanceRecords: (records: AttendanceRecord[]) => void
  addNotification: (notification: AttendanceNotification) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
  setCameraStatus: (cameraId: string, status: CameraStatus) => void
  setDetectedFaces: (cameraId: string, faces: IdentifiedFace[]) => void
  setLanguage: (lang: Language) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setTotalStudents: (total: number) => void
  reset: () => void

  // Camera Management
  addCamera: (camera: CameraConfig) => void
  updateCamera: (id: string, updates: Partial<CameraConfig>) => void
  removeCamera: (id: string) => void

  // Computed getters
  getPresentCount: () => number
  getLateCount: () => number
  getAbsentCount: () => number
  getAttendancePercentage: () => number
  isTeacherPresent: () => boolean
  getTeacherRecord: () => AttendanceRecord | undefined
}

const getStoredLanguage = (): Language => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('attendance-language')
    const validLanguages: Language[] = ['ru', 'kk', 'en', 'tr', 'de', 'zh']
    if (validLanguages.includes(stored as Language)) {
      return stored as Language
    }
  }
  return 'ru'
}

// Initial state - data loaded from backend via useDashboardData hook
export const useAttendanceStore = create<AttendanceStore>((set, get) => ({
  // Initial state - empty, will be populated from backend
  currentSession: null,
  attendanceRecords: [],
  notifications: [],
  cameraStatuses: {},
  cameras: {},
  detectedFaces: {},
  language: getStoredLanguage(),
  isLoading: true, // Start with loading state
  error: null,
  totalStudents: 0,

  // Actions
  setSession: (session) => set({ currentSession: session }),

  addAttendanceRecord: (record) =>
    set((state) => ({
      attendanceRecords: [...state.attendanceRecords, record],
    })),

  updateAttendanceRecord: (id, updates) =>
    set((state) => ({
      attendanceRecords: state.attendanceRecords.map((record) =>
        record.id === id ? { ...record, ...updates } : record
      ),
    })),

  setAttendanceRecords: (records) => set({ attendanceRecords: records }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
    })),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearNotifications: () => set({ notifications: [] }),

  setCameraStatus: (cameraId, status) =>
    set((state) => ({
      cameraStatuses: { ...state.cameraStatuses, [cameraId]: status },
      cameras: state.cameras[cameraId]
        ? { ...state.cameras, [cameraId]: { ...state.cameras[cameraId], status } }
        : state.cameras
    })),

  setDetectedFaces: (cameraId, faces) =>
    set((state) => ({
      detectedFaces: { ...state.detectedFaces, [cameraId]: faces },
    })),

  setLanguage: (lang) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('attendance-language', lang)
    }
    set({ language: lang })
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  setTotalStudents: (total) => set({ totalStudents: total }),

  reset: () => set({
    currentSession: null,
    attendanceRecords: [],
    notifications: [],
    cameraStatuses: {},
    detectedFaces: {},
    isLoading: false,
    error: null,
  }),

  // Computed getters
  getPresentCount: () => {
    const { attendanceRecords } = get()
    return attendanceRecords.filter(
      (r) => r.person.role === 'student' && (r.status === 'present' || r.status === 'late')
    ).length
  },

  getLateCount: () => {
    const { attendanceRecords } = get()
    return attendanceRecords.filter(
      (r) => r.person.role === 'student' && r.status === 'late'
    ).length
  },

  getAbsentCount: () => {
    const { attendanceRecords, currentSession } = get()
    if (!currentSession) return 0
    const presentOrLate = attendanceRecords.filter(
      (r) => r.person.role === 'student' && r.status !== 'absent'
    ).length
    return currentSession.studentIds.length - presentOrLate
  },

  getAttendancePercentage: () => {
    const { currentSession } = get()
    if (!currentSession || currentSession.studentIds.length === 0) return 0
    const presentCount = get().getPresentCount()
    return Math.round((presentCount / currentSession.studentIds.length) * 100)
  },

  isTeacherPresent: () => {
    const { attendanceRecords } = get()
    const teacherRecord = attendanceRecords.find((r) => r.person.role === 'teacher')
    if (!teacherRecord) return false
    // Check if teacher's last event was an entry or reentry
    const lastEvent = teacherRecord.events[teacherRecord.events.length - 1]
    return lastEvent?.eventType !== 'exit'
  },

  getTeacherRecord: () => {
    const { attendanceRecords } = get()
    return attendanceRecords.find((r) => r.person.role === 'teacher')
  },

  // Camera Actions
  addCamera: (camera) => set((state) => ({
    cameraStatuses: { ...state.cameraStatuses, [camera.id]: camera.status },
    cameras: { ...state.cameras, [camera.id]: camera }
  })),

  updateCamera: (id, updates) => set((state) => ({
    cameras: {
      ...state.cameras,
      [id]: { ...state.cameras[id], ...updates }
    }
  })),

  removeCamera: (id) => set((state) => {
    const newCameras = { ...state.cameras }
    const newStatuses = { ...state.cameraStatuses }
    delete newCameras[id]
    delete newStatuses[id]
    return { cameras: newCameras, cameraStatuses: newStatuses }
  }),
}))
