import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DB, User, MembershipTier } from "@/lib/db";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() || "";

  const users = DB.getUsers().map(({ passwordHash: _, ...u }) => u);
  const filtered = q
    ? users.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
      )
    : users;

  return NextResponse.json({ users: filtered });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = await req.json();
  const { userId, action, tier, monthlyLimit, bonusCredits, status } = body;

  const users = DB.getUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index === -1) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const user = users[index];
  const config = DB.getConfig();

  if (action === "update_tier" && tier) {
    user.membershipTier = tier as MembershipTier;
    user.monthlyLimit = config.tierLimits[tier as MembershipTier] ?? user.monthlyLimit;
    user.usedCredits = 0; // 등급 변경 시 리셋
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    user.membershipExpiresAt = expires.toISOString();
  }

  if (action === "adjust_credits") {
    if (typeof monthlyLimit === "number") user.monthlyLimit = Math.max(0, monthlyLimit);
    if (typeof bonusCredits === "number") user.bonusCredits = Math.max(0, bonusCredits);
  }

  if (action === "toggle_status" && status) {
    user.status = status;
  }

  user.updatedAt = new Date().toISOString();
  users[index] = user;
  DB.setUsers(users);

  DB.addLog({
    adminId: admin.id,
    adminEmail: admin.email,
    action: `USER_${action?.toUpperCase() || "UPDATE"}`,
    targetId: user.id,
    details: { body },
  });

  const { passwordHash: _, ...safeUser } = user;
  return NextResponse.json({ success: true, user: safeUser });
}

