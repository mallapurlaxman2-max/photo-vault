import fs from "fs";
import path from "path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "local";

function getStorageBaseDir(): string {
  return path.join(process.cwd(), "storage");
}

function ensureLocalDirs() {
  if (STORAGE_PROVIDER !== "local") return;
  const base = getStorageBaseDir();
  const photosDir = path.join(base, "photos");
  const thumbsDir = path.join(base, "thumbnails");
  const displayDir = path.join(base, "display");

  if (!fs.existsSync(/*turbopackIgnore: true*/ photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
  }
  if (!fs.existsSync(/*turbopackIgnore: true*/ thumbsDir)) {
    fs.mkdirSync(thumbsDir, { recursive: true });
  }
  if (!fs.existsSync(/*turbopackIgnore: true*/ displayDir)) {
    fs.mkdirSync(displayDir, { recursive: true });
  }
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface ProcessedImageResult {
  storageKey: string;
  thumbnailKey: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
}

export async function processAndSavePhoto(
  galleryId: string,
  photoId: string,
  originalFilename: string,
  buffer: Buffer,
  mimeType: string
): Promise<ProcessedImageResult> {
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();

  const width = metadata.width || 1920;
  const height = metadata.height || 1080;
  const ext = path.extname(originalFilename) || ".jpg";

  // 1. Generate optimized thumbnail (max 600px, WebP, quality 80)
  const thumbnailBuffer = await sharp(buffer)
    .rotate()
    .resize(600, 600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  // 2. Generate medium display version (max 1920px, WebP, quality 85)
  const displayBuffer = await sharp(buffer)
    .rotate()
    .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  const originalKey = `${galleryId}/${photoId}${ext}`;
  const thumbKey = `${galleryId}/${photoId}_thumb.webp`;
  const displayKey = `${galleryId}/${photoId}_display.webp`;

  const supabase = getSupabaseClient();
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "galleries";

  if (STORAGE_PROVIDER === "supabase" && supabase) {
    await supabase.storage.from(bucketName).upload(originalKey, buffer, {
      contentType: mimeType,
      upsert: true,
    });
    await supabase.storage.from(bucketName).upload(thumbKey, thumbnailBuffer, {
      contentType: "image/webp",
      upsert: true,
    });
    await supabase.storage.from(bucketName).upload(displayKey, displayBuffer, {
      contentType: "image/webp",
      upsert: true,
    });
  } else {
    ensureLocalDirs();
    const base = getStorageBaseDir();
    const galleryPhotoDir = path.join(base, "photos", galleryId);
    const galleryThumbDir = path.join(base, "thumbnails", galleryId);
    const galleryDisplayDir = path.join(base, "display", galleryId);

    if (!fs.existsSync(/*turbopackIgnore: true*/ galleryPhotoDir)) {
      fs.mkdirSync(galleryPhotoDir, { recursive: true });
    }
    if (!fs.existsSync(/*turbopackIgnore: true*/ galleryThumbDir)) {
      fs.mkdirSync(galleryThumbDir, { recursive: true });
    }
    if (!fs.existsSync(/*turbopackIgnore: true*/ galleryDisplayDir)) {
      fs.mkdirSync(galleryDisplayDir, { recursive: true });
    }

    fs.writeFileSync(path.join(base, "photos", originalKey), buffer);
    fs.writeFileSync(path.join(base, "thumbnails", thumbKey), thumbnailBuffer);
    fs.writeFileSync(path.join(base, "display", displayKey), displayBuffer);
  }

  return {
    storageKey: originalKey,
    thumbnailKey: thumbKey,
    width,
    height,
    sizeBytes: buffer.length,
    mimeType,
  };
}

export async function getPhotoBuffer(
  key: string,
  type: "photo" | "thumbnail" | "display" = "photo"
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const supabase = getSupabaseClient();
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "galleries";

  let resolvedKey = key;
  if (type === "thumbnail") {
    if (!key.endsWith("_thumb.webp")) {
      resolvedKey = key.replace(/\.[^/.]+$/, "") + "_thumb.webp";
    }
  } else if (type === "display") {
    if (!key.endsWith("_display.webp")) {
      resolvedKey = key.replace(/\.[^/.]+$/, "") + "_display.webp";
    }
  }

  if (STORAGE_PROVIDER === "supabase" && supabase) {
    const { data, error } = await supabase.storage.from(bucketName).download(resolvedKey);
    if (error || !data) return null;
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = type === "thumbnail" || type === "display" ? "image/webp" : "image/jpeg";
    return { buffer, contentType };
  }

  // Local storage
  const base = getStorageBaseDir();
  let folder = "photos";
  if (type === "thumbnail") folder = "thumbnails";
  if (type === "display") folder = "display";

  const filePath = path.join(base, folder, resolvedKey);
  if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
    // Fallback: if display or thumbnail does not exist, fallback to original photo
    if (type === "display" || type === "thumbnail") {
      const fallbackPath = path.join(base, "photos", key);
      if (fs.existsSync(/*turbopackIgnore: true*/ fallbackPath)) {
        const buffer = fs.readFileSync(fallbackPath);
        return { buffer, contentType: "image/jpeg" };
      }
    }
    return null;
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
  };

  return { buffer, contentType: mimeMap[ext] || "application/octet-stream" };
}

export async function deletePhotoFiles(storageKey: string, thumbnailKey: string): Promise<void> {
  const supabase = getSupabaseClient();
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "galleries";

  const displayKey = storageKey.replace(/\.[^/.]+$/, "") + "_display.webp";

  if (STORAGE_PROVIDER === "supabase" && supabase) {
    await supabase.storage.from(bucketName).remove([storageKey, thumbnailKey, displayKey]);
    return;
  }

  const base = getStorageBaseDir();
  const p1 = path.join(base, "photos", storageKey);
  const p2 = path.join(base, "thumbnails", thumbnailKey);
  const p3 = path.join(base, "display", displayKey);

  if (fs.existsSync(/*turbopackIgnore: true*/ p1)) fs.unlinkSync(p1);
  if (fs.existsSync(/*turbopackIgnore: true*/ p2)) fs.unlinkSync(p2);
  if (fs.existsSync(/*turbopackIgnore: true*/ p3)) fs.unlinkSync(p3);
}

export async function deleteGalleryStorage(galleryId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "galleries";

  if (STORAGE_PROVIDER === "supabase" && supabase) {
    const { data: files } = await supabase.storage.from(bucketName).list(galleryId);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${galleryId}/${f.name}`);
      await supabase.storage.from(bucketName).remove(paths);
    }
    return;
  }

  const base = getStorageBaseDir();
  const d1 = path.join(base, "photos", galleryId);
  const d2 = path.join(base, "thumbnails", galleryId);
  const d3 = path.join(base, "display", galleryId);

  if (fs.existsSync(/*turbopackIgnore: true*/ d1)) fs.rmSync(d1, { recursive: true, force: true });
  if (fs.existsSync(/*turbopackIgnore: true*/ d2)) fs.rmSync(d2, { recursive: true, force: true });
  if (fs.existsSync(/*turbopackIgnore: true*/ d3)) fs.rmSync(d3, { recursive: true, force: true });
}
