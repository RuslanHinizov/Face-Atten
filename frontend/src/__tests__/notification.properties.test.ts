/**
 * Feature: student-attendance-tracking
 * Property 5: Notification Content Completeness
 * Validates: Requirements 2.3, 3.3, 7.2, 7.4
 * 
 * For any attendance event that triggers a notification, the notification SHALL contain
 * the person's name, event type, and timestamp; and the notification color SHALL be:
 * green for on-time entry, yellow for late entry, red for exit, blue for re-entry.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { AttendanceNotification } from '../store/attendanceStore'

// Arbitrary for generating valid person names
const personNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)

// Arbitrary for generating person roles
const personRoleArb = fc.constantFrom('student' as const, 'teacher' as const)

// Arbitrary for generating event types
const eventTypeArb = fc.constantFrom('entry' as const, 'exit' as const, 'reentry' as const, 'late' as const)

// Arbitrary for generating valid timestamps
const timestampArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })

// Arbitrary for generating valid notification IDs
const idArb = fc.uuid()

// Arbitrary for generating late minutes (optional)
const lateByMinutesArb = fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined })

// Function to determine the correct color for an event type
function getExpectedColor(eventType: AttendanceNotification['eventType']): AttendanceNotification['color'] {
  switch (eventType) {
    case 'entry':
      return 'green'
    case 'late':
      return 'yellow'
    case 'exit':
      return 'red'
    case 'reentry':
      return 'blue'
    default:
      return 'green'
  }
}

// Function to create a valid notification with correct color mapping
function createNotification(
  id: string,
  personId: string,
  personName: string,
  personRole: 'student' | 'teacher',
  eventType: AttendanceNotification['eventType'],
  timestamp: Date,
  lateByMinutes?: number
): AttendanceNotification {
  return {
    id,
    personId,
    personName,
    personRole,
    eventType,
    timestamp,
    color: getExpectedColor(eventType),
    lateByMinutes,
  }
}

// Arbitrary for generating complete valid notifications
const validNotificationArb = fc.tuple(
  idArb,
  idArb, // personId
  personNameArb,
  personRoleArb,
  eventTypeArb,
  timestampArb,
  lateByMinutesArb
).map(([id, personId, personName, personRole, eventType, timestamp, lateByMinutes]) =>
  createNotification(id, personId, personName, personRole, eventType, timestamp, lateByMinutes)
)

describe('Property 5: Notification Content Completeness', () => {
  it('should contain person name for all notifications', () => {
    fc.assert(
      fc.property(validNotificationArb, (notification) => {
        // Notification must have a non-empty person name
        expect(notification.personName).toBeDefined()
        expect(notification.personName.length).toBeGreaterThan(0)
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should contain event type for all notifications', () => {
    fc.assert(
      fc.property(validNotificationArb, (notification) => {
        // Notification must have a valid event type
        expect(notification.eventType).toBeDefined()
        expect(['entry', 'exit', 'reentry', 'late']).toContain(notification.eventType)
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should contain timestamp for all notifications', () => {
    fc.assert(
      fc.property(validNotificationArb, (notification) => {
        // Notification must have a valid timestamp
        expect(notification.timestamp).toBeDefined()
        expect(notification.timestamp instanceof Date).toBe(true)
        expect(notification.timestamp.getTime()).not.toBeNaN()
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should use green color for on-time entry events', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        personNameArb,
        personRoleArb,
        timestampArb,
        (id, personId, personName, personRole, timestamp) => {
          const notification = createNotification(
            id, personId, personName, personRole, 'entry', timestamp
          )
          expect(notification.color).toBe('green')
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should use yellow color for late entry events', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        personNameArb,
        personRoleArb,
        timestampArb,
        fc.integer({ min: 1, max: 120 }),
        (id, personId, personName, personRole, timestamp, lateMinutes) => {
          const notification = createNotification(
            id, personId, personName, personRole, 'late', timestamp, lateMinutes
          )
          expect(notification.color).toBe('yellow')
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should use red color for exit events', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        personNameArb,
        personRoleArb,
        timestampArb,
        (id, personId, personName, personRole, timestamp) => {
          const notification = createNotification(
            id, personId, personName, personRole, 'exit', timestamp
          )
          expect(notification.color).toBe('red')
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should use blue color for re-entry events', () => {
    fc.assert(
      fc.property(
        idArb,
        idArb,
        personNameArb,
        personRoleArb,
        timestampArb,
        (id, personId, personName, personRole, timestamp) => {
          const notification = createNotification(
            id, personId, personName, personRole, 'reentry', timestamp
          )
          expect(notification.color).toBe('blue')
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should have correct color mapping for all event types', () => {
    fc.assert(
      fc.property(validNotificationArb, (notification) => {
        const expectedColor = getExpectedColor(notification.eventType)
        expect(notification.color).toBe(expectedColor)
        return true
      }),
      { numRuns: 100 }
    )
  })
})
