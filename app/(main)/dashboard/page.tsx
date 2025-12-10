import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <nav className="space-x-3">
            <Link href="/" className="text-sm text-gray-600 dark:text-gray-300 hover:underline">Home</Link>
            <Link href="/logout" className="text-sm text-red-600 hover:underline">Logout</Link>
          </nav>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Vaults</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Create and manage your encrypted vaults.</p>
            <div className="mt-4">
              <Link href="/vaults/new" className="inline-block rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">New Vault</Link>
            </div>
          </div>

          <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">View recent logins and changes to your vaults.</p>
          </div>

          <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Account</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Manage your account settings, security, and keys.</p>
          </div>
        </section>
      </div>
    </div>
  )
}
