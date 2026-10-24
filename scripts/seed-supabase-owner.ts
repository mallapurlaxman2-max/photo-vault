import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const dbUrl = "postgresql://postgres:i9XW%235%23NL.f27gs@db.rdnzjurzbuuiuhynshrk.supabase.co:5432/postgres";
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } }
  });

  const email = "mallapurlaxman2@gmail.com";
  const passHash = await bcrypt.hash("LaxmanPhotographer2026!", 10);

  // Check if owner exists
  let owner = await prisma.owner.findUnique({ where: { email } });
  if (!owner) {
    owner = await prisma.owner.create({
      data: {
        email,
        passwordHash: passHash,
        name: "Laxman M",
        studioName: "Laxman Photography Studio",
        tagline: "Capturing Life's Most Beautiful Moments",
      }
    });
    console.log("✓ Owner account created:", owner.email);
  } else {
    await prisma.owner.update({
      where: { email },
      data: {
        passwordHash: passHash,
        name: "Laxman M",
        studioName: "Laxman Photography Studio"
      }
    });
    console.log("✓ Owner updated:", owner.email, "name: Laxman M");
  }

  // Create demo gallery if none
  const existingG = await prisma.gallery.findFirst();
  if (!existingG) {
    const gPassHash = await bcrypt.hash("1234", 10);
    const g = await prisma.gallery.create({
      data: {
        slug: "rahul-priya-wedding",
        title: "Rahul & Priya Wedding",
        clientName: "Rahul & Priya Sharma",
        passwordHash: gPassHash,
        status: "ACTIVE",
        allowDownloadOriginal: true,
        allowDownloadAll: true,
      }
    });
    console.log("✓ Created demo gallery:", g.title, "passcode: 1234");
  } else {
    console.log("✓ Gallery exists:", existingG.title);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Error seeding owner:", err);
  process.exit(1);
});
