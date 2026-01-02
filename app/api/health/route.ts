import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { checkRedisHealth } from '@/app/lib/redis'

async function checkDatabase(): Promise<'ok' | 'error'> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'ok';
  } catch (err) {
    console.error('[HEALTH][DB]', err instanceof Error ? err.message : String(err));
    return 'error';
  }
}

function checkEmailConfig(): 'ok' | 'not_configured' {
  const useSmtp = process.env.EMAIL_MODE === 'smtp'
  if (!useSmtp) return 'not_configured'
  if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return 'ok'
  }
  return 'not_configured'
}

export async function GET() {
  const timestamp = Date.now()

  const [dbStatus, redisStatus] = await Promise.all([
    checkDatabase(),
    checkRedisHealth(),
  ])

  const emailStatus = checkEmailConfig()

  const checks = {
    database: dbStatus,
    redis: redisStatus,
    email: emailStatus,
  }

  const allHealthy = dbStatus === 'ok' && (redisStatus === 'ok' || redisStatus === 'not_configured')
  const statusText = allHealthy ? 'healthy' : 'degraded'
  const httpStatus = allHealthy ? 200 : 503

  return NextResponse.json(
    {
      status: statusText,
      timestamp,
      checks,
    },
    {
      status: httpStatus,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    }
  )
}
