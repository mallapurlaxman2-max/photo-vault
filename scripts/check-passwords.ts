import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const galleries = await prisma.gallery.findMany();
  for (const g of galleries) {
    const is1234 = await bcrypt.compare("1234", g.passwordHash);
    console.log(`Gallery: ${g.slug} | title: ${g.title} | matches '1234': ${is1234}`);
  }
}

main().finally(() => prisma.$disconnect());
