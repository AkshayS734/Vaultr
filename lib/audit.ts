import { prisma } from './prisma'
import { truncate } from './utils'
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
      const safeMeta = (() => {
        if (!meta || typeof meta !== 'object') return meta
        const m = meta as Record<string, unknown>
        const ua = typeof m.userAgent === 'string' ? truncate(m.userAgent, 256) : undefined
        const ip = typeof m.ip === 'string' ? truncate(m.ip, 64) : undefined
        return {
          ...m,
          ...(ua ? { userAgent: ua } : {}),
          ...(ip ? { ip } : {}),
        } as Prisma.JsonObject
      })()
    
    await prisma.auditLog.create({
      data: {
        userId,
        eventType,
          meta: safeMeta,
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
