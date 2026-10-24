import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signOwnerToken, OWNER_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const existingCount = await prisma.owner.count();
    if (existingCount > 0) {
      return NextResponse.json(
        { error: "Owner account is already configured. Public registration is closed." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, password, name, studioName, tagline } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const owner = await prisma.owner.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        name: name.trim(),
        studioName: studioName?.trim() || "Lumière Fine Art Photography",
        tagline: tagline?.trim() || "Capturing Timeless Moments into Eternal Art",
      },
    });

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
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to complete owner setup." },
      { status: 500 }
    );
  }
}
