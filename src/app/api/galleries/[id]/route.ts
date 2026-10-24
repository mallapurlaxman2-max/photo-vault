import { NextResponse } from "next/server";
import { getOwnerSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQRCodeDataUrl, generateQRCodeSvg, getFullGalleryUrl } from "@/lib/qr";
import { deleteGalleryStorage } from "@/lib/storage";

interface Params {
  params: Promise<{ id: string }>;
}

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
        accessLogs: {
          take: 20,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    const reqHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const publicUrl = getFullGalleryUrl(gallery.slug, reqHost);
    const qrPng = await generateQRCodeDataUrl(publicUrl, { width: 1000 });
    const qrSvg = await generateQRCodeSvg(publicUrl, { width: 1000 });

    const totalStorageBytes = gallery.photos.reduce((acc, p) => acc + p.sizeBytes, 0);

    return NextResponse.json({
      gallery: {
        id: gallery.id,
        slug: gallery.slug,
        title: gallery.title,
        clientName: gallery.clientName,
        eventDate: gallery.eventDate,
        description: gallery.description,
        coverPhotoId: gallery.coverPhotoId,
        status: gallery.status,
        expiresAt: gallery.expiresAt,
        allowDownloadOriginal: gallery.allowDownloadOriginal,
        allowDownloadAll: gallery.allowDownloadAll,
        viewsCount: gallery.viewsCount,
        createdAt: gallery.createdAt,
        updatedAt: gallery.updatedAt,
        publicUrl,
        qrCodePng: qrPng,
        qrCodeSvg: qrSvg,
        totalStorageBytes,
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
        recentAccessLogs: gallery.accessLogs,
      },
    });
  } catch (error: any) {
    console.error("Fetch single gallery error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve gallery." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getOwnerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.gallery.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    const {
      title,
      clientName,
      eventDate,
      description,
      password,
      status,
      expiresAt,
      allowDownloadOriginal,
      allowDownloadAll,
      coverPhotoId,
    } = body;

    const dataToUpdate: any = {};
    if (title !== undefined) dataToUpdate.title = title.trim();
    if (clientName !== undefined) dataToUpdate.clientName = clientName.trim();
    if (eventDate !== undefined) dataToUpdate.eventDate = eventDate ? new Date(eventDate) : null;
    if (description !== undefined) dataToUpdate.description = description;
    if (status !== undefined) dataToUpdate.status = status;
    if (expiresAt !== undefined) dataToUpdate.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (allowDownloadOriginal !== undefined) dataToUpdate.allowDownloadOriginal = Boolean(allowDownloadOriginal);
    if (allowDownloadAll !== undefined) dataToUpdate.allowDownloadAll = Boolean(allowDownloadAll);
    if (coverPhotoId !== undefined) dataToUpdate.coverPhotoId = coverPhotoId;

    if (password && password.trim().length >= 4) {
      dataToUpdate.passwordHash = await hashPassword(password.trim());
    }

    const updated = await prisma.gallery.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({
      success: true,
      gallery: updated,
    });
  } catch (error: any) {
    console.error("Update gallery error:", error);
    return NextResponse.json(
      { error: "Failed to update gallery." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await getOwnerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const gallery = await prisma.gallery.findUnique({
      where: { id },
    });

    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    // Delete photo files from disk/storage
    await deleteGalleryStorage(gallery.id);

    // Delete gallery from DB (cascade deletes Photo and AccessLog records)
    await prisma.gallery.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Gallery "${gallery.title}" and all associated files were permanently deleted.`,
    });
  } catch (error: any) {
    console.error("Delete gallery error:", error);
    return NextResponse.json(
      { error: "Failed to delete gallery." },
      { status: 500 }
    );
  }
}
