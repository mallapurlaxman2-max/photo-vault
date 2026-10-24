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
  // If request host is provided and NOT localhost, dynamically use it
  if (reqHost && !reqHost.includes("localhost") && !reqHost.startsWith("127.")) {
    const proto = reqHost.includes("vercel.app") || !reqHost.includes(":") ? "https" : "http";
    return `${proto}://${reqHost}/g/${slug}`;
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (envUrl && !envUrl.includes("localhost") && !envUrl.startsWith("http://127.")) {
    return `${envUrl}/g/${slug}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/g/${slug}`;
  }

  // Official production URL for BA Photo Vault
  return `https://photo-vault-phrx.vercel.app/g/${slug}`;
}
