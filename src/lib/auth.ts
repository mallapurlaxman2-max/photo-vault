import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_lumiere_secret_key_change_in_production";
const OWNER_COOKIE_NAME = "lumiere_owner_token";

export interface OwnerJwtPayload {
  ownerId: string;
  email: string;
  role: "OWNER";
}

export interface GalleryJwtPayload {
  galleryId: string;
  slug: string;
  unlockedAt: number;
}

// Password Hashing
export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainText, salt);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

// Owner JWT Tokens
export function signOwnerToken(payload: OwnerJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyOwnerToken(token: string): OwnerJwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as OwnerJwtPayload;
  } catch {
    return null;
  }
}

// Gallery Guest JWT Tokens
export function signGalleryToken(payload: GalleryJwtPayload): string {
  // Gallery session valid for 24 hours
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyGalleryToken(token: string, expectedGalleryId?: string): GalleryJwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as GalleryJwtPayload;
    if (expectedGalleryId && decoded.galleryId !== expectedGalleryId) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

// Get Authenticated Owner from request cookies
export async function getOwnerSession(): Promise<{ id: string; email: string; name: string; studioName: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(OWNER_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = verifyOwnerToken(token);
    if (!payload || payload.role !== "OWNER") return null;

    const owner = await prisma.owner.findUnique({
      where: { id: payload.ownerId },
      select: { id: true, email: true, name: true, studioName: true },
    });

    return owner;
  } catch {
    return null;
  }
}

// Helper to check if caller has valid guest unlock token for a specific gallery
export async function verifyGalleryGuestSession(galleryId: string): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const cookieName = `g_session_${galleryId}`;
    const token = cookieStore.get(cookieName)?.value;
    if (!token) return false;

    const payload = verifyGalleryToken(token, galleryId);
    return !!payload;
  } catch {
    return false;
  }
}

export { OWNER_COOKIE_NAME };
