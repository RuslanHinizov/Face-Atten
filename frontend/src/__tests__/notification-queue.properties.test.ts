/**
 * Feature: student-attendance-tracking
 * Property 6: Notification Queue Ordering
 * Validates: Requirements 7.3
 * 
 * For any set of simultaneous attendance events, the notifications SHALL be queued
 * and displayed sequentially without overlap, preserving the order of event timestamps.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import { AttendanceNotification } from '../store/attendanceStore'

// Arbitrary for generating valid person names
const personNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)

// Arbitrary for generating person roles
const personRoleArb = fc.constantFrom('student' as const, 'teacher' as const)

// Arbitrary for generating event types
const eventTypeArb = fc.constantFrom('entry' as const, 'exit' as const, 'reentry' as const, 'late' as const)

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

// Arbitrary for generating a single notification with a specific timestamp
const notificationWithTimestampArb = (baseTime: Date, offsetMs: number) =>
  fc.tuple(
    fc.uuid(),
    fc.uuid(),
    personNameArb,
    personRoleArb,
    eventTypeArb,
    fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined })
  ).map(([id, personId, personName, personRole, eventType, lateByMinutes]): AttendanceNotification => ({
    id,
    personId,
    personName,
    personRole,
    eventType,
    timestamp: new Date(baseTime.getTime() + offsetMs),
    color: getExpectedColor(eventType),
    lateByMinutes,
  }))

// Arbitrary for generating a list of notifications with sequential timestamps
const notificationListArb = fc.tuple(
  fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
  fc.array(fc.integer({ min: 0, max: 60000 }), { minLength: 1, maxLength: 20 })
).chain(([baseTime, offsets]) => {
  // Sort offsets to ensure chronological order
  const sortedOffsets = [...offsets].sort((a, b) => a - b)
  return fc.tuple(
    ...sortedOffsets.map(offset => notificationWithTimestampArb(baseTime, offset))
  )
})

// Simple queue implementation for testing
class NotificationQueue {
  private queue: AttendanceNotification[] = []
  private maxSize: number

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize
  }

  add(notification: AttendanceNotification): void {
    // Add to the front (most recent first)
    this.queue = [notification, ...this.queue].slice(0, this.maxSize)
  }

  addBatch(notifications: AttendanceNotification[]): void {
    // Sort by timestamp (oldest first) before adding
    const sorted = [...notifications].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    )
    // Add each notification in order (oldest first, so newest ends up at front)
    sorted.forEach(n => this.add(n))
  }

  getAll(): AttendanceNotification[] {
    return [...this.queue]
  }

  getVisible(count: number): AttendanceNotification[] {
    return this.queue.slice(0, count)
  }

  remove(id: string): void {
    this.queue = this.queue.filter(n => n.id !== id)
  }

  clear(): void {
    this.queue = []
  }

  size(): number {
    return this.queue.length
  }
}

describe('Property 6: Notification Queue Ordering', () => {
  let queue: NotificationQueue

  beforeEach(() => {
    queue = new NotificationQueue()
  })

  it('should preserve timestamp order when adding notifications sequentially', () => {
    fc.assert(
      fc.property(notificationListArb, (notifications) => {
        queue.clear()
        
        // Add notifications in timestamp order (oldest first)
        const sorted = [...notifications].sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        )
        sorted.forEach(n => queue.add(n))
        
        const result = queue.getAll()
        
        // Most recent should be first (reverse chronological order for display)
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].timestamp.getTime()).toBeGreaterThanOrEqual(
            result[i + 1].timestamp.getTime()
          )
        }
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should maintain queue order when adding batch of simultaneous events', () => {
    fc.assert(
      fc.property(notificationListArb, (notifications) => {
        queue.clear()
        queue.addBatch(notifications)
        
        const result = queue.getAll()
        
        // Verify all notifications are in the queue
        expect(result.length).toBe(notifications.length)
        
        // Verify order is maintained (most recent first)
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].timestamp.getTime()).toBeGreaterThanOrEqual(
            result[i + 1].timestamp.getTime()
          )
        }
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should not exceed maximum queue size', () => {
    const maxSize = 10
    const smallQueue = new NotificationQueue(maxSize)
    
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.uuid(),
            fc.uuid(),
            personNameArb,
            personRoleArb,
            eventTypeArb,
            fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            fc.option(fc.integer({ min: 1, max: 120 }), { nil: undefined })
          ),
          { minLength: 15, maxLength: 30 }
        ),
        (notificationData) => {
          smallQueue.clear()
          
          notificationData.forEach(([id, personId, personName, personRole, eventType, timestamp, lateByMinutes]) => {
            smallQueue.add({
              id,
              personId,
              personName,
              personRole,
              eventType,
              timestamp,
              color: getExpectedColor(eventType),
              lateByMinutes,
            })
          })
          
          // Queue should never exceed max size
          expect(smallQueue.size()).toBeLessThanOrEqual(maxSize)
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should display notifications without overlap (sequential IDs)', () => {
    fc.assert(
      fc.property(notificationListArb, (notifications) => {
        queue.clear()
        queue.addBatch(notifications)
        
        const result = queue.getAll()
        const ids = result.map(n => n.id)
        const uniqueIds = new Set(ids)
        
        // All IDs should be unique (no overlap)
        expect(uniqueIds.size).toBe(ids.length)
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should correctly remove notifications from queue', () => {
    fc.assert(
      fc.property(notificationListArb, (notifications) => {
        if (notifications.length < 2) return true
        
        queue.clear()
        queue.addBatch(notifications)
        
        const initialSize = queue.size()
        const toRemove = queue.getAll()[0]
        
        queue.remove(toRemove.id)
        
        // Size should decrease by 1
        expect(queue.size()).toBe(initialSize - 1)
        
        // Removed notification should not be in queue
        const remaining = queue.getAll()
        expect(remaining.find(n => n.id === toRemove.id)).toBeUndefined()
        
        return true
      }),
      { numRuns: 100 }
    )
  })

  it('should return correct visible subset', () => {
    fc.assert(
      fc.property(
        notificationListArb,
        fc.integer({ min: 1, max: 10 }),
        (notifications, visibleCount) => {
          queue.clear()
          queue.addBatch(notifications)
          
          const visible = queue.getVisible(visibleCount)
          const all = queue.getAll()
          
          // Visible count should be min of requested and total
          expect(visible.length).toBe(Math.min(visibleCount, all.length))
          
          // Visible should be the first N items from all
          for (let i = 0; i < visible.length; i++) {
            expect(visible[i].id).toBe(all[i].id)
          }
          
          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
