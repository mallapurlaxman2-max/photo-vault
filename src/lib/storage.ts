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

  try {
    if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
    if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });
    if (!fs.existsSync(displayDir)) fs.mkdirSync(displayDir, { recursive: true });
  } catch (err) {
    console.warn("Could not create local storage dirs (expected on Vercel):", err);
  }
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getBucketName(): string {
  return process.env.SUPABASE_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || "gallery-photos";
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
  let width = 1920;
  let height = 1080;
  let thumbnailBuffer = buffer;
  let displayBuffer = buffer;

  try {
    const image = sharp(buffer).rotate();
    const metadata = await image.metadata();
    width = metadata.width || 1920;
    height = metadata.height || 1080;

    // 1. Thumbnail (max 500px, WebP 80%)
    thumbnailBuffer = await sharp(buffer)
      .rotate()
      .resize(500, 500, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    // 2. Display (max 1920px, WebP 85%)
    displayBuffer = await sharp(buffer)
      .rotate()
      .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (sharpErr) {
    console.warn("Sharp optimization failed, using original buffer:", sharpErr);
  }

  const ext = path.extname(originalFilename) || ".jpg";
  const originalKey = `${galleryId}/${photoId}${ext}`;
  const thumbKey = `${galleryId}/${photoId}_thumb.webp`;
  const displayKey = `${galleryId}/${photoId}_display.webp`;

  const supabase = getSupabaseClient();
  const bucketName = getBucketName();

  let savedToSupabase = false;

  if (supabase) {
    try {
      const up1 = await supabase.storage.from(bucketName).upload(originalKey, buffer, {
        contentType: mimeType,
        upsert: true,
      });
      const up2 = await supabase.storage.from(bucketName).upload(thumbKey, thumbnailBuffer, {
        contentType: "image/webp",
        upsert: true,
      });
      const up3 = await supabase.storage.from(bucketName).upload(displayKey, displayBuffer, {
        contentType: "image/webp",
        upsert: true,
      });

      if (!up1.error && !up2.error && !up3.error) {
        savedToSupabase = true;
      } else {
        console.warn("Supabase upload returned error:", up1.error || up2.error || up3.error);
      }
    } catch (sbErr) {
      console.warn("Supabase storage upload exception:", sbErr);
    }
  }

  // If saved to Supabase, use Supabase keys
  if (savedToSupabase) {
    return {
      storageKey: originalKey,
      thumbnailKey: thumbKey,
      width,
      height,
      sizeBytes: buffer.length,
      mimeType,
    };
  }

  // Fallback 1: Local filesystem (if writable, e.g. local dev)
  try {
    ensureLocalDirs();
    const base = getStorageBaseDir();
    const galleryPhotoDir = path.join(base, "photos", galleryId);
    const galleryThumbDir = path.join(base, "thumbnails", galleryId);
    const galleryDisplayDir = path.join(base, "display", galleryId);

    if (!fs.existsSync(galleryPhotoDir)) fs.mkdirSync(galleryPhotoDir, { recursive: true });
    if (!fs.existsSync(galleryThumbDir)) fs.mkdirSync(galleryThumbDir, { recursive: true });
    if (!fs.existsSync(galleryDisplayDir)) fs.mkdirSync(galleryDisplayDir, { recursive: true });

    fs.writeFileSync(path.join(base, "photos", originalKey), buffer);
    fs.writeFileSync(path.join(base, "thumbnails", thumbKey), thumbnailBuffer);
    fs.writeFileSync(path.join(base, "display", displayKey), displayBuffer);

    return {
      storageKey: originalKey,
      thumbnailKey: thumbKey,
      width,
      height,
      sizeBytes: buffer.length,
      mimeType,
    };
  } catch (fsErr) {
    console.warn("Local storage write failed (e.g. read-only serverless filesystem):", fsErr);
  }

  // Fallback 2: Rock-solid Database Embedded Data URL (Works 100% on Vercel without any bucket!)
  const dataUrlOriginal = `data:image/webp;base64,${displayBuffer.toString("base64")}`;
  const dataUrlThumb = `data:image/webp;base64,${thumbnailBuffer.toString("base64")}`;

  return {
    storageKey: dataUrlOriginal,
    thumbnailKey: dataUrlThumb,
    width,
    height,
    sizeBytes: displayBuffer.length,
    mimeType: "image/webp",
  };
}

export async function getPhotoBuffer(
  key: string,
  type: "photo" | "thumbnail" | "display" = "photo"
): Promise<{ buffer: Buffer; contentType: string } | null> {
  // 1. Direct Data URL check (Database embedded fallback)
  if (key.startsWith("data:")) {
    const commaIndex = key.indexOf(",");
    if (commaIndex !== -1) {
      const header = key.substring(0, commaIndex);
      const base64Data = key.substring(commaIndex + 1);
      const mime = header.match(/:(.*?);/)?.[1] || "image/webp";
      const buffer = Buffer.from(base64Data, "base64");
      return { buffer, contentType: mime };
    }
  }

  const supabase = getSupabaseClient();
  const bucketName = getBucketName();

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

  // 2. Supabase Storage download
  if (supabase) {
    try {
      const { data, error } = await supabase.storage.from(bucketName).download(resolvedKey);
      if (!error && data) {
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = type === "thumbnail" || type === "display" ? "image/webp" : "image/jpeg";
        return { buffer, contentType };
      }
    } catch (e) {
      console.warn("Supabase download error:", e);
    }
  }

  // 3. Local storage check
  try {
    const base = getStorageBaseDir();
    let folder = "photos";
    if (type === "thumbnail") folder = "thumbnails";
    if (type === "display") folder = "display";

    const filePath = path.join(base, folder, resolvedKey);
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".webp": "image/webp",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
      };
      return { buffer, contentType: mimeMap[ext] || "image/jpeg" };
    }
  } catch (fsErr) {
    // Ignore on Vercel
  }

  return null;
}

export async function deletePhotoFiles(storageKey: string, thumbnailKey: string): Promise<void> {
  if (storageKey.startsWith("data:")) return;

  const supabase = getSupabaseClient();
  const bucketName = getBucketName();
  const displayKey = storageKey.replace(/\.[^/.]+$/, "") + "_display.webp";

  if (supabase) {
    try {
      await supabase.storage.from(bucketName).remove([storageKey, thumbnailKey, displayKey]);
      return;
    } catch {}
  }

  try {
    const base = getStorageBaseDir();
    const p1 = path.join(base, "photos", storageKey);
    const p2 = path.join(base, "thumbnails", thumbnailKey);
    const p3 = path.join(base, "display", displayKey);
    if (fs.existsSync(p1)) fs.unlinkSync(p1);
    if (fs.existsSync(p2)) fs.unlinkSync(p2);
    if (fs.existsSync(p3)) fs.unlinkSync(p3);
  } catch {}
}

export async function deleteGalleryStorage(galleryId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const bucketName = getBucketName();

  if (supabase) {
    try {
      const { data: files } = await supabase.storage.from(bucketName).list(galleryId);
      if (files && files.length > 0) {
        const paths = files.map((f) => `${galleryId}/${f.name}`);
        await supabase.storage.from(bucketName).remove(paths);
      }
      return;
    } catch {}
  }

  try {
    const base = getStorageBaseDir();
    const d1 = path.join(base, "photos", galleryId);
    const d2 = path.join(base, "thumbnails", galleryId);
    const d3 = path.join(base, "display", galleryId);
    if (fs.existsSync(d1)) fs.rmSync(d1, { recursive: true, force: true });
    if (fs.existsSync(d2)) fs.rmSync(d2, { recursive: true, force: true });
    if (fs.existsSync(d3)) fs.rmSync(d3, { recursive: true, force: true });
  } catch {}
}
