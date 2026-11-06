import { NextRequest, NextResponse } from "next/server";
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

  const transfers = DB.getTransfers();
  return NextResponse.json({ transfers });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { transferId, action, adminMemo } = await req.json();

  if (!transferId || !action) {
    return NextResponse.json({ error: "필수 파라미터가 누락되었습니다." }, { status: 400 });
  }

  // ⑤ 단일 원자적 트랜잭션 (All-or-Nothing 롤백 보장)
  const txResult = await DB.executePaymentApprovalTransaction(
    transferId,
    action,
    adminMemo
  );

  if (!txResult.success || !txResult.transfer) {
    return NextResponse.json(
      { error: txResult.error || "처리 실패" },
      { status: txResult.statusCode || 400 }
    );
  }

  DB.addLog({
    adminId: admin.id,
    adminEmail: admin.email,
    action: `TRANSFER_${action.toUpperCase()}`,
    targetId: txResult.transfer.id,
    details: {
      userId: txResult.transfer.userId,
      tier: txResult.transfer.tier,
      amountKRW: txResult.transfer.amountKRW,
      depositCode: txResult.transfer.depositCode,
      adminMemo,
    },
  });

  return NextResponse.json({ success: true, transfer: txResult.transfer });
}
