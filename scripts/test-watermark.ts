import sharp from "sharp";
import fs from "fs";
import path from "path";

async function testWatermark() {
  const width = 1200;
  const height = 800;

  // Create a sample base image
  const baseImg = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 15, g: 30, b: 25, alpha: 1 }
    }
  }).jpeg().toBuffer();

  const minDim = Math.min(width, height);
  const fontSize = Math.max(16, Math.round(minDim * 0.024));
  const padX = Math.round(fontSize * 0.9);
  const padY = Math.round(fontSize * 0.45);
  // Approx width of "LAXMAN M" at this font size
  const textW = Math.round(fontSize * 5.6);
  const pillW = textW + padX * 2 + fontSize * 1.0;
  const pillH = fontSize + padY * 2;
  const margin = Math.round(minDim * 0.035);
  const pillX = width - pillW - margin;
  const pillY = height - pillH - margin;
  const dotX = pillX + padX + fontSize * 0.2;
  const dotY = pillY + pillH / 2;
  const dotRadius = fontSize * 0.22;
  const textX = dotX + dotRadius * 2 + fontSize * 0.4;
  const textY = pillY + pillH / 2 + 1;

  const svgWatermark = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.6"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}"
              fill="#060b08" fill-opacity="0.82" stroke="#00f59b" stroke-opacity="0.5" stroke-width="2"/>
        <circle cx="${dotX}" cy="${dotY}" r="${dotRadius}" fill="#00f59b"/>
        <text x="${textX}" y="${textY}" fill="#ffffff" font-size="${fontSize}px"
              font-family="system-ui, -apple-system, sans-serif" font-weight="700"
              dominant-baseline="central" letter-spacing="1">LAXMAN M</text>
      </g>
    </svg>
  `);

  const result = await sharp(baseImg)
    .composite([{ input: svgWatermark, top: 0, left: 0 }])
    .webp({ quality: 85 })
    .toBuffer();

  const outPath = path.join(process.cwd(), "watermark-test.webp");
  fs.writeFileSync(outPath, result);
  console.log("✓ Watermark generated successfully, size:", result.length, "bytes at", outPath);
}

testWatermark().catch(console.error);
