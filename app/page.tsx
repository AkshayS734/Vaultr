import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="px-4 lg:px-6 h-14 flex items-center bg-white dark:bg-black shadow-sm">
        <Link href="#" className="flex items-center justify-center">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">Vaultr</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link href="/login" className="text-sm font-medium text-white bg-blue-600 px-4 py-2 rounded-md hover:bg-blue-700">
            Login
          </Link>
          <Link href="/signup" className="text-sm font-medium text-white bg-blue-600 px-4 py-2 rounded-md hover:bg-blue-700">
            Sign Up
          </Link>
        </nav>
      </header>
      <main className="flex-1">
        <section className="flex items-center justify-center w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-white dark:bg-black text-center">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none text-gray-900 dark:text-white">
                Secure Your Digital Life with Vaultr
              </h1>
              <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                The simple, secure way to manage your passwords. Get started for free and never forget a password again.
              </p>
              <div className="space-x-4">
                <Link
                  href="/signup"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="flex items-center justify-center w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-black text-center">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-gray-200 px-3 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-gray-50">Key Features</div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-gray-900 dark:text-white">Everything You Need, Nothing You Don&apos;t</h2>
                <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                  Vaultr is packed with features to make your digital life easier and more secure.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3 lg:gap-12 text-center">
              <div className="grid gap-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Secure Password Storage</h3>
                <p className="text-gray-500 dark:text-gray-400 ">Store all your passwords in one secure place with AES-256 encryption.</p>
              </div>
              <div className="grid gap-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Cross-Platform Sync</h3>
                <p className="text-gray-500 dark:text-gray-400">Access your passwords from anywhere with our web and mobile apps.</p>
              </div>
              <div className="grid gap-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Password Generator</h3>
                <p className="text-gray-500 dark:text-gray-400">Create strong, unique passwords for every account.</p>
              </div>
            </div>
          </div>
        </section>
        <section className="flex items-center justify-center w-full py-12 md:py-24 lg:py-32 bg-white dark:bg-black">
          <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight text-gray-900 dark:text-white">
                Ready to take control of your passwords?
              </h2>
              <p className="mx-auto max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                Join Vaultr today and experience the peace of mind that comes with knowing your digital life is secure.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row justify-center">
              <Link
                href="/signup"
                className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-8 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700"
              >
                Sign Up for Free
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex items-center justify-center py-6 bg-gray-100 dark:bg-black">
        <p className="text-sm text-gray-500 dark:text-gray-400">© 2025 Vaultr. All rights reserved.</p>
      </footer>
    </div>
  );
}