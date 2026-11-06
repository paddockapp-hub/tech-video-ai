import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DB } from "@/lib/db";

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

  const users = DB.getUsers();
  const transfers = DB.getTransfers();
  const videoLogs = DB.getVideoLogs();
  const logs = DB.getLogs().slice(0, 50);

  // 회원 등급별 집계
  const tierCounts = {
    free: 0,
    basic: 0,
    standard: 0,
    premium: 0,
  };
  users.forEach((u) => {
    if (tierCounts[u.membershipTier] !== undefined) {
      tierCounts[u.membershipTier]++;
    }
  });

  // 입금 현황 집계
  const pendingTransfers = transfers.filter(
    (t) => t.status === "pending_deposit" || t.status === "verifying"
  ).length;

  const totalRevenueKRW = transfers
    .filter((t) => t.status === "completed")
    .reduce((sum, t) => sum + (t.amountKRW || 0), 0);

  // 영상 생성 통계
  const totalGenerations = videoLogs.length;
  const successCount = videoLogs.filter((v) => v.status === "success").length;
  const failCount = videoLogs.filter((v) => v.status === "failed").length;
  const successRate =
    totalGenerations > 0
      ? Math.round((successCount / totalGenerations) * 100)
      : 100;

  // 예상 API 비용 (편당 약 25원)
  const totalEstimatedCostKRW = videoLogs.reduce(
    (sum, v) => sum + (v.costEstimatedKRW || 25),
    0
  );

  return NextResponse.json({
    summary: {
      totalUsers: users.length,
      tierCounts,
      pendingTransfers,
      totalRevenueKRW,
      totalGenerations,
      successCount,
      failCount,
      successRate,
      totalEstimatedCostKRW,
    },
    recentLogs: logs,
  });
}

