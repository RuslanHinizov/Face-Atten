// API Service - Backend Connection
// Set USE_MOCK = true for demo mode, false for real backend

const USE_MOCK = false // ← Demo modu açık (backend yokken true yapın)
const API_BASE = '/api' // Vite proxy üzerinden backend'e gider

import { 
  mockPersons, 
  mockAttendance, 
  mockEvents,
  type Person, 
  type AttendanceRecord,
  type AttendanceEvent 
} from './mockData'

// ============ HELPER ============

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }
  
  return response.json()
}

// Simulated delay for mock mode
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// In-memory storage for mock mode
let mockPersonsData = [...mockPersons]
let mockAttendanceData = [...mockAttendance]
let mockEventsData = [...mockEvents]

// ============ PERSONS API ============

export async function getPersons(role?: 'student' | 'teacher'): Promise<Person[]> {
  if (USE_MOCK) {
    await delay(300)
    return role ? mockPersonsData.filter(p => p.role === role) : mockPersonsData
  }
  
  const params = role ? `?role=${role}` : ''
  return apiRequest<Person[]>(`/persons${params}`)
}

export async function addPerson(name: string, role: 'student' | 'teacher'): Promise<Person> {
  if (USE_MOCK) {
    await delay(500)
    const newPerson: Person = {
      id: String(Date.now()),
      name,
      role,
      photo_url: null,
      has_face_encoding: false,
      registered_at: new Date().toISOString()
    }
    mockPersonsData.push(newPerson)
    return newPerson
  }
  
  return apiRequest<Person>('/persons', {
    method: 'POST',
    body: JSON.stringify({ name, role })
  })
}

export async function deletePerson(id: string): Promise<void> {
  if (USE_MOCK) {
    await delay(300)
    mockPersonsData = mockPersonsData.filter(p => p.id !== id)
    return
  }
  
  await apiRequest(`/persons/${id}`, { method: 'DELETE' })
}

export async function uploadFaceImages(
  personId: string, 
  images: File[]
): Promise<{ success: boolean; message: string }> {
  if (USE_MOCK) {
    await delay(1500)
    const person = mockPersonsData.find(p => p.id === personId)
    if (person) person.has_face_encoding = true
    return { success: true, message: 'Бет сәтті тіркелді' }
  }
  
  const formData = new FormData()
  images.forEach(img => formData.append('images', img))
  
  const response = await fetch(`${API_BASE}/persons/${personId}/faces`, {
    method: 'POST',
    body: formData // FormData için Content-Type otomatik ayarlanır
  })
  
  if (!response.ok) {
    throw new Error('Face upload failed')
  }
  
  return response.json()
}

// ============ ATTENDANCE API ============

// Backend attendance record format (different from mock)
export interface BackendAttendanceRecord {
  id: string
  person_id: string
  name: string
  role: string
  status: string
  timestamp: string
  confidence: number
  camera_id?: string
  group?: string
}

export async function getAttendance(group?: string): Promise<BackendAttendanceRecord[]> {
  if (USE_MOCK) {
    await delay(300)
    return mockAttendanceData.map(r => ({
      id: r.id,
      person_id: r.person_id,
      name: r.person_name,
      role: r.role,
      status: r.status,
      timestamp: r.entry_time || new Date().toISOString(),
      confidence: 0.95
    }))
  }

  const params = group ? `?group=${group}` : ''
  return apiRequest<BackendAttendanceRecord[]>(`/attendance${params}`)
}

export async function getAttendanceStats(group?: string) {
  if (USE_MOCK) {
    await delay(200)
    const students = mockAttendanceData.filter(a => a.role === 'student')
    return {
      total: mockPersonsData.filter(p => p.role === 'student').length,
      present: students.filter(a => a.status === 'present').length,
      late: students.filter(a => a.status === 'late').length,
      absent: mockPersonsData.filter(p => p.role === 'student').length - students.length,
      teacher_present: mockAttendanceData.some(a => a.role === 'teacher')
    }
  }

  const params = group ? `?group=${group}` : ''
  return apiRequest<{
    total: number
    present: number
    late: number
    absent: number
    teacher_present: boolean
  }>(`/attendance/stats${params}`)
}

// ============ SESSION API ============

export interface Session {
  id: string
  name: string
  course_code: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'active' | 'completed'
}

export async function getCurrentSession(): Promise<Session | null> {
  if (USE_MOCK) {
    await delay(200)
    return {
      id: 'demo-session',
      name: 'Ақпараттық технологиялар 101',
      course_code: 'CS101',
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 90 * 60000).toISOString(),
      status: 'active'
    }
  }
  
  return apiRequest<Session | null>('/session/current')
}

export async function startSession(data: { name: string; course_code: string }): Promise<Session> {
  if (USE_MOCK) {
    await delay(500)
    return {
      id: String(Date.now()),
      ...data,
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 90 * 60000).toISOString(),
      status: 'active'
    }
  }
  
  return apiRequest<Session>('/session/start', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function endSession(): Promise<void> {
  if (USE_MOCK) {
    await delay(300)
    return
  }
  
  await apiRequest('/session/end', { method: 'POST' })
}

// ============ EVENTS API ============

export async function getEvents(): Promise<AttendanceEvent[]> {
  if (USE_MOCK) {
    await delay(200)
    return mockEventsData.slice(-10).reverse()
  }
  
  return apiRequest<AttendanceEvent[]>('/events?limit=10')
}

// ============ CAMERA API ============

export interface CameraConfig {
  camera_id: string
  name: string
  source: string // RTSP URL veya webcam index
  type: 'rtsp' | 'webcam' | 'video'
  enabled: boolean
}

export async function getCameras(): Promise<CameraConfig[]> {
  if (USE_MOCK) {
    await delay(200)
    return [
      { camera_id: 'camera-1', name: 'Камера 1', source: '', type: 'rtsp', enabled: false },
      { camera_id: 'camera-2', name: 'Камера 2', source: '', type: 'rtsp', enabled: false }
    ]
  }
  
  return apiRequest<CameraConfig[]>('/cameras')
}

export async function updateCamera(config: CameraConfig): Promise<{ success: boolean }> {
  if (USE_MOCK) {
    await delay(500)
    return { success: true }
  }
  
  return apiRequest<{ success: boolean }>(`/cameras/${config.camera_id}`, {
    method: 'PUT',
    body: JSON.stringify(config)
  })
}

export async function testCameraConnection(source: string): Promise<{ success: boolean; message: string }> {
  if (USE_MOCK) {
    await delay(1000)
    return { success: true, message: 'Камера қосылды' }
  }
  
  return apiRequest<{ success: boolean; message: string }>('/cameras/test', {
    method: 'POST',
    body: JSON.stringify({ source })
  })
}

// ============ DATABASE API ============

export interface DatabaseInfo {
  path: string
  persons: number
  names: number
  size_kb: number
  current: boolean
}

export async function getDatabases(): Promise<DatabaseInfo[]> {
  if (USE_MOCK) {
    await delay(200)
    return [
      { path: 'database.pkl', persons: 38, names: 38, size_kb: 1024, current: true },
      { path: 'database418.pkl', persons: 19, names: 19, size_kb: 512, current: false },
      { path: 'database428.pkl', persons: 19, names: 19, size_kb: 512, current: false }
    ]
  }

  return apiRequest<DatabaseInfo[]>('/databases')
}

export async function selectDatabase(path: string): Promise<{ success: boolean; message: string; persons_count: number }> {
  if (USE_MOCK) {
    await delay(500)
    return { success: true, message: `Switched to ${path}`, persons_count: 19 }
  }

  return apiRequest<{ success: boolean; message: string; persons_count: number }>('/databases/select', {
    method: 'POST',
    body: JSON.stringify({ path })
  })
}

// ============ EXPORT TYPES ============

export type { Person, AttendanceRecord, AttendanceEvent }
