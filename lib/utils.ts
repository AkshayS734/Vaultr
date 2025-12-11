/**
 * Utility functions for authentication and security
 */

/**
 * Get client IP address from request
 * Respects X-Forwarded-For header but validates it properly
 * @param req - Next.js Request object
 * @returns IP address string or null
 */
export function getClientIp(req: Request): string | null {
  // Try x-forwarded-for first (comma-separated list of IPs)
  const xForwardedFor = req.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    // Take only the first IP (the original client)
    const ips = xForwardedFor.split(',').map((ip) => ip.trim())
    const ip = ips[0]
    if (isValidIp(ip)) {
      return ip
    }
  }

  // Fallback to cf-connecting-ip (Cloudflare)
  const cfConnecting = req.headers.get('cf-connecting-ip')
  if (cfConnecting && isValidIp(cfConnecting)) {
    return cfConnecting
  }

  return null
}

/**
 * Validate if a string is a valid IPv4 or IPv6 address
 * @param ip - IP address string
 * @returns true if valid IP
 */
export function isValidIp(ip: string): boolean {
  // IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map((p) => parseInt(p, 10))
    return parts.every((p) => p >= 0 && p <= 255)
  }

  // IPv6 (simplified)
  const ipv6Regex = /^([\da-fA-F]{0,4}:){2,7}[\da-fA-F]{0,4}$/
  return ipv6Regex.test(ip)
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string | null | undefined, maxLength: number): string | null {
  if (!str) return null
  if (str.length > maxLength) {
    return str.substring(0, maxLength)
  }
  return str
}

/**
 * Validate email format
 */
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false
  // RFC 5322 simplified regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) return false
  // Additional checks
  if (email.length > 254) return false
  const [localPart] = email.split('@')
  if (localPart.length > 64) return false
  return true
}
