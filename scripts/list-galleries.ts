import { prisma } from "../src/lib/prisma";

async function main() {
  const galleries = await prisma.gallery.findMany();
  console.log("GALLERIES_COUNT:", galleries.length);
  for (const g of galleries) {
    console.log(`- Slug: ${g.slug} | Title: ${g.title} | Status: ${g.status}`);
  }
}

main().finally(() => prisma.$disconnect());
