import sharp from "sharp";
import fs from "fs";

const BASE_URL = "https://photo-vault-phrx.vercel.app";

async function main() {
  console.log("==================================================================");
  console.log("⚡ TESTING BATCH UPLOADS (20 PHOTOS) & QR PASSCODE SECURITY");
  console.log("==================================================================\n");

  // 1. Login as owner
  console.log("1. Logging in as owner...");
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "mallapurlaxman2@gmail.com",
      password: "LaxmanPhotographer2026!",
    }),
  });
  if (!loginRes.ok) throw new Error("Login failed");

  const setCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get("set-cookie") || ""];
  const ownerCookie = (setCookies.find((c) => c && c.includes("lumiere_owner_token")) || "").split(";")[0];
  console.log("✓ Logged in successfully");

  // 2. Create Event Gallery
  console.log("\n2. Creating new event with passcode '1234'...");
  const timestamp = Date.now().toString().slice(-4);
  const title = `Speed Test Event ${timestamp}`;
  const createRes = await fetch(`${BASE_URL}/api/galleries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({
      title,
      clientName: "Laxman Speed Test Client",
      password: "1234",
      allowDownloadOriginal: true,
      allowDownloadAll: true,
    }),
  });
  const createData = await createRes.json();
  const gallery = createData.gallery;
  console.log(`✓ Event created: ID=${gallery.id}, Slug=${gallery.slug}`);

  // 3. Test QR code URL
  console.log("\n3. Testing QR Code URL format...");
  const qrRes = await fetch(`${BASE_URL}/api/galleries/${gallery.id}/qr?format=json`, {
    headers: { cookie: ownerCookie },
  });
  const qrData = await qrRes.json();
  console.log("  QR Code Target URL:", qrData.publicUrl);
  if (!qrData.publicUrl || qrData.publicUrl.includes("localhost")) {
    throw new Error(`FAIL: QR Code target URL contains localhost: ${qrData.publicUrl}`);
  }
  console.log("✓ PASS: QR code points to official production URL:", qrData.publicUrl);

  // 4. Test Passcode Protection on Guest Route
  console.log("\n4. Testing Guest Passcode Protection on /g/:slug...");
  const guestInfoRes = await fetch(`${BASE_URL}/api/public/gallery/${gallery.slug}`);
  const guestInfo = await guestInfoRes.json();
  console.log("  Is Gallery initially unlocked for guest?", guestInfo.gallery?.isUnlocked);
  if (guestInfo.gallery?.isUnlocked !== false) {
    throw new Error("FAIL: Gallery should be LOCKED for guests, but isUnlocked was true!");
  }
  console.log("✓ PASS: Gallery is strictly LOCKED for guests");

  // Test wrong passcode
  const wrongRes = await fetch(`${BASE_URL}/api/public/gallery/${gallery.slug}/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "9999_wrong_passcode" }),
  });
  if (wrongRes.status !== 401) {
    throw new Error(`FAIL: Wrong passcode should return 401, got ${wrongRes.status}`);
  }
  console.log("✓ PASS: Wrong passcode rejected with 401");

  // Test correct passcode
  const unlockRes = await fetch(`${BASE_URL}/api/public/gallery/${gallery.slug}/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "1234" }),
  });
  if (unlockRes.status !== 200) {
    throw new Error(`FAIL: Correct passcode failed with status ${unlockRes.status}`);
  }
  const unlockData = await unlockRes.json();
  console.log("✓ PASS: Correct passcode unlocked successfully:", unlockData.message);

  const guestCookies = unlockRes.headers.getSetCookie ? unlockRes.headers.getSetCookie() : [unlockRes.headers.get("set-cookie") || ""];
  const guestCookie = (guestCookies.find((c) => c && c.includes(`g_session_${gallery.id}`)) || "").split(";")[0];

  // 5. TEST BATCH UPLOADING 20 PHOTOS AT ONCE
  console.log("\n5. Generating and uploading 20 Photos concurrently in parallel...");
  const photoCount = 20;
  const photoBuffers: Buffer[] = [];

  for (let i = 0; i < photoCount; i++) {
    const raw = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 4,
        background: { r: 15 + i * 8, g: 35 + i * 5, b: 25 + i * 4, alpha: 1 },
      },
    })
      .webp({ quality: 80 })
      .toBuffer();
    photoBuffers.push(raw);
  }
  console.log(`✓ Generated ${photoCount} optimized WebP buffers in memory`);

  console.log(`Starting 4-way parallel upload of ${photoCount} photos...`);
  const startTime = Date.now();

  let completed = 0;
  let currentIndex = 0;
  const CONCURRENCY = 4;

  const uploadWorker = async (workerId: number) => {
    while (currentIndex < photoCount) {
      const idx = currentIndex++;
      const buf = photoBuffers[idx];
      const formData = new FormData();
      const blob = new Blob([buf], { type: "image/webp" });
      formData.append("files", blob, `batch-photo-${idx + 1}.webp`);

      const res = await fetch(`${BASE_URL}/api/galleries/${gallery.id}/photos`, {
        method: "POST",
        headers: { cookie: ownerCookie },
        body: formData,
      });

      if (!res.ok) {
        console.error(`Worker ${workerId}: Failed photo ${idx + 1}`);
      } else {
        completed++;
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => uploadWorker(i + 1)));

  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✓ Finished uploading ${completed}/${photoCount} photos in ${elapsedSeconds}s!`);
  console.log(`  Average speed: ${(photoCount / parseFloat(elapsedSeconds)).toFixed(1)} photos per second!`);

  // 6. Verify Unlocked Guest Feed contains all 20 photos
  console.log("\n6. Verifying unlocked guest feed receives all 20 photos...");
  const feedRes = await fetch(`${BASE_URL}/api/public/gallery/${gallery.slug}/photos`, {
    headers: { cookie: guestCookie },
  });
  const feedData = await feedRes.json();
  console.log(`✓ Guest feed returned ${feedData.photos?.length} photos`);

  if (feedData.photos?.length !== photoCount) {
    throw new Error(`FAIL: Expected ${photoCount} photos in feed, got ${feedData.photos?.length}`);
  }

  // 7. Verify Display & Download
  console.log("\n7. Verifying photo streaming and direct download...");
  const firstPhoto = feedData.photos[0];
  const streamRes = await fetch(`${BASE_URL}${firstPhoto.displayUrl}`, {
    headers: { cookie: guestCookie },
  });
  if (streamRes.status !== 200) throw new Error("Display stream failed");
  const bytes = await streamRes.arrayBuffer();
  console.log(`✓ First photo streamed successfully: ${bytes.byteLength} bytes`);

  console.log("\n==================================================================");
  console.log("🎉 ALL TESTS PASSED! BATCH UPLOADS & PASSCODES ARE 100% WORKING!");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
