import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyGalleryGuestSession } from "@/lib/auth";
import { getPhotoBuffer } from "@/lib/storage";
import { PassThrough, Readable } from "stream";
import { createRequire } from "module";
import { findGalleryBySlug } from "@/lib/galleryResolver";

const require = createRequire(import.meta.url);
const archiverModule = require("archiver");
const ZipArchive = archiverModule.ZipArchive || archiverModule;

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
      return new Response("Gallery not found", { status: 404 });
    }

    if (!gallery.allowDownloadAll) {
      return new Response("Batch ZIP download is not enabled for this gallery.", { status: 403 });
    }

    const isAuthorized = await verifyGalleryGuestSession(gallery.id);
    if (!isAuthorized) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (gallery.photos.length === 0) {
      return new Response("No photos available to download in this gallery.", { status: 400 });
    }

    const passThrough = new PassThrough();
    const archive = typeof ZipArchive === "function" && ZipArchive.prototype?.append
      ? new ZipArchive({ zlib: { level: 6 } })
      : archiverModule("zip", { zlib: { level: 6 } });

    archive.on("error", (err: any) => {
      console.error("ZIP archiver error:", err);
      passThrough.destroy(err);
    });

    archive.pipe(passThrough);

    // Stream photos into archive asynchronously
    (async () => {
      try {
        const usedNames = new Set<string>();

        for (let i = 0; i < gallery.photos.length; i++) {
          const photo = gallery.photos[i];
          const fileData = await getPhotoBuffer(photo.storageKey, "photo");
          if (fileData) {
            let filename = photo.filename;
            if (usedNames.has(filename)) {
              filename = `${i + 1}-${filename}`;
            }
            usedNames.add(filename);
            archive.append(fileData.buffer, { name: filename });
          }
        }
        await archive.finalize();
      } catch (streamErr) {
        console.error("Error archiving photos:", streamErr);
        if (typeof archive.abort === "function") archive.abort();
      }
    })();

    const webStream = Readable.toWeb(passThrough);

    return new Response(webStream as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${gallery.slug}-collection.zip"`,
      },
    });
  } catch (error: any) {
    console.error("Download all error:", error);
    return new Response("Failed to generate ZIP collection", { status: 500 });
  }
}
