import { useEffect, useState, useCallback } from 'react'
import { useAttendanceStore, AttendanceRecord, Session } from '../store/attendanceStore'
import { getAttendance, getAttendanceStats, getCurrentSession, getPersons, BackendAttendanceRecord } from '../services/api'

interface ReportsDataState {
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
    const sessionStart = new Date(entryTime)
    sessionStart.setHours(8, 30, 0, 0)
    lateByMinutes = Math.max(0, Math.round((entryTime.getTime() - sessionStart.getTime()) / 60000))
  }

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
    studentIds: [], // Will be populated from persons
    status: backendSession.status as 'scheduled' | 'active' | 'completed',
  }
}

export function useReportsData(group?: string) {
  const { setSession, setAttendanceRecords, setLoading, setError, setTotalStudents } = useAttendanceStore()
  const [state, setState] = useState<ReportsDataState>({
    isLoading: true,
    error: null,
    stats: null,
  })

  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    setLoading(true)

    try {
      // Fetch all data in parallel (filtered by group if provided)
      const [attendance, stats, session, persons] = await Promise.all([
        getAttendance(group),
        getAttendanceStats(group),
        getCurrentSession(),
        getPersons(),
      ])

      // Transform session
      let currentSession: Session | null = null
      if (session) {
        currentSession = transformSession(session)
        // Add student IDs from persons
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
      console.error('Failed to load reports data:', err)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
      setLoading(false)
      setError(errorMessage)
    }
  }, [group, setSession, setAttendanceRecords, setLoading, setError, setTotalStudents])

  // Load data on mount and when group changes
  useEffect(() => {
    loadData()
  }, [loadData])

  return {
    ...state,
    refetch: loadData,
  }
}
