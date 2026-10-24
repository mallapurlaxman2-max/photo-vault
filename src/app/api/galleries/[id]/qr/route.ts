import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQRCodeDataUrl, generateQRCodeSvg, getFullGalleryUrl } from "@/lib/qr";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await getOwnerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json"; // "png" | "svg" | "json"

    const gallery = await prisma.gallery.findUnique({
      where: { id },
      select: { id: true, slug: true, title: true, clientName: true },
    });

    if (!gallery) {
      return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
    }

    const publicUrl = getFullGalleryUrl(gallery.slug);

    if (format === "svg") {
      const svg = await generateQRCodeSvg(publicUrl, { width: 1200, margin: 2 });
      return new Response(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Content-Disposition": `attachment; filename="qr-${gallery.slug}.svg"`,
        },
      });
    }

    if (format === "png") {
      const dataUrl = await generateQRCodeDataUrl(publicUrl, { width: 1200, margin: 2 });
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      return new Response(buffer, {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="qr-${gallery.slug}.png"`,
        },
      });
    }

    // Default JSON response
    const pngDataUrl = await generateQRCodeDataUrl(publicUrl, { width: 1000, margin: 2 });
    const svgContent = await generateQRCodeSvg(publicUrl, { width: 1000, margin: 2 });

    return NextResponse.json({
      title: gallery.title,
      clientName: gallery.clientName,
      publicUrl,
      pngDataUrl,
      svgContent,
    });
  } catch (error: any) {
    console.error("QR generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate QR code." },
      { status: 500 }
    );
  }
}
