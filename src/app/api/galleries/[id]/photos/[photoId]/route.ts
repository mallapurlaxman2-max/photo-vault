import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deletePhotoFiles } from "@/lib/storage";

interface Params {
  params: Promise<{ id: string; photoId: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getOwnerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: galleryId, photoId } = await params;
    const body = await request.json();
    const { caption, isCover, sortOrder } = body;

    const photo = await prisma.photo.findFirst({
      where: { id: photoId, galleryId },
    });

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    if (isCover) {
      // Unset previous cover photos for this gallery
      await prisma.photo.updateMany({
        where: { galleryId, isCover: true },
        data: { isCover: false },
      });

      // Update gallery coverPhotoId
      await prisma.gallery.update({
        where: { id: galleryId },
        data: { coverPhotoId: photoId },
      });
    }

    const updated = await prisma.photo.update({
      where: { id: photoId },
      data: {
        caption: caption !== undefined ? caption : photo.caption,
        isCover: isCover !== undefined ? isCover : photo.isCover,
        sortOrder: sortOrder !== undefined ? sortOrder : photo.sortOrder,
      },
    });

    return NextResponse.json({ success: true, photo: updated });
  } catch (error: any) {
    console.error("Update photo error:", error);
    return NextResponse.json({ error: "Failed to update photo." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await getOwnerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: galleryId, photoId } = await params;

    const photo = await prisma.photo.findFirst({
      where: { id: photoId, galleryId },
    });

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Delete files from storage
    await deletePhotoFiles(photo.storageKey, photo.thumbnailKey);

    // Delete record
    await prisma.photo.delete({
      where: { id: photoId },
    });

    // Check if cover photo was deleted
    const gallery = await prisma.gallery.findUnique({
      where: { id: galleryId },
      select: { coverPhotoId: true },
    });

    if (gallery?.coverPhotoId === photoId) {
      // Reassign first remaining photo as cover
      const firstRemaining = await prisma.photo.findFirst({
        where: { galleryId },
        orderBy: { sortOrder: "asc" },
      });

      if (firstRemaining) {
        await prisma.photo.update({
          where: { id: firstRemaining.id },
          data: { isCover: true },
        });
        await prisma.gallery.update({
          where: { id: galleryId },
          data: { coverPhotoId: firstRemaining.id },
        });
      } else {
        await prisma.gallery.update({
          where: { id: galleryId },
          data: { coverPhotoId: null },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Photo deleted successfully.",
    });
  } catch (error: any) {
    console.error("Delete photo error:", error);
    return NextResponse.json({ error: "Failed to delete photo." }, { status: 500 });
  }
}
