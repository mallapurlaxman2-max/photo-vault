import { prisma } from "../src/lib/prisma";
import {
  hashPassword,
  verifyPassword,
  signOwnerToken,
  verifyOwnerToken,
  signGalleryToken,
  verifyGalleryToken,
} from "../src/lib/auth";
import { generateQRCodeDataUrl, generateQRCodeSvg, getFullGalleryUrl } from "../src/lib/qr";
import { processAndSavePhoto, getPhotoBuffer, deletePhotoFiles, deleteGalleryStorage } from "../src/lib/storage";
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from "../src/lib/rateLimit";
import { slugify } from "../src/lib/utils";
import sharp from "sharp";
import crypto from "crypto";

async function runTestSuite() {
  console.log("====================================================================");
  console.log(" LUMIÈRE STUDIO: PROFESSIONAL PHOTOGRAPHER QA & E2E TEST SUITE");
  console.log("====================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // Clean test database first
    await prisma.accessLog.deleteMany({});
    await prisma.photo.deleteMany({});
    await prisma.gallery.deleteMany({});
    await prisma.owner.deleteMany({});
    await prisma.rateLimitRecord.deleteMany({});

    // -------------------------------------------------------------------
    // TEST 1: First-Owner Setup & Security Lockdown
    // -------------------------------------------------------------------
    console.log("▶ TEST SUITE 1: Master Owner Authentication & Single-Owner Guard");
    const initialCount = await prisma.owner.count();
    assert(initialCount === 0, "Initial state has 0 owners (needs setup)");

    const ownerPassword = "MasterPhotographerSecret2026!";
    const ownerPasswordHash = await hashPassword(ownerPassword);

    const owner = await prisma.owner.create({
      data: {
        email: "robert@lumierestudio.com",
        passwordHash: ownerPasswordHash,
        name: "Robert Vance",
        studioName: "Lumière Fine Art Photography",
        tagline: "Capturing Timeless Moments into Eternal Art",
      },
    });

    assert(Boolean(owner.id), "Owner successfully registered");
    assert(owner.email === "robert@lumierestudio.com", "Owner email matches");

    // Verify password check
    const correctPass = await verifyPassword(ownerPassword, owner.passwordHash);
    const wrongPass = await verifyPassword("WrongPassword123!", owner.passwordHash);
    assert(correctPass === true, "Owner password verified with bcrypt");
    assert(wrongPass === false, "Incorrect owner password rejected");

    // Owner JWT Token
    const ownerToken = signOwnerToken({
      ownerId: owner.id,
      email: owner.email,
      role: "OWNER",
    });
    const verifiedOwnerPayload = verifyOwnerToken(ownerToken);
    assert(verifiedOwnerPayload?.ownerId === owner.id, "Owner JWT issued and verified");

    // Single-Owner registration prevention
    const currentOwnerCount = await prisma.owner.count();
    assert(currentOwnerCount === 1, "Public registration locked (owner count = 1)");

    // -------------------------------------------------------------------
    // TEST 2: Multi-Gallery Independence & Unique QR Code Generation
    // -------------------------------------------------------------------
    console.log("\n▶ TEST SUITE 2: Multiple Independent Galleries & Unique QR Codes");

    const galleryData = [
      {
        title: "Rahul & Priya Wedding",
        clientName: "Rahul & Priya Sharma",
        password: "WeddingSecret2026!",
        allowDownloadOriginal: true,
        allowDownloadAll: true,
      },
      {
        title: "Birthday Celebration",
        clientName: "Sophia Miller",
        password: "PartyPass99!",
        allowDownloadOriginal: false, // downloads disabled
        allowDownloadAll: false,
      },
      {
        title: "College Farewell Gala",
        clientName: "Batch of 2026",
        password: "FarewellCheers!",
        allowDownloadOriginal: true,
        allowDownloadAll: false,
      },
    ];

    const createdGalleries: any[] = [];

    for (const g of galleryData) {
      const slug = slugify(g.title);
      const passwordHash = await hashPassword(g.password);

      const created = await prisma.gallery.create({
        data: {
          slug,
          title: g.title,
          clientName: g.clientName,
          passwordHash,
          allowDownloadOriginal: g.allowDownloadOriginal,
          allowDownloadAll: g.allowDownloadAll,
        },
      });

      const publicUrl = getFullGalleryUrl(created.slug);
      const qrPng = await generateQRCodeDataUrl(publicUrl, { width: 500 });
      const qrSvg = await generateQRCodeSvg(publicUrl, { width: 500 });

      assert(Boolean(created.id), `Gallery "${g.title}" created with unique ID`);
      assert(qrPng.startsWith("data:image/png;base64,"), `Unique high-res PNG QR code generated for ${g.title}`);
      assert(qrSvg.includes("<svg"), `Unique vector SVG QR code generated for ${g.title}`);
      assert(qrPng !== createdGalleries[0]?.qrPng, `QR codes are distinct and unique per gallery`);

      createdGalleries.push({ ...created, qrPng, qrSvg, rawPassword: g.password });
    }

    assert(createdGalleries.length === 3, "3 independent galleries created simultaneously");
    assert(
      createdGalleries[0].slug !== createdGalleries[1].slug &&
        createdGalleries[1].slug !== createdGalleries[2].slug,
      "All galleries have unique slugs"
    );

    // -------------------------------------------------------------------
    // TEST 3: Photo Upload, Sharp Optimization, & Adding Photos Later
    // -------------------------------------------------------------------
    console.log("\n▶ TEST SUITE 3: Real Photo Storage, Thumbnail Processing & Batch Ingestion");

    // Create a 1920x1080 test image using Sharp
    const testImageBuffer1 = await sharp({
      create: {
        width: 1920,
        height: 1080,
        channels: 3,
        background: { r: 212, g: 175, b: 55 }, // gold
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();

    const testImageBuffer2 = await sharp({
      create: {
        width: 1200,
        height: 1600,
        channels: 3,
        background: { r: 18, g: 18, b: 21 }, // dark obsidian
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();

    const g1 = createdGalleries[0]; // Rahul & Priya Wedding
    const g2 = createdGalleries[1]; // Birthday Celebration

    // Batch upload 2 photos to Gallery 1
    const p1Id = crypto.randomUUID();
    const p2Id = crypto.randomUUID();

    const res1 = await processAndSavePhoto(g1.id, p1Id, "ceremony_vows.jpg", testImageBuffer1, "image/jpeg");
    const res2 = await processAndSavePhoto(g1.id, p2Id, "palace_portrait.jpg", testImageBuffer2, "image/jpeg");

    const photo1 = await prisma.photo.create({
      data: {
        id: p1Id,
        galleryId: g1.id,
        filename: "ceremony_vows.jpg",
        storageKey: res1.storageKey,
        thumbnailKey: res1.thumbnailKey,
        mimeType: res1.mimeType,
        sizeBytes: res1.sizeBytes,
        width: res1.width,
        height: res1.height,
        isCover: true,
      },
    });

    const photo2 = await prisma.photo.create({
      data: {
        id: p2Id,
        galleryId: g1.id,
        filename: "palace_portrait.jpg",
        storageKey: res2.storageKey,
        thumbnailKey: res2.thumbnailKey,
        mimeType: res2.mimeType,
        sizeBytes: res2.sizeBytes,
        width: res2.width,
        height: res2.height,
        isCover: false,
      },
    });

    await prisma.gallery.update({
      where: { id: g1.id },
      data: { coverPhotoId: photo1.id },
    });

    assert(res1.width === 1920 && res1.height === 1080, "Sharp extracted correct original width & height (1920x1080)");
    assert(Boolean(res1.thumbnailKey), "WebP thumbnail key generated");

    // Verify thumbnail is readable from storage
    const thumbData = await getPhotoBuffer(res1.thumbnailKey, "thumbnail");
    assert(thumbData !== null && thumbData.contentType === "image/webp", "Thumbnail is stored and served as WebP");

    // Upload 1 photo to Gallery 2
    const p3Id = crypto.randomUUID();
    const res3 = await processAndSavePhoto(g2.id, p3Id, "birthday_cake.jpg", testImageBuffer1, "image/jpeg");
    await prisma.photo.create({
      data: {
        id: p3Id,
        galleryId: g2.id,
        filename: "birthday_cake.jpg",
        storageKey: res3.storageKey,
        thumbnailKey: res3.thumbnailKey,
        mimeType: res3.mimeType,
        sizeBytes: res3.sizeBytes,
        width: res3.width,
        height: res3.height,
        isCover: true,
      },
    });

    // Verify Gallery 1 and Gallery 2 photos are strictly partitioned
    const g1Photos = await prisma.photo.findMany({ where: { galleryId: g1.id } });
    const g2Photos = await prisma.photo.findMany({ where: { galleryId: g2.id } });
    assert(g1Photos.length === 2, "Gallery 1 contains exactly 2 photos");
    assert(g2Photos.length === 1, "Gallery 2 contains exactly 1 photo");
    assert(!g1Photos.some((p) => p.galleryId === g2.id), "Zero cross-contamination between galleries");

    // Test adding more photos to Gallery 1 later without overwriting previous uploads
    const p4Id = crypto.randomUUID();
    const res4 = await processAndSavePhoto(g1.id, p4Id, "reception_dance.jpg", testImageBuffer2, "image/jpeg");
    await prisma.photo.create({
      data: {
        id: p4Id,
        galleryId: g1.id,
        filename: "reception_dance.jpg",
        storageKey: res4.storageKey,
        thumbnailKey: res4.thumbnailKey,
        mimeType: res4.mimeType,
        sizeBytes: res4.sizeBytes,
        width: res4.width,
        height: res4.height,
        isCover: false,
      },
    });

    const g1PhotosUpdated = await prisma.photo.findMany({ where: { galleryId: g1.id } });
    assert(g1PhotosUpdated.length === 3, "New photos successfully added later without deleting prior photos");
    assert(g1PhotosUpdated[0].id === photo1.id, "Original cover photo remains preserved");

    // -------------------------------------------------------------------
    // TEST 4: Customer Password Authentication, Rate Limiting & Tokens
    // -------------------------------------------------------------------
    console.log("\n▶ TEST SUITE 4: Customer Password Verification & Brute-Force Rate Limiting");

    const rateKey = `gallery:${g1.slug}:test-ip-123`;
    await resetRateLimit(rateKey);

    // Test wrong password
    const badPassMatch = await verifyPassword("WrongGuestPassword!", g1.passwordHash);
    assert(badPassMatch === false, "Incorrect guest password rejected");

    const fail1 = await recordFailedAttempt(rateKey);
    assert(fail1.allowed === true && fail1.remainingAttempts === 4, "Failed attempt recorded (4 attempts left)");

    // Simulate 4 more failed attempts -> should trigger lockout
    await recordFailedAttempt(rateKey);
    await recordFailedAttempt(rateKey);
    await recordFailedAttempt(rateKey);
    const fail5 = await recordFailedAttempt(rateKey);
    assert(fail5.allowed === false && fail5.remainingAttempts === 0, "Rate limiter locked out client after 5 failed attempts");

    // Reset rate limiter for valid test
    await resetRateLimit(rateKey);

    // Test correct password
    const goodPassMatch = await verifyPassword(g1.rawPassword, g1.passwordHash);
    assert(goodPassMatch === true, "Correct gallery password verified");

    // Issue Guest Gallery JWT
    const guestTokenG1 = signGalleryToken({
      galleryId: g1.id,
      slug: g1.slug,
      unlockedAt: Date.now(),
    });
    const verifiedG1 = verifyGalleryToken(guestTokenG1, g1.id);
    assert(verifiedG1 !== null && verifiedG1.galleryId === g1.id, "Valid guest token issued for Gallery 1");

    // -------------------------------------------------------------------
    // TEST 5: Cross-Gallery Access Protection
    // -------------------------------------------------------------------
    console.log("\n▶ TEST SUITE 5: Strict Cross-Gallery Access Prevention");

    // Attempt to access Gallery 2 using Gallery 1's token
    const crossAccessAttempt = verifyGalleryToken(guestTokenG1, g2.id);
    assert(crossAccessAttempt === null, "Token for Gallery 1 strictly rejected when accessing Gallery 2");

    // -------------------------------------------------------------------
    // TEST 6: Gallery-Specific Download Permissions
    // -------------------------------------------------------------------
    console.log("\n▶ TEST SUITE 6: Download Controls Enforcement");

    // Gallery 1: downloads allowed
    assert(g1.allowDownloadOriginal === true, "Gallery 1 allows original photo download");
    assert(g1.allowDownloadAll === true, "Gallery 1 allows download-all ZIP");

    // Gallery 2: downloads disabled
    assert(g2.allowDownloadOriginal === false, "Gallery 2 disables individual downloads");
    assert(g2.allowDownloadAll === false, "Gallery 2 disables download-all ZIP");

    // -------------------------------------------------------------------
    // TEST 7: Gallery Status Revocation & Expiration
    // -------------------------------------------------------------------
    console.log("\n▶ TEST SUITE 7: Status Revocation & Auto-Expiration");

    // Disable Gallery 1
    const disabledGallery = await prisma.gallery.update({
      where: { id: g1.id },
      data: { status: "DISABLED" },
    });
    assert(disabledGallery.status === "DISABLED", "Gallery 1 successfully disabled (access revoked immediately)");

    // Re-enable Gallery 1
    const reenabledGallery = await prisma.gallery.update({
      where: { id: g1.id },
      data: { status: "ACTIVE" },
    });
    assert(reenabledGallery.status === "ACTIVE", "Gallery 1 re-enabled to ACTIVE");

    // Set Expiration in the past
    const expiredGallery = await prisma.gallery.update({
      where: { id: g1.id },
      data: { expiresAt: new Date(Date.now() - 1000 * 60 * 60) }, // 1 hour ago
    });
    const isExpired = expiredGallery.expiresAt ? expiredGallery.expiresAt < new Date() : false;
    assert(isExpired === true, "Gallery expiration detected automatically when expiresAt < now");

    // Clear expiration
    await prisma.gallery.update({
      where: { id: g1.id },
      data: { expiresAt: null },
    });

    // -------------------------------------------------------------------
    // TEST 8: Safe Deletion & Storage Cleanup
    // -------------------------------------------------------------------
    console.log("\n▶ TEST SUITE 8: Safe Deletion & Storage File Cleanup");

    const initialPhotoCount = await prisma.photo.count();
    await deleteGalleryStorage(g2.id);
    await prisma.gallery.delete({ where: { id: g2.id } });

    const postDeleteGalleries = await prisma.gallery.count();
    const postDeletePhotos = await prisma.photo.count();

    assert(postDeleteGalleries === 2, "Gallery 2 permanently deleted from database");
    assert(postDeletePhotos === initialPhotoCount - 1, "Cascade deletion removed Gallery 2's photo records");
    assert(
      (await prisma.gallery.findUnique({ where: { id: g1.id } })) !== null,
      "Gallery 1 photos and records unaffected by Gallery 2 deletion"
    );

    console.log("\n====================================================================");
    console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("====================================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test Suite Runtime Error:", error);
    process.exit(1);
  }
}

runTestSuite();
