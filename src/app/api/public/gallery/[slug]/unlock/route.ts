import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signGalleryToken } from "@/lib/auth";
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from "@/lib/rateLimit";
import { hashIp } from "@/lib/utils";
import { findGalleryBySlug } from "@/lib/galleryResolver";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const ip = request.headers.get("x-forwarded-for") || "guest-ip";
    const userAgent = request.headers.get("user-agent") || undefined;
    const ipHash = hashIp(ip);
    const rateLimitKey = `gallery:${slug}:${ipHash}`;

    // 1. Check rate limit
    const limitStatus = await checkRateLimit(rateLimitKey);
    if (!limitStatus.allowed) {
      return NextResponse.json(
        { error: limitStatus.message || "Too many attempts. Gallery access temporarily locked." },
        { status: 429 }
      );
    }

    const gallery = await findGalleryBySlug(slug);

    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    // 2. Check status
    if (gallery.status === "DISABLED") {
      return NextResponse.json(
        { error: "This gallery has been disabled by the photographer. Please contact the studio." },
        { status: 403 }
      );
    }

    if (gallery.expiresAt && gallery.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This gallery has expired. Please contact the photographer to request an extension." },
        { status: 410 }
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    // 3. Verify password
    const isMatch = await verifyPassword(password, gallery.passwordHash);

    if (!isMatch) {
      const fail = await recordFailedAttempt(rateLimitKey);

      await prisma.accessLog.create({
        data: {
          galleryId: gallery.id,
          ipHash,
          userAgent,
          status: "FAILED_PASSWORD",
        },
      }).catch(() => {});

      return NextResponse.json(
        { error: fail.message || "Incorrect password. Please try again." },
        { status: 401 }
      );
    }

    // 4. Success: reset rate limit & log access
    await resetRateLimit(rateLimitKey);

    await prisma.accessLog.create({
      data: {
        galleryId: gallery.id,
        ipHash,
        userAgent,
        status: "SUCCESS",
      },
    }).catch(() => {});

    // Increment views count
    await prisma.gallery.update({
      where: { id: gallery.id },
      data: { viewsCount: { increment: 1 } },
    });

    // 5. Generate signed guest JWT token
    const token = signGalleryToken({
      galleryId: gallery.id,
      slug: gallery.slug,
      unlockedAt: Date.now(),
    });

    const response = NextResponse.json({
      success: true,
      message: "Gallery unlocked successfully.",
    });

    const isSecure =
      process.env.NODE_ENV === "production" &&
      !process.env.NEXT_PUBLIC_APP_URL?.includes("localhost");

    // Set HTTP-Only guest session cookie for this gallery
    response.cookies.set({
      name: `g_session_${gallery.id}`,
      value: token,
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Unlock gallery error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while unlocking the gallery." },
      { status: 500 }
    );
  }
}
