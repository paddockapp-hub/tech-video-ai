import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DB, SystemConfig } from "@/lib/db";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  return NextResponse.json({ config: DB.getConfig() });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const updates: Partial<SystemConfig> = await req.json();
  const current = DB.getConfig();

  const nextConfig: SystemConfig = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  DB.setConfig(nextConfig);

  DB.addLog({
    adminId: admin.id,
    adminEmail: admin.email,
    action: "UPDATE_CONFIG",
    details: updates,
  });

  return NextResponse.json({ success: true, config: nextConfig });
}

