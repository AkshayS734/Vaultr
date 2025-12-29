/**
 * Password reuse detection tests
 */

import { checkPasswordReuse, storePasswordInHistory, cleanupPasswordHistory } from '../app/lib/password-reuse'
import { prisma } from '../app/lib/prisma'
import argon2 from 'argon2'

jest.mock('../app/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    passwordHistory: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    }
  }
}))

jest.mock('argon2')

describe('Password Reuse Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('checkPasswordReuse', () => {
    it('should return empty result for new user', async () => {
      // Mock user not found
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await checkPasswordReuse('user123', 'newPassword123!')
      
      expect(result).toEqual({})
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user123' },
        select: { authHash: true }
      })
    })

    it('should detect current password reuse', async () => {
      const mockUser = { authHash: 'currentHash' }
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(argon2.verify as jest.Mock).mockResolvedValue(true)

      const result = await checkPasswordReuse('user123', 'currentPassword123!')
      
      expect(result).toEqual({
        warning: 'You are currently using this password',
        recommendation: 'Choose a different password to improve account security.'
      })
      expect(argon2.verify).toHaveBeenCalledWith('currentHash', 'currentPassword123!')
    })

    it('should detect historical password reuse', async () => {
      const mockUser = { authHash: 'currentHash' }
      const mockHistory = [
        { passwordHash: 'oldHash1', createdAt: new Date('2023-01-01') },
        { passwordHash: 'oldHash2', createdAt: new Date('2023-02-01') }
      ]
      
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(argon2.verify as jest.Mock)
        .mockResolvedValueOnce(false) // Not current password
        .mockResolvedValueOnce(true)  // Found in history
      
      ;(prisma.passwordHistory.findMany as jest.Mock).mockResolvedValue(mockHistory)

      const result = await checkPasswordReuse('user123', 'oldPassword123!')
      
      expect(result).toEqual({
        warning: 'You have used this password before',
        recommendation: 'Reusing passwords increases security risk. Consider choosing a unique password.'
      })
      expect(prisma.passwordHistory.findMany).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { passwordHash: true, createdAt: true }
      })
    })

    it('should return empty result for new password', async () => {
      const mockUser = { authHash: 'currentHash' }
      const mockHistory = [
        { passwordHash: 'oldHash1', createdAt: new Date('2023-01-01') }
      ]
      
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(argon2.verify as jest.Mock).mockResolvedValue(false) // Never matches
      ;(prisma.passwordHistory.findMany as jest.Mock).mockResolvedValue(mockHistory)

      const result = await checkPasswordReuse('user123', 'brandNewPassword123!')
      
      expect(result).toEqual({})
    })

    it('should handle errors gracefully', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'))

      const result = await checkPasswordReuse('user123', 'password123!')
      
      expect(result).toEqual({})
    })
  })

  describe('storePasswordInHistory', () => {
    it('should store password hash and cleanup', async () => {
      ;(prisma.passwordHistory.create as jest.Mock).mockResolvedValue({ id: 'history1' })
      ;(prisma.passwordHistory.findMany as jest.Mock).mockResolvedValue([
        { id: '1' },
        { id: '2' },
        { id: '3' },
        { id: '4' },
        { id: '5' },
        { id: '6' }, // This one should be deleted
      ])
      ;(prisma.passwordHistory.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })

      await storePasswordInHistory('user123', 'oldPasswordHash')

      expect(prisma.passwordHistory.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          passwordHash: 'oldPasswordHash',
        }
      })
      expect(prisma.passwordHistory.findMany).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
      })
      expect(prisma.passwordHistory.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['6'] } }
      })
    })

    it('should handle errors gracefully', async () => {
      ;(prisma.passwordHistory.create as jest.Mock).mockRejectedValue(new Error('Database error'))

      // Should not throw
      await expect(storePasswordInHistory('user123', 'oldPasswordHash')).resolves.not.toThrow()
    })
  })

  describe('cleanupPasswordHistory', () => {
    it('should delete oldest entries when limit exceeded', async () => {
      const mockEntries = Array.from({ length: 7 }, (_, i) => ({ id: `id${i + 1}` }))
      
      ;(prisma.passwordHistory.findMany as jest.Mock).mockResolvedValue(mockEntries)
      ;(prisma.passwordHistory.deleteMany as jest.Mock).mockResolvedValue({ count: 2 })

      await cleanupPasswordHistory('user123')

      expect(prisma.passwordHistory.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['id6', 'id7'] } }
      })
    })

    it('should not delete when within limit', async () => {
      const mockEntries = Array.from({ length: 3 }, (_, i) => ({ id: `id${i + 1}` }))
      
      ;(prisma.passwordHistory.findMany as jest.Mock).mockResolvedValue(mockEntries)

      await cleanupPasswordHistory('user123')

      expect(prisma.passwordHistory.deleteMany).not.toHaveBeenCalled()
    })
  })
})