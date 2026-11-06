import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { DB, User } from "./db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "shortsmaking-super-secure-production-secret-key-2026"
);

const TOKEN_COOKIE = "sm_session";

export interface SessionPayload {
  userId: string;
  email: string;
  role: "user" | "admin";
  name: string;
}

// ---------------------------------------------------------------------------
// Brute-force 방어용 로그인 시도 관리 (이메일 + IP 기반 이중 Rate Limiter)
// ---------------------------------------------------------------------------
interface AttemptRecord {
  count: number;
  lockUntil: number;
}

const loginAttempts = new Map<string, AttemptRecord>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000; // 15분

/**
 * 신뢰할 수 있는 IP 주소 추출 (프록시 헤더 고려)
 * X-Forwarded-For → X-Real-IP → req.socket.remoteAddress 순서로 확인
 */
export function extractClientIP(headers: Headers): string {
  // X-Forwarded-For의 첫 번째 IP가 실제 클라이언트 IP (프록시 체인에서 가장 왼쪽)
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const ips = xff.split(',').map(ip => ip.trim());
    if (ips.length > 0) {
      return ips[0];
    }
  }

  // X-Real-IP 헤더 (Nginx 등에서 사용)
  const xri = headers.get('x-real-ip');
  if (xri) {
    return xri;
  }

  // CF-Connecting-IP (Cloudflare)
  const cfip = headers.get('cf-connecting-ip');
  if (cfip) {
    return cfip;
  }

  return 'unknown';
}

export function checkLoginRateLimit(identifier: string): { allowed: boolean; remainingSeconds?: number } {
  const record = loginAttempts.get(identifier);
  if (!record) return { allowed: true };

  const now = Date.now();
  if (record.lockUntil > now) {
    return {
      allowed: false,
      remainingSeconds: Math.ceil((record.lockUntil - now) / 1000),
    };
  }

  // 락아웃 해제 후 리셋
  if (record.lockUntil <= now && record.count >= MAX_FAILED_ATTEMPTS) {
    loginAttempts.delete(identifier);
  }

  return { allowed: true };
}

export function recordFailedLogin(identifier: string): void {
  const now = Date.now();
  const record = loginAttempts.get(identifier) || { count: 0, lockUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockUntil = now + LOCKOUT_TIME_MS;
  }
  loginAttempts.set(identifier, record);
}

export function resetLoginAttempts(identifier: string): void {
  loginAttempts.delete(identifier);
}

// ---------------------------------------------------------------------------
// 패스워드 및 토큰 유틸리티
// ---------------------------------------------------------------------------
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * 현재 로그인 사용자 검증 (세션 토큰 + DB 실시간 상태 교차 검증)
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const users = DB.getUsers();
  const user = users.find((u) => u.id === session.userId);
  if (!user || user.status === "suspended") return null;

  // 결제일/활성화일 기준 30일 주기 리셋 정책
  const now = new Date();
  if (user.nextResetDate && new Date(user.nextResetDate) <= now) {
    const nextDate = new Date(user.nextResetDate);
    while (nextDate <= now) {
      nextDate.setDate(nextDate.getDate() + 30);
    }
    user.usedCredits = 0; // 정기 한도 사용량만 0으로 초기화 (보너스 크레딧은 보존)
    user.nextResetDate = nextDate.toISOString();
    user.updatedAt = now.toISOString();
    DB.setUsers(users);
  }

  return user;
}

/**
 * 관리자 권한 엄격 검증
 */
export async function requireAdmin(): Promise<User | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || user.status !== "active") {
    return null;
  }
  return user;
}

export function setSessionCookie(token: string) {
  const cookieStore = cookies();
  cookieStore.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.set(TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * 기본 관리자 계정 시딩
 * 환경변수 ADMIN_INITIAL_PASSWORD, ADMIN_INITIAL_EMAIL 우선 적용
 */
export async function seedInitialAdmin(): Promise<void> {
  const users = DB.getUsers();
  if (!users.some((u) => u.role === "admin")) {
    const adminEmail = process.env.ADMIN_INITIAL_EMAIL || "admin@shortsmaking.ai";
    const initialPass = process.env.ADMIN_INITIAL_PASSWORD || "admin1234!";

    if (process.env.NODE_ENV === "production" && !process.env.ADMIN_INITIAL_PASSWORD) {
      console.warn("⚠️ [SECURITY WARNING] 운영 환경에서 ADMIN_INITIAL_PASSWORD 환경변수가 설정되지 않아 기본 비밀번호가 적용되었습니다. 즉시 비밀번호를 변경하세요!");
    }

    const hash = await hashPassword(initialPass);
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);

    const admin: User = {
      id: "admin_root",
      email: adminEmail,
      passwordHash: hash,
      name: "최고 관리자",
      role: "admin",
      status: "active",
      membershipTier: "premium",
      monthlyLimit: 9999,
      usedCredits: 0,
      bonusCredits: 9999,
      nextResetDate: nextMonth.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    users.push(admin);
    DB.setUsers(users);
  }
}
