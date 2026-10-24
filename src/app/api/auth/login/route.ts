import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signOwnerToken, OWNER_COOKIE_NAME } from "@/lib/auth";
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from "@/lib/rateLimit";
import { hashIp } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "local-ip";
    const rateLimitKey = `login:${hashIp(ip)}`;

    const limitStatus = await checkRateLimit(rateLimitKey);
    if (!limitStatus.allowed) {
      return NextResponse.json(
        { error: limitStatus.message || "Too many failed attempts. Try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const owner = await prisma.owner.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!owner) {
      await recordFailedAttempt(rateLimitKey);
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, owner.passwordHash);
    if (!isMatch) {
      const fail = await recordFailedAttempt(rateLimitKey);
      return NextResponse.json(
        { error: fail.message || "Invalid email or password." },
        { status: 401 }
      );
    }

    // Reset rate limit on success
    await resetRateLimit(rateLimitKey);

    const token = signOwnerToken({
      ownerId: owner.id,
      email: owner.email,
      role: "OWNER",
    });

    const response = NextResponse.json({
      success: true,
      owner: {
        id: owner.id,
        email: owner.email,
        name: owner.name,
        studioName: owner.studioName,
      },
    });

    const isSecure =
      process.env.NODE_ENV === "production" &&
      !process.env.NEXT_PUBLIC_APP_URL?.includes("localhost");

    response.cookies.set({
      name: OWNER_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during login." },
      { status: 500 }
    );
  }
}
