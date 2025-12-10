// app/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// In dev: reuse global to avoid too many clients during HMR
export const prisma =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "info", "warn"] : [],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}