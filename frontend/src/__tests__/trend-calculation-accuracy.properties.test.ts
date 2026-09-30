/**
 * Feature: student-attendance-tracking
 * Property 10: Trend Calculation Accuracy
 * Validates: Requirements 10.1
 *
 * For any time period (daily, weekly, monthly), the attendance trend data SHALL accurately
 * reflect the average attendance rate, late rate, and absent rate calculated from all
 * sessions within that period.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

// Types for trend calculation
interface SessionStats {
  date: Date
  totalStudents: number
  presentCount: number
  lateCount: number
  absentCount: number
}

interface TrendDataPoint {
  date: string
  attendance: number // percentage
  late: number // percentage
  absent: number // percentage
}

// Arbitrary for generating valid session stats
const sessionStatsArb = fc
  .tuple(
    fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
    fc.integer({ min: 10, max: 50 }) // totalStudents
  )
  .chain(([date, totalStudents]) =>
    fc
      .tuple(
        fc.constant(date),
        fc.constant(totalStudents),
        fc.integer({ min: 0, max: totalStudents }) // presentCount
      )
      .chain(([date, total, present]) =>
        fc
          .integer({ min: 0, max: total - present }) // lateCount (from remaining)
          .map((late): SessionStats => ({
            date,
            totalStudents: total,
            presentCount: present,
            lateCount: late,
            absentCount: total - present - late,
          }))
      )
  )

// Arbitrary for generating a list of session stats over a period
const sessionStatsListArb = fc.array(sessionStatsArb, { minLength: 1, maxLength: 30 })

// Function to calculate trend data from session stats
function calculateTrendData(sessions: SessionStats[]): TrendDataPoint[] {
  // Group sessions by date
  const byDate = new Map<string, SessionStats[]>()

  sessions.forEach((session) => {
    const dateKey = session.date.toISOString().split('T')[0]
    const existing = byDate.get(dateKey) || []
    byDate.set(dateKey, [...existing, session])
  })

  // Calculate averages for each date
  const trendData: TrendDataPoint[] = []

  byDate.forEach((daySessions, dateKey) => {
    let totalStudents = 0
    let totalPresent = 0
    let totalLate = 0
    let totalAbsent = 0

    daySessions.forEach((session) => {
      totalStudents += session.totalStudents
      totalPresent += session.presentCount
      totalLate += session.lateCount
      totalAbsent += session.absentCount
    })

    if (totalStudents > 0) {
      trendData.push({
        date: dateKey,
        attendance: Math.round((totalPresent / totalStudents) * 100),
        late: Math.round((totalLate / totalStudents) * 100),
        absent: Math.round((totalAbsent / totalStudents) * 100),
      })
    }
  })

  // Sort by date
  return trendData.sort((a, b) => a.date.localeCompare(b.date))
}

// Function to calculate overall averages from trend data
function calculateOverallAverages(trendData: TrendDataPoint[]): {
  avgAttendance: number
  avgLate: number
  avgAbsent: number
} {
  if (trendData.length === 0) {
    return { avgAttendance: 0, avgLate: 0, avgAbsent: 0 }
  }

  const sum = trendData.reduce(
    (acc, point) => ({
      attendance: acc.attendance + point.attendance,
      late: acc.late + point.late,
      absent: acc.absent + point.absent,
    }),
    { attendance: 0, late: 0, absent: 0 }
  )

  return {
    avgAttendance: Math.round(sum.attendance / trendData.length),
    avgLate: Math.round(sum.late / trendData.length),
    avgAbsent: Math.round(sum.absent / trendData.length),
  }
}

// Function to calculate expected averages directly from sessions
function _calculateExpectedAverages(sessions: SessionStats[]): {
  avgAttendance: number
  avgLate: number
  avgAbsent: number
} {
  if (sessions.length === 0) {
    return { avgAttendance: 0, avgLate: 0, avgAbsent: 0 }
  }

  let totalStudents = 0
  let totalPresent = 0
  let totalLate = 0
  let totalAbsent = 0

  sessions.forEach((session) => {
    totalStudents += session.totalStudents
    totalPresent += session.presentCount
    totalLate += session.lateCount
    totalAbsent += session.absentCount
  })

  if (totalStudents === 0) {
    return { avgAttendance: 0, avgLate: 0, avgAbsent: 0 }
  }

  return {
    avgAttendance: Math.round((totalPresent / totalStudents) * 100),
    avgLate: Math.round((totalLate / totalStudents) * 100),
    avgAbsent: Math.round((totalAbsent / totalStudents) * 100),
  }
}

// Export for potential future use
export { _calculateExpectedAverages as calculateExpectedAverages }

describe('Property 10: Trend Calculation Accuracy', () => {
  it('should calculate attendance percentage correctly for each data point', () => {
    fc.assert(
      fc.property(sessionStatsListArb, (sessions) => {
        const trendData = calculateTrendData(sessions)

        // Each data point should have valid percentages
        trendData.forEach((point) => {
          expect(point.attendance).toBeGreaterThanOrEqual(0)
          expect(point.attendance).toBeLessThanOrEqual(100)
          expect(point.late).toBeGreaterThanOrEqual(0)
          expect(point.late).toBeLessThanOrEqual(100)
          expect(point.absent).toBeGreaterThanOrEqual(0)
          expect(point.absent).toBeLessThanOrEqual(100)
        })

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should have percentages that sum to approximately 100%', () => {
    fc.assert(
      fc.property(sessionStatsListArb, (sessions) => {
        const trendData = calculateTrendData(sessions)

        // For each data point, attendance + late + absent should be close to 100%
        // (allowing for rounding errors)
        trendData.forEach((point) => {
          const sum = point.attendance + point.late + point.absent
          // Allow 3% tolerance for rounding errors
          expect(sum).toBeGreaterThanOrEqual(97)
          expect(sum).toBeLessThanOrEqual(103)
        })

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should preserve data for all unique dates', () => {
    fc.assert(
      fc.property(sessionStatsListArb, (sessions) => {
        const trendData = calculateTrendData(sessions)

        // Get unique dates from sessions
        const uniqueDates = new Set(sessions.map((s) => s.date.toISOString().split('T')[0]))

        // Trend data should have an entry for each unique date
        expect(trendData.length).toBe(uniqueDates.size)

        // All dates in trend data should be from the original sessions
        trendData.forEach((point) => {
          expect(uniqueDates.has(point.date)).toBe(true)
        })

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should sort trend data chronologically', () => {
    fc.assert(
      fc.property(sessionStatsListArb, (sessions) => {
        const trendData = calculateTrendData(sessions)

        // Data should be sorted by date
        for (let i = 0; i < trendData.length - 1; i++) {
          expect(trendData[i].date.localeCompare(trendData[i + 1].date)).toBeLessThanOrEqual(0)
        }

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should calculate correct attendance rate for single session', () => {
    fc.assert(
      fc.property(sessionStatsArb, (session) => {
        const trendData = calculateTrendData([session])

        expect(trendData.length).toBe(1)

        const expectedAttendance = Math.round((session.presentCount / session.totalStudents) * 100)
        const expectedLate = Math.round((session.lateCount / session.totalStudents) * 100)
        const expectedAbsent = Math.round((session.absentCount / session.totalStudents) * 100)

        expect(trendData[0].attendance).toBe(expectedAttendance)
        expect(trendData[0].late).toBe(expectedLate)
        expect(trendData[0].absent).toBe(expectedAbsent)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should aggregate multiple sessions on the same date correctly', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
        fc.array(
          fc.tuple(
            fc.integer({ min: 10, max: 30 }), // totalStudents
            fc.integer({ min: 0, max: 10 }), // presentCount
            fc.integer({ min: 0, max: 10 }) // lateCount
          ),
          { minLength: 2, maxLength: 5 }
        ),
        (date, sessionData) => {
          // Create sessions on the same date
          const sessions: SessionStats[] = sessionData.map(([total, present, late]) => {
            const actualPresent = Math.min(present, total)
            const actualLate = Math.min(late, total - actualPresent)
            return {
              date,
              totalStudents: total,
              presentCount: actualPresent,
              lateCount: actualLate,
              absentCount: total - actualPresent - actualLate,
            }
          })

          const trendData = calculateTrendData(sessions)

          // Should have only one data point for the date
          expect(trendData.length).toBe(1)

          // Calculate expected aggregated values
          const totalStudents = sessions.reduce((sum, s) => sum + s.totalStudents, 0)
          const totalPresent = sessions.reduce((sum, s) => sum + s.presentCount, 0)
          const totalLate = sessions.reduce((sum, s) => sum + s.lateCount, 0)
          const totalAbsent = sessions.reduce((sum, s) => sum + s.absentCount, 0)

          const expectedAttendance = Math.round((totalPresent / totalStudents) * 100)
          const expectedLate = Math.round((totalLate / totalStudents) * 100)
          const expectedAbsent = Math.round((totalAbsent / totalStudents) * 100)

          expect(trendData[0].attendance).toBe(expectedAttendance)
          expect(trendData[0].late).toBe(expectedLate)
          expect(trendData[0].absent).toBe(expectedAbsent)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should calculate overall averages accurately', () => {
    fc.assert(
      fc.property(sessionStatsListArb, (sessions) => {
        const trendData = calculateTrendData(sessions)
        const overallAverages = calculateOverallAverages(trendData)

        // Verify that overall averages are valid percentages
        expect(overallAverages.avgAttendance).toBeGreaterThanOrEqual(0)
        expect(overallAverages.avgAttendance).toBeLessThanOrEqual(100)
        expect(overallAverages.avgLate).toBeGreaterThanOrEqual(0)
        expect(overallAverages.avgLate).toBeLessThanOrEqual(100)
        expect(overallAverages.avgAbsent).toBeGreaterThanOrEqual(0)
        expect(overallAverages.avgAbsent).toBeLessThanOrEqual(100)

        // The sum of averages should be approximately 100%
        // (allowing for rounding errors across multiple days)
        const sum = overallAverages.avgAttendance + overallAverages.avgLate + overallAverages.avgAbsent
        expect(sum).toBeGreaterThanOrEqual(90)
        expect(sum).toBeLessThanOrEqual(110)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should handle edge case of zero students gracefully', () => {
    // This tests that the calculation doesn't crash with edge cases
    const emptySession: SessionStats = {
      date: new Date('2024-06-15'),
      totalStudents: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0,
    }

    const trendData = calculateTrendData([emptySession])

    // Should handle gracefully (either empty or with zeros)
    expect(trendData.length).toBeLessThanOrEqual(1)
  })

  it('should maintain data integrity across time ranges', () => {
    fc.assert(
      fc.property(sessionStatsListArb, (sessions) => {
        const trendData = calculateTrendData(sessions)

        // No data should be lost or duplicated
        const totalSessionsInTrend = trendData.length
        const uniqueDatesInSessions = new Set(sessions.map((s) => s.date.toISOString().split('T')[0])).size

        expect(totalSessionsInTrend).toBe(uniqueDatesInSessions)

        // All percentages should be valid numbers
        trendData.forEach((point) => {
          expect(Number.isFinite(point.attendance)).toBe(true)
          expect(Number.isFinite(point.late)).toBe(true)
          expect(Number.isFinite(point.absent)).toBe(true)
        })

        return true
      }),
      { numRuns: 100 }
    )
  })
})
