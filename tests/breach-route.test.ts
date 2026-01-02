/**
 * Unit tests for /api/breach HIBP k-anonymity proxy route
 */
import { GET } from '@/app/api/breach/route'

const ORIG_ENV = { ...process.env }

describe('/api/breach HIBP route', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.resetModules()
    fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true })
    process.env = { ...ORIG_ENV }
  })

  afterAll(() => {
    process.env = ORIG_ENV
    Object.defineProperty(globalThis, 'fetch', { value: undefined, configurable: true })
  })

  function makeReq(url: string): Request {
    return new Request(url)
  }

  it('accepts exactly 5 hex chars and forwards to HIBP-style endpoint', async () => {
    process.env.BREACH_UPSTREAM_URL = 'https://api.pwnedpasswords.com/range'

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      // Assert HIBP URL format: /range/{PREFIX}
      const forwarded = String(input)
      expect(forwarded).toBe('https://api.pwnedpasswords.com/range/ABCDE')

      // Mock HIBP text response
      return new Response(
        '00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2\n' +
        '011053FD0102E94D6AE2F8B83D76FAF94F6:1\n' +
        '012A7CA357541F0AC487871FEEC1891C49C:3',
        {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        }
      )
    })

    const res = await GET(makeReq('http://localhost/api/breach?prefix=AbCdE'))
    const body = await (res as Response).text()
    expect(typeof body).toBe('string')
    expect(body).toContain('00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects wrong length or non-hex prefixes and returns 400', async () => {
    process.env.BREACH_UPSTREAM_URL = 'https://api.pwnedpasswords.com/range'
    
    // Too short
    let res = await GET(makeReq('http://localhost/api/breach?prefix=abcd'))
    expect((res as Response).status).toBe(400)

    // Too long
    res = await GET(makeReq('http://localhost/api/breach?prefix=abcdef'))
    expect((res as Response).status).toBe(400)

    // Non-hex
    res = await GET(makeReq('http://localhost/api/breach?prefix=ghijk'))
    expect((res as Response).status).toBe(400)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards only prefix in URL path (not query params)', async () => {
    process.env.BREACH_UPSTREAM_URL = 'https://api.pwnedpasswords.com/range'
    fetchMock.mockResolvedValue(
      new Response('SUFFIX1:10\nSUFFIX2:5', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    )

    await GET(makeReq('http://localhost/api/breach?prefix=123AB'))

    const calledUrl = String(fetchMock.mock.calls[0][0])
    expect(calledUrl).toBe('https://api.pwnedpasswords.com/range/123AB')
  })

  it('fails open (returns empty string) when no upstream is configured', async () => {
    delete process.env.BREACH_UPSTREAM_URL
    const res = await GET(makeReq('http://localhost/api/breach?prefix=FFFFF'))
    const body = await (res as Response).text()
    expect(body).toBe('')
    expect((res as Response).status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails open (returns empty string) on upstream/network errors', async () => {
    process.env.BREACH_UPSTREAM_URL = 'https://api.pwnedpasswords.com/range'
    
    // Network error
    fetchMock.mockRejectedValueOnce(new Error('net down'))
    let res = await GET(makeReq('http://localhost/api/breach?prefix=AAAAA'))
    let body = await (res as Response).text()
    expect(body).toBe('')
    expect((res as Response).status).toBe(200)

    // Non-200
    fetchMock.mockResolvedValueOnce(new Response('error', { status: 500 }))
    res = await GET(makeReq('http://localhost/api/breach?prefix=BBBBB'))
    body = await (res as Response).text()
    expect(body).toBe('')
    expect((res as Response).status).toBe(200)
  })

  it('includes Add-Padding header in upstream request', async () => {
    process.env.BREACH_UPSTREAM_URL = 'https://api.pwnedpasswords.com/range'
    fetchMock.mockResolvedValue(
      new Response('TEST:1', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    )

    await GET(makeReq('http://localhost/api/breach?prefix=AAAAA'))

    const callOptions = fetchMock.mock.calls[0][1] as RequestInit
    expect(callOptions.headers).toEqual(
      expect.objectContaining({
        'Add-Padding': 'true'
      })
    )
  })
})
