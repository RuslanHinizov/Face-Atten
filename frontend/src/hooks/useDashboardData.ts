import { useEffect, useState, useCallback } from 'react'
import { useAttendanceStore, AttendanceRecord, Session, AttendanceNotification, CameraConfig } from '../store/attendanceStore'
import {
  getAttendance,
  getAttendanceStats,
  getCurrentSession,
  getPersons,
  getCameras,
  getEvents,
  BackendAttendanceRecord
} from '../services/api'

interface DashboardDataState {
  isLoading: boolean
  error: string | null
  stats: {
    total: number
    present: number
    late: number
    absent: number
    teacherPresent: boolean
  } | null
}

// Transform backend attendance record to frontend store format
function transformAttendanceRecord(
  backendRecord: BackendAttendanceRecord,
  sessionId: string
): AttendanceRecord {
  const entryTime = new Date(backendRecord.timestamp)
  const now = new Date()
  const totalMinutes = Math.round((now.getTime() - entryTime.getTime()) / 60000)

  let lateByMinutes = 0
  if (backendRecord.status === 'late') {
    // Use session start time if available (passed as sessionStartTime), otherwise 8:30
    const sessionStart = new Date(entryTime)
    sessionStart.setHours(8, 30, 0, 0)
    lateByMinutes = Math.max(0, Math.round((entryTime.getTime() - sessionStart.getTime()) / 60000))
  }

  // Derive group name from group code
  const groupName = backendRecord.group === '418' ? 'ИП-21'
    : backendRecord.group === '428' ? 'СТ-21'
    : undefined

  return {
    id: backendRecord.id,
    sessionId: sessionId,
    person: {
      id: backendRecord.person_id,
      name: backendRecord.name,
      role: backendRecord.role as 'student' | 'teacher',
      group: groupName,
    },
    status: backendRecord.status as 'present' | 'late' | 'absent',
    firstEntry: entryTime,
    events: [{
      id: `event-${backendRecord.id}`,
      eventType: 'entry' as const,
      timestamp: entryTime,
      cameraId: backendRecord.camera_id || 'camera-1'
    }],
    totalTimeMinutes: totalMinutes,
    lateByMinutes: lateByMinutes,
  }
}

// Transform backend session to frontend store format
function transformSession(backendSession: {
  id: string
  name: string
  course_code: string
  start_time: string
  end_time: string
  status: string
}): Session {
  return {
    id: backendSession.id,
    name: backendSession.name,
    courseCode: backendSession.course_code,
    startTime: new Date(backendSession.start_time),
    endTime: new Date(backendSession.end_time),
    studentIds: [],
    status: backendSession.status as 'scheduled' | 'active' | 'completed',
  }
}

// Transform backend event to notification
function transformEventToNotification(event: {
  id: string
  type: string
  person_id?: string
  person_name?: string
  name?: string
  timestamp: string
  camera_id?: string
}, index: number): AttendanceNotification {
  const eventType = event.type === 'attendance' ? 'entry' : event.type as 'entry' | 'exit' | 'late'

  let color: 'green' | 'yellow' | 'red' | 'blue' | 'gray' = 'gray'
  if (eventType === 'entry') color = 'green'
  else if (eventType === 'late') color = 'yellow'
  else if (eventType === 'exit') color = 'blue'

  return {
    id: event.id || `event-${index}`,
    personId: event.person_id || 'unknown',
    personName: event.name || event.person_name || 'Unknown',
    personRole: 'student',
    eventType: eventType,
    timestamp: new Date(event.timestamp),
    color: color,
    cameraId: event.camera_id,
  }
}

// Transform backend camera to frontend format
function transformCamera(backendCamera: {
  camera_id: string
  name: string
  source: string
  type: string
  enabled: boolean
}): CameraConfig {
  return {
    id: backendCamera.camera_id,
    name: backendCamera.name,
    location: backendCamera.type === 'rtsp' ? 'RTSP Stream' : 'Video File',
    status: backendCamera.enabled ? 'connected' : 'disconnected',
    streamUrl: `/api/stream/${backendCamera.camera_id}`,
    rtspUrl: backendCamera.source,
  }
}

export function useDashboardData() {
  const {
    setSession,
    setAttendanceRecords,
    addNotification,
    clearNotifications,
    addCamera,
    setLoading,
    setError,
    setTotalStudents
  } = useAttendanceStore()

  const [state, setState] = useState<DashboardDataState>({
    isLoading: true,
    error: null,
    stats: null,
  })

  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    setLoading(true)

    try {
      // Fetch all data in parallel
      const [attendance, stats, session, persons, cameras, events] = await Promise.all([
        getAttendance(),
        getAttendanceStats(),
        getCurrentSession(),
        getPersons(),
        getCameras(),
        getEvents(),
      ])

      // Transform session
      let currentSession: Session | null = null
      if (session) {
        currentSession = transformSession(session)
        const studentIds = persons
          .filter(p => p.role === 'student')
          .map(p => p.id)
        currentSession.studentIds = studentIds
        setSession(currentSession)
      }

      // Transform attendance records
      const sessionId = session?.id || 'default-session'
      const transformedRecords = attendance.map(record =>
        transformAttendanceRecord(record, sessionId)
      )
      setAttendanceRecords(transformedRecords)

      // Transform and add cameras
      cameras.forEach(camera => {
        const transformed = transformCamera(camera)
        addCamera(transformed)
      })

      // Transform events to notifications
      clearNotifications()
      events.forEach((event: any, index: number) => {
        const notification = transformEventToNotification(event, index)
        addNotification(notification)
      })

      // Update stats
      setTotalStudents(stats.total)

      setState({
        isLoading: false,
        error: null,
        stats: {
          total: stats.total,
          present: stats.present,
          late: stats.late,
          absent: stats.absent,
          teacherPresent: stats.teacher_present,
        },
      })

      setLoading(false)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data'
      console.error('Failed to load dashboard data:', err)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
      setLoading(false)
      setError(errorMessage)
    }
  }, [setSession, setAttendanceRecords, addNotification, clearNotifications, addCamera, setLoading, setError, setTotalStudents])

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadData()
    }, 30000)

    return () => clearInterval(interval)
  }, [loadData])

  return {
    ...state,
    refetch: loadData,
  }
}
