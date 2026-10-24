import { prisma } from "./prisma";

export async function findGalleryBySlug(slug: string, options: any = {}): Promise<any> {
  // 1. Exact match
  let gallery = await (prisma.gallery as any).findUnique({
    where: { slug },
    ...options,
  });

  if (!gallery) {
    // 2. StartsWith / partial match
    gallery = await (prisma.gallery as any).findFirst({
      where: {
        OR: [
          { slug: { startsWith: slug } },
          { slug: { contains: slug } },
        ],
      },
      ...options,
    });
  }

  return gallery;
}
