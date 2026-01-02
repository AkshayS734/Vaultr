import { cookies } from 'next/headers'
import Link from 'next/link'
import { prisma } from '../../lib/prisma'

export default async function SessionsPage() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('sessionId')?.value
  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Not signed in</p>
          <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </div>
      </div>
    )
  }

  const session = await prisma.session.findUnique({ where: { id: sessionId }, select: { userId: true } })
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Session not found or expired</p>
          <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </div>
      </div>
    )
  }

  const userId = session.userId
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

type SessionItem = (typeof sessions)[number]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Active Sessions</h1>
          <Link href="/dashboard" className="text-sm text-gray-600 dark:text-gray-300 hover:underline">Back</Link>
        </header>

        <div className="space-y-4">
          {sessions.map((s : SessionItem) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 p-4 shadow">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">{s.userAgent ?? 'Unknown device'}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">IP: {s.ip ?? 'unknown'}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Created: {new Date(s.createdAt).toLocaleString()}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Last used: {s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString() : 'never'}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Expires: {new Date(s.expiresAt).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <button
                  data-session-id={s.id}
                  className="inline-flex items-center rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 revoke-session"
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
          document.querySelectorAll('.revoke-session').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const id = btn.getAttribute('data-session-id')
              const res = await fetch('/api/auth/session/' + id, { method: 'DELETE', credentials: 'include'})
              if (res.ok) {
                location.reload()
              } else {
                alert('Failed to revoke session')
              }
            })
          })
        ` }} />
      </div>
    </div>
  )
}
