import sharp from "sharp";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const BASE_URL = "https://photo-vault-phrx.vercel.app";

async function runTestSuite() {
  console.log("==================================================================");
  console.log("🚀 STARTING EXHAUSTIVE VERIFICATION FOR BA PHOTO VAULT");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail: string = "") {
    if (condition) {
      console.log(`  ✓ [PASS] ${testName} ${detail ? "(" + detail + ")" : ""}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${testName} ${detail ? "(" + detail + ")" : ""}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Homepage & Brand Metadata
  // -------------------------------------------------------------
  console.log("Step 1: Checking Live Deployment & Branding...");
  const homeRes = await fetch(BASE_URL);
  assert(homeRes.status === 200, "Homepage HTTP 200", `status=${homeRes.status}`);
  const homeHtml = await homeRes.text();
  assert(homeHtml.includes("BA Photo Vault"), "Homepage Title & Branding", "contains BA Photo Vault");
  assert(homeHtml.includes("LAXMAN M"), "Homepage Subtitle / Watermark Brand", "contains LAXMAN M");

  // Manifest check
  const manifestRes = await fetch(`${BASE_URL}/manifest.json`);
  const manifestData = await manifestRes.json();
  assert(manifestData.name === "BA Photo Vault", "PWA Manifest App Name", manifestData.name);
  assert(manifestData.short_name === "BA Vault", "PWA Manifest Short Name", manifestData.short_name);

  // -------------------------------------------------------------
  // TEST 2: Owner Authentication (Laxman M)
  // -------------------------------------------------------------
  console.log("\nStep 2: Authenticating as Owner (mallapurlaxman2@gmail.com)...");
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "mallapurlaxman2@gmail.com",
      password: "LaxmanPhotographer2026!",
    }),
  });

  assert(loginRes.status === 200, "Owner Login HTTP 200", `status=${loginRes.status}`);
  const setCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get("set-cookie") || ""];
  const rawCookie = setCookies.find((c) => c && c.includes("lumiere_owner_token")) || "";
  assert(rawCookie.includes("lumiere_owner_token"), "Owner Session Cookie Received");

  const sessionCookie = rawCookie.split(";")[0];

  // Verify /api/auth/me
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { cookie: sessionCookie },
  });
  const meData = await meRes.json();
  assert(meData.authenticated === true, "Owner Authenticated Status", `authenticated=${meData.authenticated}`);
  assert(meData.owner?.name === "Laxman M", "Owner Name Match", meData.owner?.name);
  assert(meData.owner?.studioName === "Laxman Photography Studio", "Studio Name Match", meData.owner?.studioName);

  // -------------------------------------------------------------
  // TEST 3: Create New Gallery (Event)
  // -------------------------------------------------------------
  console.log("\nStep 3: Creating New Event Gallery...");
  const timestamp = Date.now().toString().slice(-4);
  const galleryTitle = `Laxman Grand Event ${timestamp}`;
  const galleryClient = "Priya & Rohan";
  const galleryPasscode = "1234";

  const createRes = await fetch(`${BASE_URL}/api/galleries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: sessionCookie,
    },
    body: JSON.stringify({
      title: galleryTitle,
      clientName: galleryClient,
      password: galleryPasscode,
      allowDownloadOriginal: true,
      allowDownloadAll: true,
    }),
  });

  assert(createRes.status === 200 || createRes.status === 201, "Gallery Creation Success", `status=${createRes.status}`);
  const createData = await createRes.json();
  const gallery = createData.gallery;
  assert(Boolean(gallery && gallery.id), "Gallery Object & ID created", gallery?.id);
  assert(Boolean(gallery && gallery.slug), "Gallery Slug created", gallery?.slug);

  // -------------------------------------------------------------
  // TEST 4: Generate & Upload High-Res Watermarked Photo
  // -------------------------------------------------------------
  console.log("\nStep 4: Uploading Watermarked Photo to Gallery...");
  const width = 1600;
  const height = 1060;
  const rawBase = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 12, g: 38, b: 28, alpha: 1 },
    },
  })
    .jpeg()
    .toBuffer();

  const minDim = Math.min(width, height);
  const fontSize = Math.max(16, Math.round(minDim * 0.024));
  const padX = Math.round(fontSize * 0.85);
  const padY = Math.round(fontSize * 0.42);
  const textW = Math.round(fontSize * 5.6);
  const pillW = textW + padX * 2 + fontSize * 1.0;
  const pillH = fontSize + padY * 2;
  const margin = Math.round(minDim * 0.035);
  const pillX = width - pillW - margin;
  const pillY = height - pillH - margin;
  const dotX = pillX + padX + fontSize * 0.15;
  const dotY = pillY + pillH / 2;
  const dotRadius = fontSize * 0.22;
  const textX = dotX + dotRadius * 2 + fontSize * 0.35;
  const textY = pillY + pillH / 2;

  const svgWatermark = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="wmShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.6"/>
        </filter>
      </defs>
      <g filter="url(#wmShadow)">
        <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}"
              fill="#060b08" fill-opacity="0.82" stroke="#00f59b" stroke-opacity="0.5" stroke-width="2"/>
        <circle cx="${dotX}" cy="${dotY}" r="${dotRadius}" fill="#00f59b"/>
        <text x="${textX}" y="${textY}" fill="#ffffff" font-size="${fontSize}px"
              font-family="system-ui, -apple-system, sans-serif" font-weight="700"
              dominant-baseline="central">LAXMAN M</text>
      </g>
    </svg>
  `);

  const optimizedWatermarkedWebP = await sharp(rawBase)
    .composite([{ input: svgWatermark, top: 0, left: 0 }])
    .webp({ quality: 88 })
    .toBuffer();

  const formData = new FormData();
  const fileBlob = new Blob([optimizedWatermarkedWebP], { type: "image/webp" });
  formData.append("files", fileBlob, "grand-ceremony.webp");

  const uploadRes = await fetch(`${BASE_URL}/api/galleries/${gallery.id}/photos`, {
    method: "POST",
    headers: { cookie: sessionCookie },
    body: formData,
  });

  assert(uploadRes.status === 200, "Photo Upload HTTP 200", `status=${uploadRes.status}`);
  const uploadData = await uploadRes.json();
  assert(uploadData.uploadedCount === 1, "Uploaded Photo Count == 1", `count=${uploadData.uploadedCount}`);
  const uploadedPhoto = uploadData.photos?.[0];
  assert(Boolean(uploadedPhoto && uploadedPhoto.id), "Photo ID Generated", uploadedPhoto?.id);

  // -------------------------------------------------------------
  // TEST 5: Verify QR Code Generation
  // -------------------------------------------------------------
  console.log("\nStep 5: Verifying Event QR Code...");
  const qrRes = await fetch(`${BASE_URL}/api/galleries/${gallery.id}/qr?format=json`, {
    headers: { cookie: sessionCookie },
  });
  assert(qrRes.status === 200, "QR Code HTTP 200", `status=${qrRes.status}`);
  const qrData = await qrRes.json();
  assert(qrData.pngDataUrl?.startsWith("data:image/png;base64,"), "Valid Base64 PNG QR Code returned");

  // -------------------------------------------------------------
  // TEST 6: Public Guest Flow (Locked -> Passcode -> Unlocked)
  // -------------------------------------------------------------
  console.log("\nStep 6: Testing Guest Security & Passcode Unlock...");
  const publicGalleryRes = await fetch(`${BASE_URL}/api/public/gallery/${gallery.slug}`);
  assert(publicGalleryRes.status === 200, "Public Gallery Page HTTP 200");
  const publicData = await publicGalleryRes.json();
  assert(publicData.gallery?.isUnlocked === false, "Gallery is initially LOCKED for guests");

  // Brute force test: Wrong passcode
  const wrongUnlockRes = await fetch(`${BASE_URL}/api/public/gallery/${gallery.slug}/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "wrong_password_9999" }),
  });
  assert(wrongUnlockRes.status === 401, "Wrong Passcode Rejected (HTTP 401)");

  // Correct passcode unlock
  const unlockRes = await fetch(`${BASE_URL}/api/public/gallery/${gallery.slug}/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: galleryPasscode }),
  });
  assert(unlockRes.status === 200, "Correct Passcode Unlocks Gallery (HTTP 200)");
  const unlockData = await unlockRes.json();
  assert(unlockData.success === true, "Unlock Success Flag == true");

  const guestSetCookies = unlockRes.headers.getSetCookie ? unlockRes.headers.getSetCookie() : [unlockRes.headers.get("set-cookie") || ""];
  const guestRawCookie = guestSetCookies.find((c) => c && c.includes(`g_session_${gallery.id}`)) || "";
  const guestCookie = guestRawCookie.split(";")[0];
  assert(Boolean(guestCookie), "Guest Session Cookie Received", guestCookie);

  // Fetch unlocked photos feed
  const photosFeedRes = await fetch(`${BASE_URL}/api/public/gallery/${gallery.slug}/photos`, {
    headers: { cookie: guestCookie },
  });
  assert(photosFeedRes.status === 200, "Unlocked Photos Feed HTTP 200");
  const photosFeedData = await photosFeedRes.json();
  assert(photosFeedData.photos?.length >= 1, "Unlocked Photos Feed length >= 1", `length=${photosFeedData.photos?.length}`);

  // -------------------------------------------------------------
  // TEST 7: Photo Display & Download
  // -------------------------------------------------------------
  console.log("\nStep 7: Testing Photo Viewing & Direct Download...");
  const photoId = uploadedPhoto.id;
  const displayUrl = `${BASE_URL}/api/public/gallery/${gallery.slug}/photo/${photoId}?type=display`;
  const photoDisplayRes = await fetch(displayUrl, {
    headers: { cookie: guestCookie },
  });
  assert(photoDisplayRes.status === 200, "Display Photo Stream HTTP 200");
  const displayBytes = await photoDisplayRes.arrayBuffer();
  assert(displayBytes.byteLength > 1000, "Display Photo Buffer > 1KB", `${displayBytes.byteLength} bytes`);

  const downloadUrl = `${BASE_URL}/api/public/gallery/${gallery.slug}/download/${photoId}`;
  const downloadRes = await fetch(downloadUrl, {
    headers: { cookie: guestCookie },
  });
  assert(downloadRes.status === 200, "Direct Download Photo HTTP 200");
  const downloadBytes = await downloadRes.arrayBuffer();
  assert(downloadBytes.byteLength > 1000, "Downloaded Photo File > 1KB", `${downloadBytes.byteLength} bytes`);

  // -------------------------------------------------------------
  // TEST 8: Standalone Native Android APK Verification
  // -------------------------------------------------------------
  console.log("\nStep 8: Verifying Standalone Native Android APK...");
  const apkPath = "c:\\Users\\asus\\Downloads\\web designer\\BA-Photo-Vault.apk";
  assert(fs.existsSync(apkPath), "APK File exists at project root", apkPath);

  const stats = fs.statSync(apkPath);
  assert(stats.size > 30000, "APK File Size valid", `${stats.size} bytes`);

  // Verify apksigner
  const apksignerOutput = execSync(
    `cmd.exe /c "set JAVA_HOME=C:\\Program Files\\Android\\Android Studio\\jbr&& set PATH=%JAVA_HOME%\\bin;%PATH%&& \"C:\\Users\\asus\\AppData\\Local\\Android\\Sdk\\build-tools\\36.0.0\\apksigner.bat\" verify --verbose \"${apkPath}\""`,
    { encoding: "utf8" }
  );
  assert(apksignerOutput.includes("Verified using v1 scheme") && apksignerOutput.includes("true"), "APK v1 Scheme Verified");
  assert(apksignerOutput.includes("Verified using v2 scheme") && apksignerOutput.includes("true"), "APK v2 Scheme Verified");

  // Verify badging
  const badgingOutput = execSync(
    `cmd.exe /c "\"C:\\Users\\asus\\AppData\\Local\\Android\\Sdk\\build-tools\\36.0.0\\aapt2.exe\" dump badging \"${apkPath}\""`,
    { encoding: "utf8" }
  );
  assert(badgingOutput.includes("package: name='com.laxman.baphotovault'"), "APK Package: com.laxman.baphotovault");
  assert(badgingOutput.includes("application-label:'BA Photo Vault'"), "APK Label: 'BA Photo Vault'");
  assert(badgingOutput.includes("launchable-activity: name='com.laxman.baphotovault.MainActivity'"), "APK Launchable MainActivity");

  console.log("\n==================================================================");
  console.log(`🏁 TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
