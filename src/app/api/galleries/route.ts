import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { generateQRCodeDataUrl, generateQRCodeSvg, getFullGalleryUrl } from "@/lib/qr";

export async function GET(request: Request) {
  try {
    const session = await getOwnerSession();
    if (!session) {
      // Public guest mode: return active galleries safe public info
      const publicGalleries = await prisma.gallery.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          clientName: true,
          eventDate: true,
          coverPhotoId: true,
          status: true,
          _count: {
            select: { photos: true },
          },
        },
      });

      const reqHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
      return NextResponse.json({
        galleries: publicGalleries.map((g) => ({
          id: g.id,
          slug: g.slug,
          title: g.title,
          clientName: g.clientName,
          eventDate: g.eventDate,
          coverPhotoId: g.coverPhotoId,
          status: g.status,
          photoCount: g._count.photos,
          publicUrl: getFullGalleryUrl(g.slug, reqHost),
        })),
      });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase();
    const status = searchParams.get("status");

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { clientName: { contains: search } },
        { slug: { contains: search } },
      ];
    }

    const galleries = await prisma.gallery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { photos: true, accessLogs: true },
        },
        photos: {
          take: 1,
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            storageKey: true,
            thumbnailKey: true,
            isCover: true,
          },
        },
      },
    });

    // Compute stats
    const totalGalleries = await prisma.gallery.count();
    const totalPhotos = await prisma.photo.count();
    const totalVisits = await prisma.gallery.aggregate({
      _sum: { viewsCount: true },
    });
    const storageStats = await prisma.photo.aggregate({
      _sum: { sizeBytes: true },
    });

    const reqHost = request.headers.get("x-forwarded-host") || request.headers.get("host");

    const formattedGalleries = galleries.map((g) => ({
      id: g.id,
      slug: g.slug,
      title: g.title,
      clientName: g.clientName,
      eventDate: g.eventDate,
      description: g.description,
      status: g.status,
      expiresAt: g.expiresAt,
      allowDownloadOriginal: g.allowDownloadOriginal,
      allowDownloadAll: g.allowDownloadAll,
      viewsCount: g.viewsCount,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      photoCount: g._count.photos,
      coverPhotoId: g.coverPhotoId || (g.photos[0]?.id ?? null),
      publicUrl: getFullGalleryUrl(g.slug, reqHost),
    }));

    return NextResponse.json({
      galleries: formattedGalleries,
      stats: {
        totalGalleries,
        totalPhotos,
        totalVisits: totalVisits._sum.viewsCount || 0,
        totalStorageBytes: storageStats._sum.sizeBytes || 0,
      },
    });
  } catch (error: any) {
    console.error("Fetch galleries error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve galleries." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getOwnerSession();
    if (!session) {
      // Public guest mode: return active galleries safe public info
      const publicGalleries = await prisma.gallery.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          clientName: true,
          eventDate: true,
          coverPhotoId: true,
          status: true,
          _count: {
            select: { photos: true },
          },
        },
      });

      const reqHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
      return NextResponse.json({
        galleries: publicGalleries.map((g) => ({
          id: g.id,
          slug: g.slug,
          title: g.title,
          clientName: g.clientName,
          eventDate: g.eventDate,
          coverPhotoId: g.coverPhotoId,
          status: g.status,
          photoCount: g._count.photos,
          publicUrl: getFullGalleryUrl(g.slug, reqHost),
        })),
      });
    }

    const body = await request.json();
    const {
      title,
      clientName,
      eventDate,
      description,
      password,
      expiresAt,
      allowDownloadOriginal = true,
      allowDownloadAll = true,
    } = body;

    if (!title || !clientName || !password) {
      return NextResponse.json(
        { error: "Gallery title, customer/event name, and access password are required." },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters." },
        { status: 400 }
      );
    }

    const slug = slugify(title);
    const passwordHash = await hashPassword(password);

    const gallery = await prisma.gallery.create({
      data: {
        slug,
        title: title.trim(),
        clientName: clientName.trim(),
        eventDate: eventDate ? new Date(eventDate) : null,
        description: description ? description.trim() : null,
        passwordHash,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        allowDownloadOriginal: Boolean(allowDownloadOriginal),
        allowDownloadAll: Boolean(allowDownloadAll),
      },
    });

    const reqHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const publicUrl = getFullGalleryUrl(gallery.slug, reqHost);
    const qrPng = await generateQRCodeDataUrl(publicUrl, { width: 1000 });
    const qrSvg = await generateQRCodeSvg(publicUrl, { width: 1000 });

    return NextResponse.json({
      success: true,
      gallery: {
        id: gallery.id,
        slug: gallery.slug,
        title: gallery.title,
        clientName: gallery.clientName,
        eventDate: gallery.eventDate,
        description: gallery.description,
        status: gallery.status,
        expiresAt: gallery.expiresAt,
        allowDownloadOriginal: gallery.allowDownloadOriginal,
        allowDownloadAll: gallery.allowDownloadAll,
        publicUrl,
        qrCodePng: qrPng,
        qrCodeSvg: qrSvg,
      },
    });
  } catch (error: any) {
    console.error("Create gallery error:", error);
    return NextResponse.json(
      { error: "Failed to create gallery." },
      { status: 500 }
    );
  }
}
