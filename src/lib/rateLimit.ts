import { prisma } from "./prisma";

const MAX_ATTEMPTS = parseInt(process.env.MAX_PASSWORD_ATTEMPTS || "5", 10);
const LOCKOUT_MINUTES = parseInt(process.env.LOCKOUT_MINUTES || "15", 10);

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  lockedUntil?: Date | null;
  message?: string;
}

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const now = new Date();

  const record = await prisma.rateLimitRecord.findUnique({
    where: { key },
  });

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  // If locked, check if lockout duration has passed
  if (record.lockedUntil && record.lockedUntil > now) {
    const minutesLeft = Math.ceil((record.lockedUntil.getTime() - now.getTime()) / (1000 * 60));
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: record.lockedUntil,
      message: `Too many failed attempts. Access locked for ${minutesLeft} minute${minutesLeft > 1 ? "s" : ""}. Please try again later.`,
    };
  }

  // If lockout expired, reset
  if (record.lockedUntil && record.lockedUntil <= now) {
    await prisma.rateLimitRecord.deleteMany({ where: { key } });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - record.attempts);
  if (remaining <= 0) {
    // Lock it now
    const lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000);
    await prisma.rateLimitRecord.update({
      where: { key },
      data: { lockedUntil },
    });
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil,
      message: `Too many failed attempts. Access locked for ${LOCKOUT_MINUTES} minutes.`,
    };
  }

  return { allowed: true, remainingAttempts: remaining };
}

export async function recordFailedAttempt(key: string): Promise<RateLimitResult> {
  const now = new Date();

  const record = await prisma.rateLimitRecord.upsert({
    where: { key },
    create: {
      key,
      attempts: 1,
    },
    update: {
      attempts: { increment: 1 },
    },
  });

  if (record.attempts >= MAX_ATTEMPTS) {
    const lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000);
    await prisma.rateLimitRecord.update({
      where: { key },
      data: { lockedUntil },
    });
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil,
      message: `Too many failed attempts. Access locked for ${LOCKOUT_MINUTES} minutes.`,
    };
  }

  const remaining = MAX_ATTEMPTS - record.attempts;
  return {
    allowed: true,
    remainingAttempts: remaining,
    message: `Incorrect password. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before temporary lockout.`,
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimitRecord.deleteMany({ where: { key } });
}
