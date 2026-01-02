import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/login', '/signup', '/unlock', '/forgot-password', '/reset-password', '/verify-email']

export function middleware(req: NextRequest) {
  let { pathname } = req.nextUrl

  // Normalize path: lowercase, remove trailing slashes (except root), collapse duplicate slashes
  pathname = pathname.toLowerCase().replace(/\/+/g, '/').replace(/\/$/, '') || '/'

  // Allow public routes (with normalized comparison)
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const hasSession = !!req.cookies.get('sessionId')

  if (!hasSession) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|site.webmanifest|assets|.*\\.wasm$).*)',
  ],
}