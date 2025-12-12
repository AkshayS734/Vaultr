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

// Read and parse JSON from Request with a byte-size limit
export async function readLimitedJson<T = unknown>(
  request: Request,
  maxBytes: number
): Promise<T> {
  const lenHeader = request.headers.get("content-length");
  if (lenHeader) {
    const contentLength = parseInt(lenHeader, 10);
    if (!Number.isNaN(contentLength) && contentLength > maxBytes) {
      throw new Error("PAYLOAD_TOO_LARGE");
    }
  }
  const text = await request.text();
  const byteLength = Buffer.byteLength(text, "utf8");
  if (byteLength > maxBytes) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }
  return JSON.parse(text) as T;
}

/**
 * Validate email format and length
 * RFC 5322 compliant with additional checks
 */
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false
  
  // Length checks (RFC 5322)
  if (email.length < 3 || email.length > 254) return false
  
  const parts = email.split('@')
  if (parts.length !== 2) return false
  
  const [localPart, domain] = parts
  
  // Local part validation
  if (localPart.length < 1 || localPart.length > 64) return false
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false
  if (localPart.includes('..')) return false
  
  // Domain validation
  if (domain.length < 3 || domain.length > 255) return false
  if (!domain.includes('.')) return false
  if (domain.startsWith('.') || domain.endsWith('.')) return false
  if (domain.startsWith('-') || domain.endsWith('-')) return false
  
  // Check for valid characters
  const validEmailRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  
  return validEmailRegex.test(email)
}

/**
 * Validate password strength and length
 */
export function isValidPassword(password: unknown): { valid: boolean; reason?: string } {
  if (typeof password !== 'string') {
    return { valid: false, reason: 'Password must be a string' }
  }
  
  if (password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters' }
  }
  
  if (password.length > 128) {
    return { valid: false, reason: 'Password must be at most 128 characters' }
  }
  
  // Check for at least one uppercase, one lowercase, one number
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one uppercase letter' }
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one lowercase letter' }
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one number' }
  }
  
  return { valid: true }
}
