import { NextRequest, NextResponse } from "next/server";

const STORAGE_BACKED_API_PREFIXES = [
  "/api/auth",
  "/api/admin",
  "/api/membership",
  "/api/tts",
];

export function middleware(request: NextRequest) {
  if (
    (process.env.VERCEL === "1" || request.headers.has("x-vercel-id")) &&
    STORAGE_BACKED_API_PREFIXES.some((prefix) =>
      request.nextUrl.pathname.startsWith(prefix)
    )
  ) {
    return NextResponse.json(
      {
        error:
          "계정·관리자·결제 및 TTS 기능은 영구 저장소와 서비스 설정이 완료될 때까지 사용할 수 없습니다.",
        code: "PERSISTENT_STORAGE_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }
}

export const config = {
  matcher: ["/api/auth/:path*", "/api/admin/:path*", "/api/membership/:path*", "/api/tts"],
};
