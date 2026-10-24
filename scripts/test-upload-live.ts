import fs from "fs";
import path from "path";

async function testUpload() {
  // 1. Log in to get fresh token
  const loginRes = await fetch("https://photo-vault-phrx.vercel.app/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "mallapurlaxman2@gmail.com",
      password: "LaxmanPhotographer2026!"
    })
  });
  const cookie = loginRes.headers.get("set-cookie")?.split(";")[0];
  console.log("Logged in, cookie:", cookie?.substring(0, 30) + "...");

  // 2. Upload photo
  const galleryId = "cmvm5kdp30001jp077fke916x";
  const filePath = path.join(process.cwd(), "test-photo.jpg");
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: "image/jpeg" });

  const formData = new FormData();
  formData.append("files", blob, "emerald-ceremony.jpg");

  console.log("Sending upload request to Vercel...");
  const uploadRes = await fetch(`https://photo-vault-phrx.vercel.app/api/galleries/${galleryId}/photos`, {
    method: "POST",
    headers: {
      cookie: cookie || "",
    },
    body: formData,
  });

  console.log("Upload status:", uploadRes.status);
  const resBody = await uploadRes.text();
  console.log("Upload response:", resBody);
}

testUpload();
