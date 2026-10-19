import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient across hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

// SQLite has no native array column, so array fields are stored as JSON
// strings (see prisma/schema.prisma). These helpers keep that encoding out
// of the rest of the app.
export function toJson(value: unknown): string {
  return JSON.stringify(value ?? []);
}

export function fromJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
