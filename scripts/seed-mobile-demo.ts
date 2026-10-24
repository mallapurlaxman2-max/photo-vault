import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";
import { processAndSavePhoto } from "../src/lib/storage";
import sharp from "sharp";
import crypto from "crypto";

async function seed() {
  const existing = await prisma.gallery.findFirst();
  if (existing) {
    console.log("Gallery already exists:", existing.title, "slug:", existing.slug);
    return;
  }

  // Ensure owner exists
  const ownerCount = await prisma.owner.count();
  if (ownerCount === 0) {
    await prisma.owner.create({
      data: {
        email: "robert@lumierestudio.com",
        passwordHash: await hashPassword("MasterPhotographerSecret2026!"),
        name: "Robert Vance",
        studioName: "Lumière Studio",
      },
    });
  }

  const slug = "rahul-priya-wedding";
  const passHash = await hashPassword("1234");
  const g = await prisma.gallery.create({
    data: {
      slug,
      title: "Rahul & Priya Wedding",
      clientName: "Rahul & Priya Sharma",
      passwordHash: passHash,
      allowDownloadOriginal: true,
      allowDownloadAll: true,
    },
  });

  const colors = [
    { r: 212, g: 175, b: 55 },
    { r: 40, g: 40, b: 55 },
    { r: 180, g: 120, b: 80 },
    { r: 70, g: 100, b: 140 },
  ];

  for (let i = 0; i < colors.length; i++) {
    const id = crypto.randomUUID();
    const buf = await sharp({
      create: { width: 1200, height: 1200, channels: 3, background: colors[i] },
    })
      .jpeg()
      .toBuffer();

    const res = await processAndSavePhoto(
      g.id,
      id,
      `wedding_photo_${i + 1}.jpg`,
      buf,
      "image/jpeg"
    );
    const photo = await prisma.photo.create({
      data: {
        id,
        galleryId: g.id,
        filename: `wedding_photo_${i + 1}.jpg`,
        storageKey: res.storageKey,
        thumbnailKey: res.thumbnailKey,
        mimeType: "image/jpeg",
        sizeBytes: res.sizeBytes,
        width: 1200,
        height: 1200,
        isCover: i === 0,
        caption: `Ceremony highlight ${i + 1}`,
      },
    });

    if (i === 0) {
      await prisma.gallery.update({ where: { id: g.id }, data: { coverPhotoId: photo.id } });
    }
  }

  console.log("Seeded gallery successfully with PIN 1234");
}

seed();
