import { NextResponse } from "next/server";
import { getOwnerSession, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    const session = await getOwnerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      studioName,
      tagline,
      bio,
      contactEmail,
      contactPhone,
      websiteUrl,
      instagram,
      currentPassword,
      newPassword,
    } = body;

    const owner = await prisma.owner.findUnique({
      where: { id: session.id },
    });

    if (!owner) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 });
    }

    let passwordHash = owner.passwordHash;

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to set a new password." },
          { status: 400 }
        );
      }
      const isMatch = await verifyPassword(currentPassword, owner.passwordHash);
      if (!isMatch) {
        return NextResponse.json(
          { error: "Incorrect current password." },
          { status: 400 }
        );
      }
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters long." },
          { status: 400 }
        );
      }
      passwordHash = await hashPassword(newPassword);
    }

    const updated = await prisma.owner.update({
      where: { id: session.id },
      data: {
        name: name !== undefined ? name.trim() : owner.name,
        studioName: studioName !== undefined ? studioName.trim() : owner.studioName,
        tagline: tagline !== undefined ? tagline.trim() : owner.tagline,
        bio: bio !== undefined ? bio : owner.bio,
        contactEmail: contactEmail !== undefined ? contactEmail : owner.contactEmail,
        contactPhone: contactPhone !== undefined ? contactPhone : owner.contactPhone,
        websiteUrl: websiteUrl !== undefined ? websiteUrl : owner.websiteUrl,
        instagram: instagram !== undefined ? instagram : owner.instagram,
        passwordHash,
      },
    });

    return NextResponse.json({
      success: true,
      owner: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        studioName: updated.studioName,
        tagline: updated.tagline,
        bio: updated.bio,
        contactEmail: updated.contactEmail,
        contactPhone: updated.contactPhone,
        websiteUrl: updated.websiteUrl,
        instagram: updated.instagram,
      },
    });
  } catch (error: any) {
    console.error("Owner update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile settings." },
      { status: 500 }
    );
  }
}
