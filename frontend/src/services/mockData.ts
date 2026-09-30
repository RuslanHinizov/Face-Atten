// Mock data for frontend-only demo
// Backend developer will replace these with real API calls

export interface Person {
  id: string
  name: string
  role: 'student' | 'teacher'
  photo_url: string | null
  has_face_encoding: boolean
  registered_at: string
}

export interface AttendanceRecord {
  id: string
  person_id: string
  person_name: string
  role: 'student' | 'teacher'
  status: 'present' | 'late' | 'absent'
  entry_time: string | null
  exit_time: string | null
}

export interface DetectedFace {
  id: string
  name: string
  role: 'student' | 'teacher'
  confidence: number
  is_known: boolean
  bounding_box: { top: number; right: number; bottom: number; left: number }
}

// Demo persons - Kazakh names
export const mockPersons: Person[] = [
  { id: '1', name: 'Асанов Нұрлан', role: 'student', photo_url: null, has_face_encoding: true, registered_at: '2024-01-10T09:00:00Z' },
  { id: '2', name: 'Бекова Айгүл', role: 'student', photo_url: null, has_face_encoding: true, registered_at: '2024-01-10T09:05:00Z' },
  { id: '3', name: 'Сәрсенов Ерлан', role: 'student', photo_url: null, has_face_encoding: true, registered_at: '2024-01-10T09:10:00Z' },
  { id: '4', name: 'Қасымова Дана', role: 'student', photo_url: null, has_face_encoding: false, registered_at: '2024-01-10T09:15:00Z' },
  { id: '5', name: 'Жұмабеков Арман', role: 'student', photo_url: null, has_face_encoding: true, registered_at: '2024-01-10T09:20:00Z' },
  { id: '6', name: 'Оразова Мадина', role: 'student', photo_url: null, has_face_encoding: true, registered_at: '2024-01-10T09:25:00Z' },
  { id: '7', name: 'Төлеуов Бауыржан', role: 'student', photo_url: null, has_face_encoding: true, registered_at: '2024-01-10T09:30:00Z' },
  { id: '8', name: 'Ахметова Жансая', role: 'student', photo_url: null, has_face_encoding: true, registered_at: '2024-01-10T09:35:00Z' },
  { id: '9', name: 'Профессор Мұратов', role: 'teacher', photo_url: null, has_face_encoding: true, registered_at: '2024-01-05T08:00:00Z' },
  { id: '10', name: 'Доцент Сұлтанова', role: 'teacher', photo_url: null, has_face_encoding: true, registered_at: '2024-01-05T08:30:00Z' },
]

// Demo attendance records
export const mockAttendance: AttendanceRecord[] = [
  { id: '1', person_id: '1', person_name: 'Асанов Нұрлан', role: 'student', status: 'present', entry_time: '2024-01-15T08:55:00Z', exit_time: null },
  { id: '2', person_id: '2', person_name: 'Бекова Айгүл', role: 'student', status: 'present', entry_time: '2024-01-15T08:58:00Z', exit_time: null },
  { id: '3', person_id: '3', person_name: 'Сәрсенов Ерлан', role: 'student', status: 'late', entry_time: '2024-01-15T09:15:00Z', exit_time: null },
  { id: '4', person_id: '5', person_name: 'Жұмабеков Арман', role: 'student', status: 'present', entry_time: '2024-01-15T08:50:00Z', exit_time: null },
  { id: '5', person_id: '6', person_name: 'Оразова Мадина', role: 'student', status: 'present', entry_time: '2024-01-15T08:52:00Z', exit_time: null },
  { id: '6', person_id: '9', person_name: 'Профессор Мұратов', role: 'teacher', status: 'present', entry_time: '2024-01-15T08:45:00Z', exit_time: null },
]

// Demo detected faces for camera overlay
export const mockDetectedFaces: DetectedFace[] = [
  { id: '1', name: 'Асанов Нұрлан', role: 'student', confidence: 0.95, is_known: true, bounding_box: { top: 100, right: 250, bottom: 280, left: 120 } },
  { id: '2', name: 'Бекова Айгүл', role: 'student', confidence: 0.92, is_known: true, bounding_box: { top: 90, right: 450, bottom: 270, left: 320 } },
  { id: 'unknown', name: 'Белгісіз', role: 'student', confidence: 0, is_known: false, bounding_box: { top: 150, right: 650, bottom: 330, left: 520 } },
]

// Demo events
export interface AttendanceEvent {
  id: string
  type: 'entry' | 'exit' | 'late' | 'unknown'
  person_name: string
  role: 'student' | 'teacher'
  timestamp: string
  camera_id: string
}

export const mockEvents: AttendanceEvent[] = [
  { id: '1', type: 'entry', person_name: 'Профессор Мұратов', role: 'teacher', timestamp: '2024-01-15T08:45:00Z', camera_id: 'camera-1' },
  { id: '2', type: 'entry', person_name: 'Жұмабеков Арман', role: 'student', timestamp: '2024-01-15T08:50:00Z', camera_id: 'camera-1' },
  { id: '3', type: 'entry', person_name: 'Оразова Мадина', role: 'student', timestamp: '2024-01-15T08:52:00Z', camera_id: 'camera-1' },
  { id: '4', type: 'entry', person_name: 'Асанов Нұрлан', role: 'student', timestamp: '2024-01-15T08:55:00Z', camera_id: 'camera-2' },
  { id: '5', type: 'entry', person_name: 'Бекова Айгүл', role: 'student', timestamp: '2024-01-15T08:58:00Z', camera_id: 'camera-2' },
  { id: '6', type: 'late', person_name: 'Сәрсенов Ерлан', role: 'student', timestamp: '2024-01-15T09:15:00Z', camera_id: 'camera-1' },
  { id: '7', type: 'unknown', person_name: 'Белгісіз', role: 'student', timestamp: '2024-01-15T09:20:00Z', camera_id: 'camera-2' },
]
