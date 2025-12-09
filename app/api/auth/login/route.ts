import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password } = body || {}

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Basic validation
    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password too short' }, { status: 400 })
    }

    // TODO: Replace this demo logic with real authentication (database, hashing, tokens)
    // For demo purposes we accept any valid input and return a success payload.
    return NextResponse.json({ message: 'Signed in', user: { email } }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
}

export function GET() {
  return NextResponse.json({ message: 'Auth login endpoint' })
}
