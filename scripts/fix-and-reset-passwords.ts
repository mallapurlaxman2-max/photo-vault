import { prisma } from "../src/lib/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth";

async function main() {
  // 1. Hash passcode 1234
  const pass1234 = await hashPassword("1234");

  // 2. Update all galleries to have passcode 1234
  const updated = await prisma.gallery.updateMany({
    data: {
      passwordHash: pass1234,
      status: "ACTIVE",
    },
  });
  console.log(`Updated ${updated.count} galleries to passcode '1234'.`);

  // 3. Clear all rate limit records to prevent lockouts
  const deletedLimits = await prisma.rateLimitRecord.deleteMany({});
  console.log(`Cleared ${deletedLimits.count} rate limit lockout records.`);

  // 4. Verify each gallery
  const galleries = await prisma.gallery.findMany();
  for (const g of galleries) {
    const verified = await verifyPassword("1234", g.passwordHash);
    console.log(`✓ Verified gallery '${g.title}' (${g.slug}) with passcode '1234': ${verified}`);
  }
}

main().finally(() => prisma.$disconnect());
