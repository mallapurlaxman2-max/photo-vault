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

    const gallery = await findGalleryBySlug(slug, {
      select: { id: true, allowDownloadOriginal: true },
    });

    if (!gallery) {
      return new Response("Gallery not found", { status: 404 });
    }

    if (!gallery.allowDownloadOriginal) {
      return new Response("Downloads are disabled for this gallery by the photographer.", { status: 403 });
    }

    const isAuthorized = await verifyGalleryGuestSession(gallery.id);
    if (!isAuthorized) {
      return new Response("Unauthorized", { status: 401 });
    }

    const photo = await prisma.photo.findFirst({
      where: { id: photoId, galleryId: gallery.id },
    });

    if (!photo) {
      return new Response("Photo not found", { status: 404 });
    }

    const fileData = await getPhotoBuffer(photo.storageKey, "photo");
    if (!fileData) {
      return new Response("File not found on storage", { status: 404 });
    }

    return new Response(new Uint8Array(fileData.buffer), {
      headers: {
        "Content-Type": fileData.contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(photo.filename)}"`,
      },
    });
  } catch (error: any) {
    console.error("Download photo error:", error);
    return new Response("Failed to download photo", { status: 500 });
  }
}
