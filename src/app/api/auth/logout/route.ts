import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  clearSessionCookie();
  return NextResponse.json({ success: true, message: "로그아웃되었습니다." });
}

