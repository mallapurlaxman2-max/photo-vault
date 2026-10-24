import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processAndSavePhoto } from "@/lib/storage";
import crypto from "crypto";

interface Params {
  params: Promise<{ id: string }>;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "image/avif",
];

const MAX_FILE_SIZE_BYTES = parseInt(process.env.MAX_UPLOAD_SIZE_MB || "50", 10) * 1024 * 1024;

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await getOwnerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const gallery = await prisma.gallery.findUnique({
      where: { id },
      include: {
        photos: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    return NextResponse.json({
      photos: gallery.photos.map((p) => ({
        id: p.id,
        filename: p.filename,
        sizeBytes: p.sizeBytes,
        width: p.width,
        height: p.height,
        caption: p.caption,
        sortOrder: p.sortOrder,
        isCover: p.isCover,
        createdAt: p.createdAt,
        thumbnailUrl: `/api/public/gallery/${gallery.slug}/photo/${p.id}?type=thumbnail`,
        displayUrl: `/api/public/gallery/${gallery.slug}/photo/${p.id}?type=display`,
        downloadUrl: `/api/public/gallery/${gallery.slug}/download/${p.id}`,
      })),
    });
  } catch (error: any) {
    console.error("Fetch photos error:", error);
    return NextResponse.json({ error: "Failed to fetch photos." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await getOwnerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: galleryId } = await params;

    const gallery = await prisma.gallery.findUnique({
      where: { id: galleryId },
      include: { _count: { select: { photos: true } } },
    });

    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
    }

    const uploadedPhotos = [];
    const errors: string[] = [];

    // Current photo count for sortOrder
    let nextSortOrder = gallery._count.photos;
    let hasCover = Boolean(gallery.coverPhotoId);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
        errors.push(`File "${file.name}" has unsupported format (${file.type}). JPG, PNG, WebP supported.`);
        continue;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`File "${file.name}" exceeds the maximum size limit of ${process.env.MAX_UPLOAD_SIZE_MB || 50} MB.`);
        continue;
      }

      try {
        const photoId = crypto.randomUUID();
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Process with Sharp and save
        const processed = await processAndSavePhoto(
          galleryId,
          photoId,
          file.name,
          buffer,
          file.type
        );

        const isCover = !hasCover && i === 0;
        if (isCover) hasCover = true;

        const photo = await prisma.photo.create({
          data: {
            id: photoId,
            galleryId,
            filename: file.name,
            storageKey: processed.storageKey,
            thumbnailKey: processed.thumbnailKey,
            mimeType: processed.mimeType,
            sizeBytes: processed.sizeBytes,
            width: processed.width,
            height: processed.height,
            sortOrder: nextSortOrder++,
            isCover,
          },
        });

        if (isCover) {
          await prisma.gallery.update({
            where: { id: galleryId },
            data: { coverPhotoId: photo.id },
          });
        }

        uploadedPhotos.push({
          id: photo.id,
          filename: photo.filename,
          sizeBytes: photo.sizeBytes,
          width: photo.width,
          height: photo.height,
          sortOrder: photo.sortOrder,
          isCover: photo.isCover,
          thumbnailUrl: `/api/public/gallery/${gallery.slug}/photo/${photo.id}?type=thumbnail`,
          displayUrl: `/api/public/gallery/${gallery.slug}/photo/${photo.id}?type=display`,
        });
      } catch (uploadErr: any) {
        console.error(`Error processing photo ${file.name}:`, uploadErr);
        errors.push(`Failed to process "${file.name}": ${uploadErr.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      uploadedCount: uploadedPhotos.length,
      photos: uploadedPhotos,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Batch photo upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload photos." },
      { status: 500 }
    );
  }
}
