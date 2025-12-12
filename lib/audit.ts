import { prisma } from './prisma'
import { AuditEvent, Prisma } from '@prisma/client'

export type AuditEventType = AuditEvent

export interface AuditLogMeta {
  ip?: string | null
  userAgent?: string | null
  email?: string
  sessionId?: string
  reason?: string
  targetUserId?: string
  [key: string]: string | null | undefined
}

/**
 * Log an audit event
 * Non-blocking - errors are logged but don't affect operation
 */
export async function logAuditEvent(
  eventType: AuditEventType,
  userId: string | null,
  meta?: AuditLogMeta
): Promise<void> {
  try {
    const metaData: Prisma.JsonValue = {}
    if (meta) {
      Object.entries(meta).forEach(([key, value]) => {
        if (value !== undefined) {
          (metaData as Record<string, unknown>)[key] = value
        }
      })
    }
    
    await prisma.auditLog.create({
      data: {
        userId,
        eventType,
        meta: metaData,
      },
    })
  } catch (error) {
    // Don't throw - just log to console
    console.error('Failed to create audit log:', error)
  }
}

/**
 * Get recent audit logs for a user
 */
export async function getUserAuditLogs(userId: string, limit: number = 50) {
  try {
    return await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  } catch (error) {
    console.error('Failed to fetch audit logs:', error)
    return []
  }
}

/**
 * Get recent login failures for a user (for suspicious activity detection)
 */
export async function getRecentLoginFailures(email: string, minutes: number = 30) {
  try {
    const since = new Date(Date.now() - minutes * 60 * 1000)
    return await prisma.auditLog.findMany({
      where: {
        eventType: 'LOGIN_FAILED',
        meta: {
          path: ['email'],
          equals: email,
        },
        createdAt: {
          gte: since,
        },
      },
    })
  } catch (error) {
    console.error('Failed to fetch login failures:', error)
    return []
  }
}
