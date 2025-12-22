import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

// Prevent multiple instances of Prisma Client in development
export const prisma = global.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma

/**
 * Middleware to automatically filter soft-deleted records
 * Ensures queries exclude records where deletedAt IS NOT NULL
 */
prisma.$use(async (params, next) => {
  // Only apply to User model
  if (params.model === 'User') {
    if (params.action === 'findUnique' || params.action === 'findUniqueOrThrow') {
      // Add deletedAt filter to where clause
      params.args.where = { ...params.args.where, deletedAt: null }
    }
    if (params.action === 'findMany') {
      // Filter out soft-deleted records
      if (params.args.where) {
        params.args.where = {
          AND: [params.args.where, { deletedAt: null }],
        }
      } else {
        params.args.where = { deletedAt: null }
      }
    }
    if (params.action === 'update') {
      // Prevent updating deleted records
      params.args.where = { ...params.args.where, deletedAt: null }
    }
    if (params.action === 'delete') {
      // Soft-delete instead of hard-delete
      params.action = 'update'
      params.args.data = { deletedAt: new Date() }
    }
    if (params.action === 'deleteMany') {
      // Soft-delete instead of hard-delete
      params.action = 'updateMany'
      params.args.data = { deletedAt: new Date() }
    }
  }
  
  return next(params)
})
