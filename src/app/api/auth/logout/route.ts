import { NextResponse } from "next/server";
import { OWNER_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out successfully." });
  response.cookies.delete(OWNER_COOKIE_NAME);
  return response;
}
