import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
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
// ③ Rate Limiter (IP 기반 글로벌 제한 + 이메일 기반 Brute-force 듀얼 레이어)
// ---------------------------------------------------------------------------
interface AttemptRecord {
  count: number;
  lockUntil: number;
}

// 1) 이메일별 Brute-Force 기록 (특정 계정 공격 방어)
const emailAttempts = new Map<string, AttemptRecord>();
const MAX_EMAIL_ATTEMPTS = 5;
const EMAIL_LOCKOUT_MS = 15 * 60 * 1000; // 15분

// 2) IP별 스프레이/DDoS 공격 방어 (여러 이메일 무차별 대입 방어)
interface IpWindowRecord {
  count: number;
  windowStart: number;
  lockUntil: number;
}
const ipAttempts = new Map<string, IpWindowRecord>();
const MAX_IP_ATTEMPTS_PER_MINUTE = 30; // 1분에 최대 30회 로그인 시도
const IP_LOCKOUT_MS = 5 * 60 * 1000; // 5분 차단

/**
 * 프록시 헤더(Cloudflare, Nginx, ALB 등) 안전 파싱하여 클라이언트 실제 IP 추출
 */
export const extractClientIP = getClientIp;

export function getClientIp(req: NextRequest | Headers): string {
  const headers = "headers" in req ? req.headers : req;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp) return firstIp;
  }
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

/**
 * IP 기준 글로벌 레이트 리밋 검사
 */
export function checkIpRateLimit(ip: string): { allowed: boolean; remainingSeconds?: number } {
  const now = Date.now();
  const record = ipAttempts.get(ip);
  if (!record) return { allowed: true };

  if (record.lockUntil > now) {
    return {
      allowed: false,
      remainingSeconds: Math.ceil((record.lockUntil - now) / 1000),
    };
  }

  // 1분 윈도우 만료 시 리셋
  if (now - record.windowStart > 60000) {
    ipAttempts.delete(ip);
    return { allowed: true };
  }

  if (record.count >= MAX_IP_ATTEMPTS_PER_MINUTE) {
    record.lockUntil = now + IP_LOCKOUT_MS;
    ipAttempts.set(ip, record);
    return {
      allowed: false,
      remainingSeconds: Math.ceil(IP_LOCKOUT_MS / 1000),
    };
  }

  return { allowed: true };
}

export function recordIpAttempt(ip: string): void {
  const now = Date.now();
  const record = ipAttempts.get(ip) || { count: 0, windowStart: now, lockUntil: 0 };
  if (now - record.windowStart > 60000) {
    record.count = 1;
    record.windowStart = now;
  } else {
    record.count += 1;
  }
  ipAttempts.set(ip, record);
}

/**
 * 이메일 기준 Brute-force 검사
 */
export function checkLoginRateLimit(email: string): { allowed: boolean; remainingSeconds?: number } {
  const record = emailAttempts.get(email);
  if (!record) return { allowed: true };

  const now = Date.now();
  if (record.lockUntil > now) {
    return {
      allowed: false,
      remainingSeconds: Math.ceil((record.lockUntil - now) / 1000),
    };
  }

  if (record.lockUntil <= now && record.count >= MAX_EMAIL_ATTEMPTS) {
    emailAttempts.delete(email);
  }

  return { allowed: true };
}

export function recordFailedLogin(email: string): void {
  const now = Date.now();
  const record = emailAttempts.get(email) || { count: 0, lockUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_EMAIL_ATTEMPTS) {
    record.lockUntil = now + EMAIL_LOCKOUT_MS;
  }
  emailAttempts.set(email, record);
}

export function resetLoginAttempts(email: string): void {
  emailAttempts.delete(email);
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
 */
export async function seedInitialAdmin(): Promise<void> {
  const users = DB.getUsers();
  const adminEmail = (process.env.ADMIN_INITIAL_EMAIL || "admin@shortsmaking.ai").trim().toLowerCase();
  const initialPass = process.env.ADMIN_INITIAL_PASSWORD || "ckdgh0828!";

  const existingAdmin = users.find(
    (u) => u.role === "admin" || u.email.toLowerCase() === adminEmail
  );

  if (!existingAdmin) {
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
  } else {
    // 이미 존재하는 관리자의 비밀번호를 ckdgh0828!로 동기화 검증
    const matches = await verifyPassword(initialPass, existingAdmin.passwordHash);
    if (!matches) {
      existingAdmin.passwordHash = await hashPassword(initialPass);
      existingAdmin.role = "admin";
      existingAdmin.status = "active";
      existingAdmin.updatedAt = new Date().toISOString();
      DB.setUsers(users);
    }
  }
}
