import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const ownerCount = await prisma.owner.count();
    if (ownerCount === 0) {
      return NextResponse.json({
        needsSetup: true,
        authenticated: false,
        owner: null,
      });
    }

    const session = await getOwnerSession();
    if (!session) {
      return NextResponse.json({
        needsSetup: false,
        authenticated: false,
        owner: null,
      });
    }

    const fullOwner = await prisma.owner.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        name: true,
        studioName: true,
        tagline: true,
        bio: true,
        contactEmail: true,
        contactPhone: true,
        websiteUrl: true,
        instagram: true,
        storageLimitBytes: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      needsSetup: false,
      authenticated: true,
      owner: fullOwner ? {
        ...fullOwner,
        storageLimitBytes: fullOwner.storageLimitBytes.toString(),
      } : null,
    });
  } catch (error: any) {
    console.error("Auth check error:", error);
    return NextResponse.json(
      { error: "Failed to verify session." },
      { status: 500 }
    );
  }
}
