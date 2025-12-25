/**
 * Authentication utilities for verifying user sessions and email verification status
 */

import jwt from 'jsonwebtoken'
import { NextResponse } from 'next/server'
import { prisma } from './prisma'
import cookie from 'cookie'

interface JWTPayload {
  sub: string // user ID
  email: string
  iat?: number
  exp?: number
}

/**
 * Verify JWT token and return decoded payload
 * Returns null if token is invalid or expired
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured')
      return null
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload
    return decoded
  } catch (err) {
    console.error('JWT verification failed:', err)
    return null
  }
}

/**
 * Extract and verify access token from Authorization header
 * Returns user payload or null
 */
export function getTokenFromRequest(req: Request): JWTPayload | null {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix
  return verifyAccessToken(token)
}

/**
 * Get session from cookie and verify it's valid
 * Returns userId if valid, null otherwise
 */
export async function getSessionFromCookie(req: Request): Promise<string | null> {
  try {
    const cookieHeader = req.headers.get('cookie') || ''
    const cookies = cookie.parse(cookieHeader)
    const sessionId = cookies.sessionId

    if (!sessionId) {
      return null
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true, expiresAt: true },
    })

    if (!session || session.expiresAt < new Date()) {
      return null
    }

    return session.userId
  } catch (err) {
    console.error('Session verification failed:', err)
    return null
  }
}

/**
 * Verify that the user's email is verified
 * Call this in protected routes that require email verification
 * 
 * @param userId - User ID from JWT
 * @returns Object with verified status and user data
 */
export async function checkEmailVerification(userId: string): Promise<{
  verified: boolean
  user: { id: string; email: string; isEmailVerified: boolean } | null
}> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isEmailVerified: true, deletedAt: true },
    })

    if (!user || user.deletedAt) {
      return { verified: false, user: null }
    }

    return {
      verified: user.isEmailVerified,
      user: {
        id: user.id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    }
  } catch (err) {
    console.error('Email verification check failed:', err)
    return { verified: false, user: null }
  }
}

/**
 * Middleware-like utility to verify authentication and email verification
 * Use this at the start of protected API routes
 * Supports both JWT (Bearer token) and cookie-based sessions
 * 
 * @param req - Request object
 * @param requireVerification - Whether to require email verification (default: true)
 * @returns Object with user data or error response
 */
export async function requireAuth(
  req: Request,
  requireVerification = true
): Promise<
  | { success: true; user: { id: string; email: string; isEmailVerified: boolean } }
  | { success: false; response: NextResponse }
> {
  let userId: string | null = null

  // Try JWT first
  const tokenPayload = getTokenFromRequest(req)
  if (tokenPayload) {
    userId = tokenPayload.sub
  } else {
    // Fall back to session cookie
    userId = await getSessionFromCookie(req)
  }

  if (!userId) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      ),
    }
  }

  // Check email verification if required
  if (requireVerification) {
    const { verified, user } = await checkEmailVerification(userId)
    
    if (!user) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'User not found.' },
          { status: 404 }
        ),
      }
    }

    if (!verified) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Please verify your email address to access this resource.',
            code: 'EMAIL_NOT_VERIFIED',
          },
          { status: 403 }
        ),
      }
    }

    return { success: true, user }
  }

  // If verification not required, just check user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, isEmailVerified: true, deletedAt: true },
  })

  if (!user || user.deletedAt) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'User not found.' },
        { status: 404 }
      ),
    }
  }

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
    },
  }
}

/**
 * Example usage in an API route:
 * 
 * export async function GET(req: Request) {
 *   const auth = await requireAuth(req)
 *   if (!auth.success) {
 *     return auth.response
 *   }
 * 
 *   const { user } = auth
 *   // ... proceed with authenticated user
 * }
 */
