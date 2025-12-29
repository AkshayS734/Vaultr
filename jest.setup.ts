/**
 * Jest setup file for crypto operations.
 * Provides necessary polyfills for test environment.
 */

// Use dynamic imports for Node.js utilities
async function setupPolyfills() {
  // Polyfill TextEncoder/TextDecoder for jsdom environment
  if (typeof global.TextEncoder === 'undefined') {
    const { TextEncoder, TextDecoder } = await import('util')
    global.TextEncoder = TextEncoder as unknown as typeof globalThis.TextEncoder
    global.TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder
  }

  // Ensure crypto API is available
  if (!global.crypto) {
    const { webcrypto } = await import('crypto')
    global.crypto = webcrypto as unknown as Crypto
  }
}

// Execute setup
setupPolyfills().catch((err) => {
  console.error('Failed to setup polyfills:', err)
})

