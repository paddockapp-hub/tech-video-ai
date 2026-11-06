import { NextRequest, NextResponse } from "next/server";
import { DB, User } from "@/lib/db";
import { hashPassword, createSessionToken, setSessionCookie, seedInitialAdmin, checkLoginRateLimit, recordFailedLogin, extractClientIP } from "@/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    await seedInitialAdmin();

    const body = await req.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "이메일, 비밀번호, 이름을 모두 입력해주세요." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name).trim();
    const clientIP = extractClientIP(req.headers);

    // IP 기반 회원가입 제한 (여러 이메일로 대량 가입 방지)
    const ipRateLimit = checkLoginRateLimit(`register_ip:${clientIP}`);
    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        {
          error: `동일 IP에서 과도한 가입 시도가 감지되었습니다. ${ipRateLimit.remainingSeconds}초 후에 다시 시도해주세요.`,
        },
        { status: 429 }
      );
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json(
        { error: "올바른 이메일 형식을 입력해주세요." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "비밀번호는 보안을 위해 최소 8자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    if (cleanName.length < 2 || cleanName.length > 30) {
      return NextResponse.json(
        { error: "이름은 2자 이상 30자 이하로 입력해주세요." },
        { status: 400 }
      );
    }

    const result = await DB.updateUsersAtomic<{ success: boolean; user?: User; error?: string }>((users) => {
      if (users.some((u) => u.email === cleanEmail)) {
        recordFailedLogin(`register_ip:${clientIP}`);
        return { users, result: { success: false, error: "이미 가입된 이메일 주소입니다." } };
      }

      const config = DB.getConfig();
      const now = new Date();
      const nextMonth = new Date(now);
      nextMonth.setDate(nextMonth.getDate() + 30);

      // 비밀번호는 async로 해싱하여 아래서 처리
      const newUser: User = {
        id: "usr_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        email: cleanEmail,
        passwordHash: "", // placeholder
        name: cleanName,
        role: "user",
        status: "active",
        membershipTier: "free",
        monthlyLimit: config.tierLimits.free ?? 3,
        usedCredits: 0,
        bonusCredits: 0,
        nextResetDate: nextMonth.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      return { users: [...users, newUser], result: { success: true, user: newUser } };
    });

    if (!result.success || !result.user) {
      return NextResponse.json({ error: result.error || "가입 실패" }, { status: 400 });
    }

    // 비밀번호 해시 업데이트
    const hash = await hashPassword(password);
    await DB.updateUsersAtomic((users) => {
      const idx = users.findIndex((u) => u.id === result.user!.id);
      if (idx !== -1) {
        users[idx].passwordHash = hash;
      }
      return { users, result: null };
    });

    const token = await createSessionToken({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      name: result.user.name,
    });

    setSessionCookie(token);

    const { passwordHash: _, ...safeUser } = result.user;
    return NextResponse.json({ success: true, user: safeUser });
  } catch (err: any) {
    return NextResponse.json(
      { error: "회원가입 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
