import { prisma } from './prisma'
import { truncate } from './utils'
import { AuditEvent, Prisma } from '@prisma/client'
import crypto from 'crypto'

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
 * Item 4.7: Generate HMAC-SHA256 signature for audit log immutability
 * Signature is computed over: eventType + userId + meta + createdAt
 * Uses JWT_SECRET as the HMAC key (must be >= 32 bytes)
 */
function generateAuditSignature(
  eventType: string,
  userId: string | null,
  meta: Prisma.JsonObject | undefined,
  createdAt: Date
): string {
  const secret = process.env.JWT_SECRET || ''
  if (!secret || secret.length < 32) {
    console.warn('[AUDIT_SECURITY] JWT_SECRET too weak for audit signatures')
    return ''
  }

  const payload = JSON.stringify({
    eventType,
    userId,
    meta,
    createdAt: createdAt.toISOString(),
  })

  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Log an audit event with immutability signature
 * Non-blocking - errors are logged but don't affect operation
 * Item 4.7: Includes HMAC signature to detect tampering
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

      // Item 4.7: Generate signature before storing
      const createdAt = new Date()
      const signature = generateAuditSignature(eventType, userId, safeMeta, createdAt)
    
    await prisma.auditLog.create({
      data: {
        userId,
        eventType,
        meta: safeMeta,
        signature, // Store signature with audit log
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
/**
 * Item 4.7: Verify audit log integrity using stored signature
 * Detects if an audit entry has been tampered with
 * @returns true if signature is valid (not tampered), false if tampered or signature missing
 */
export function verifyAuditLogSignature(
  auditLog: {
    id: string
    eventType: AuditEvent
    userId: string | null
    meta: Prisma.JsonObject | null
    createdAt: Date
    signature: string | null
  }
): boolean {
  // If no signature stored, can't verify (warn)
  if (!auditLog.signature) {
    console.warn('[AUDIT_SECURITY] No signature on audit log', auditLog.id)
    return false
  }

  const expectedSignature = generateAuditSignature(
    auditLog.eventType,
    auditLog.userId,
    auditLog.meta ?? undefined,
    auditLog.createdAt
  )

  const matches = crypto.timingSafeEqual(
    Buffer.from(auditLog.signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )

  if (!matches) {
    console.warn('[AUDIT_SECURITY] Audit log signature mismatch (tampering detected)', auditLog.id)
  }

  return matches
}