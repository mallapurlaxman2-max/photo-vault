import sharp from "sharp";
import path from "path";

async function makeTestPhoto() {
  const file = path.join(process.cwd(), "test-photo.jpg");
  await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 0, g: 245, b: 155 } }
  }).jpeg({ quality: 90 }).toFile(file);
  console.log("Created", file);
}

makeTestPhoto();
