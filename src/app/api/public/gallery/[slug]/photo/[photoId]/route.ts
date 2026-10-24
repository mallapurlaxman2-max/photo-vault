import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyGalleryGuestSession } from "@/lib/auth";
import { getPhotoBuffer } from "@/lib/storage";
import { findGalleryBySlug } from "@/lib/galleryResolver";

interface Params {
  params: Promise<{ slug: string; photoId: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { slug, photoId } = await params;
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") as "thumbnail" | "display" | "photo") || "display";
    const isPublicCover = searchParams.get("publicCover") === "true";

    const gallery = await findGalleryBySlug(slug, {
      select: { id: true, coverPhotoId: true, status: true },
    });

    if (!gallery) {
      return new Response("Gallery not found", { status: 404 });
    }

    // Check authorization:
    // Allow cover photo thumbnail for the password screen if gallery is active
    const isCoverPreviewAllowed =
      isPublicCover &&
      type === "thumbnail" &&
      gallery.status === "ACTIVE";

    if (!isCoverPreviewAllowed) {
      const isAuthorized = await verifyGalleryGuestSession(gallery.id);
      if (!isAuthorized) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const photo = await prisma.photo.findFirst({
      where: { id: photoId, galleryId: gallery.id },
    });

    if (!photo) {
      return new Response("Photo not found", { status: 404 });
    }

    const fileData = await getPhotoBuffer(photo.storageKey, type);
    if (!fileData) {
      return new Response("Image file not found on server", { status: 404 });
    }

    return new Response(new Uint8Array(fileData.buffer), {
      headers: {
        "Content-Type": fileData.contentType,
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error: any) {
    console.error("Serve photo error:", error);
    return new Response("Error serving image", { status: 500 });
  }
}
