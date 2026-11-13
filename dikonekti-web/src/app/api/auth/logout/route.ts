import { NextResponse } from "next/server";
import { clearSessionCookies } from "@/lib/session";

export async function POST() {
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookies(response);
  return response;
}
