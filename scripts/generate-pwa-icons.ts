import sharp from "sharp";
import fs from "fs";
import path from "path";

async function generateIcons() {
  const dir = path.join(process.cwd(), "public", "icons");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const svgIcon = (size: number) => `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#00f59b" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#060b08" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00f59b"/>
          <stop offset="100%" stop-color="#059669"/>
        </linearGradient>
      </defs>
      <!-- Background -->
      <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#060b08"/>
      <circle cx="${size/2}" cy="${size/2}" r="${size * 0.45}" fill="url(#glow)"/>
      <rect x="${size * 0.05}" y="${size * 0.05}" width="${size * 0.9}" height="${size * 0.9}" rx="${size * 0.2}" fill="none" stroke="#00f59b" stroke-opacity="0.3" stroke-width="${size * 0.015}"/>

      <!-- BA Monogram Badge -->
      <rect x="${size * 0.22}" y="${size * 0.2}" width="${size * 0.56}" height="${size * 0.38}" rx="${size * 0.08}" fill="#0b1410" stroke="url(#emeraldGrad)" stroke-width="${size * 0.025}"/>
      <text x="${size * 0.5}" y="${size * 0.45}" fill="#00f59b" font-size="${size * 0.22}px" font-family="system-ui, -apple-system, sans-serif" font-weight="900" text-anchor="middle" dominant-baseline="central">BA</text>

      <!-- Aperture / Dot -->
      <circle cx="${size * 0.7}" y="${size * 0.28}" r="${size * 0.035}" fill="#00f59b"/>

      <!-- Subtitle -->
      <text x="${size * 0.5}" y="${size * 0.7}" fill="#ffffff" font-size="${size * 0.08}px" font-family="system-ui, -apple-system, sans-serif" font-weight="700" text-anchor="middle" letter-spacing="${size * 0.015}">PHOTO VAULT</text>
      <text x="${size * 0.5}" y="${size * 0.81}" fill="#00f59b" font-size="${size * 0.055}px" font-family="system-ui, -apple-system, sans-serif" font-weight="600" text-anchor="middle" letter-spacing="${size * 0.02}">LAXMAN M</text>
    </svg>
  `;

  await sharp(Buffer.from(svgIcon(192))).png().toFile(path.join(dir, "icon-192.png"));
  await sharp(Buffer.from(svgIcon(512))).png().toFile(path.join(dir, "icon-512.png"));
  await sharp(Buffer.from(svgIcon(512))).png().toFile(path.join(dir, "apple-touch-icon.png"));
  console.log("✓ BA Photo Vault icons generated successfully in public/icons/");
}

generateIcons().catch(console.error);
