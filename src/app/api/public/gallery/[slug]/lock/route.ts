import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findGalleryBySlug } from "@/lib/galleryResolver";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const gallery = await findGalleryBySlug(slug, {
      select: { id: true },
    });

    const response = NextResponse.json({ success: true, message: "Gallery locked." });
    if (gallery) {
      response.cookies.delete(`g_session_${gallery.id}`);
    }
    return response;
  } catch {
    return NextResponse.json({ success: true });
  }
}
