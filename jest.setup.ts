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

// Teardown hook to prevent open handles (e.g. Prisma and Redis clients)
afterAll(async () => {
  try {
    const prismaModule = await import('@/app/lib/prisma')
    if (prismaModule && prismaModule.prisma && typeof prismaModule.prisma.$disconnect === 'function') {
      await prismaModule.prisma.$disconnect()
    }
    
    const { disconnectRedis } = await import('@/app/lib/redis')
    await disconnectRedis()
  } catch (err) {
    console.error('Failed to disconnect services in test teardown:', err)
  }
})
