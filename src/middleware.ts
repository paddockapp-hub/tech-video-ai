import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Vercel 및 모든 환경에서 정상 통과
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
