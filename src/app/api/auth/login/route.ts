import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";
import {
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  seedInitialAdmin,
  getClientIp,
  checkIpRateLimit,
  recordIpAttempt,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await seedInitialAdmin();

    const clientIp = getClientIp(req);

    // 1. IP 기준 글로벌 Rate Limit 검사 (분당 30회 초과 시 5분 차단)
    const ipLimit = checkIpRateLimit(clientIp);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          error: `동일 IP에서 과도한 요청이 발생하여 일시적으로 차단되었습니다. ${ipLimit.remainingSeconds}초 후에 다시 시도해주세요.`,
        },
        { status: 429 }
      );
    }
    recordIpAttempt(clientIp);

    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "이메일과 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 2. 이메일 기준 Brute-force 계정 잠금 검사 (5회 실패 시 15분 차단)
    const emailLimit = checkLoginRateLimit(cleanEmail);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        {
          error: `연속된 로그인 실패로 인해 계정이 일시적으로 보호됩니다. ${emailLimit.remainingSeconds}초 후에 다시 시도해주세요.`,
        },
        { status: 429 }
      );
    }

    const users = DB.getUsers();
    const user = users.find((u) => u.email === cleanEmail);

    if (!user) {
      recordFailedLogin(cleanEmail);
      return NextResponse.json(
        { error: "가입되지 않은 이메일이거나 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    if (user.status === "suspended") {
      return NextResponse.json(
        { error: "이용 정지된 계정입니다. 관리자에게 문의하세요." },
        { status: 403 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      recordFailedLogin(cleanEmail);
      return NextResponse.json(
        { error: "가입되지 않은 이메일이거나 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    // 로그인 성공 시 이메일 실패 기록 초기화
    resetLoginAttempts(cleanEmail);

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    setSessionCookie(token);

    const { passwordHash: _, ...safeUser } = user;
    return NextResponse.json({ success: true, user: safeUser });
  } catch (err: any) {
    return NextResponse.json(
      { error: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
