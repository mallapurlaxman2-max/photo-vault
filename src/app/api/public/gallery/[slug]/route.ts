import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyGalleryGuestSession, getOwnerSession } from "@/lib/auth";
import { findGalleryBySlug } from "@/lib/galleryResolver";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;

    const gallery = await findGalleryBySlug(slug, {
      include: {
        _count: { select: { photos: true } },
      },
    });

    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    const now = new Date();
    const isExpired = gallery.expiresAt ? gallery.expiresAt < now : false;
    const isDisabled = gallery.status === "DISABLED";

    const isOwner = Boolean(await getOwnerSession());
    const isUnlocked = isOwner || (await verifyGalleryGuestSession(gallery.id));

    // Get cover photo thumbnail URL safely
    let coverThumbnailUrl: string | null = null;
    if (gallery.coverPhotoId) {
      coverThumbnailUrl = `/api/public/gallery/${gallery.slug}/photo/${gallery.coverPhotoId}?type=thumbnail&publicCover=true`;
    } else {
      const firstPhoto = await prisma.photo.findFirst({
        where: { galleryId: gallery.id },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      if (firstPhoto) {
        coverThumbnailUrl = `/api/public/gallery/${gallery.slug}/photo/${firstPhoto.id}?type=thumbnail&publicCover=true`;
      }
    }

    // Owner profile for studio branding
    const owner = await prisma.owner.findFirst({
      select: {
        studioName: true,
        tagline: true,
        name: true,
        contactEmail: true,
        instagram: true,
      },
    });

    return NextResponse.json({
      gallery: {
        id: gallery.id,
        slug: gallery.slug,
        title: gallery.title,
        clientName: gallery.clientName,
        eventDate: gallery.eventDate,
        description: gallery.description,
        status: isExpired ? "EXPIRED" : gallery.status,
        expiresAt: gallery.expiresAt,
        photoCount: gallery._count.photos,
        isUnlocked,
        isOwner,
        isDisabled,
        isExpired,
        coverThumbnailUrl,
        allowDownloadOriginal: gallery.allowDownloadOriginal,
        allowDownloadAll: gallery.allowDownloadAll,
        studio: owner || {
          studioName: "Lumière Fine Art Photography",
          tagline: "Capturing Timeless Moments into Eternal Art",
          name: "Lead Photographer",
        },
      },
    });
  } catch (error: any) {
    console.error("Fetch public gallery error:", error);
    return NextResponse.json(
      { error: "Failed to load gallery details." },
      { status: 500 }
    );
  }
}
