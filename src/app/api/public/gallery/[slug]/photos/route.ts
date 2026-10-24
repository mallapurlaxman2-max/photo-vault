import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyGalleryGuestSession } from "@/lib/auth";
import { findGalleryBySlug } from "@/lib/galleryResolver";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;

    const gallery = await findGalleryBySlug(slug, {
      include: {
        photos: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    // Verify session
    const isAuthorized = await verifyGalleryGuestSession(gallery.id);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Access denied. Please enter the gallery password." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      title: gallery.title,
      clientName: gallery.clientName,
      eventDate: gallery.eventDate,
      description: gallery.description,
      allowDownloadOriginal: gallery.allowDownloadOriginal,
      allowDownloadAll: gallery.allowDownloadAll,
      photos: (gallery.photos || []).map((p: any) => ({
        id: p.id,
        filename: p.filename,
        sizeBytes: p.sizeBytes,
        width: p.width,
        height: p.height,
        caption: p.caption,
        sortOrder: p.sortOrder,
        isCover: p.isCover,
        thumbnailUrl: `/api/public/gallery/${gallery.slug}/photo/${p.id}?type=thumbnail`,
        displayUrl: `/api/public/gallery/${gallery.slug}/photo/${p.id}?type=display`,
        downloadUrl: gallery.allowDownloadOriginal
          ? `/api/public/gallery/${gallery.slug}/download/${p.id}`
          : null,
      })),
    });
  } catch (error: any) {
    console.error("Public photos fetch error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve photos." },
      { status: 500 }
    );
  }
}
