import QRCode from "qrcode";

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}

export async function generateQRCodeDataUrl(
  url: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const {
    width = 800,
    margin = 2,
    darkColor = "#09090b",
    lightColor = "#ffffff",
  } = options;

  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    type: "image/png",
    width,
    margin,
    color: {
      dark: darkColor,
      light: lightColor,
    },
  });
}

export async function generateQRCodeSvg(
  url: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const {
    width = 800,
    margin = 2,
    darkColor = "#09090b",
    lightColor = "#ffffff",
  } = options;

  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    width,
    margin,
    color: {
      dark: darkColor,
      light: lightColor,
    },
  });
}

export function getFullGalleryUrl(slug: string, reqHost?: string | null): string {
  // If request host is provided, dynamically use it (e.g. 10.23.109.16:3000 or custom domain)
  if (reqHost && !reqHost.includes("localhost")) {
    const proto = reqHost.includes("loca.lt") || reqHost.includes("vercel.app") ? "https" : "http";
    return `${proto}://${reqHost}/g/${slug}`;
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (envUrl && !envUrl.includes("localhost")) {
    return `${envUrl}/g/${slug}`;
  }

  // Fallback: If running on local Wi-Fi, prefer network host or default
  if (reqHost) {
    return `http://${reqHost}/g/${slug}`;
  }

  return `${envUrl || "http://localhost:3000"}/g/${slug}`;
}
