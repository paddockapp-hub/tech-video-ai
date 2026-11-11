import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DB } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { transferId } = await req.json();
    if (!transferId) {
      return NextResponse.json({ error: "신청 ID가 필요합니다." }, { status: 400 });
    }

    const transfers = DB.getTransfers();
    const transfer = transfers.find((t) => t.id === transferId);

    if (!transfer) {
      return NextResponse.json({ error: "신청 내역을 찾을 수 없습니다." }, { status: 404 });
    }

    // 본인 신청이거나 관리자인지 검증
    if (transfer.userId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "본인의 신청 내역만 활성화할 수 있습니다." }, { status: 403 });
    }

    if (transfer.status === "completed") {
      return NextResponse.json({ success: true, message: "이미 승인 완료된 멤버십입니다." });
    }

    // 원자적 결제 승인 트랜잭션 실행
    const result = await DB.executePaymentApprovalTransaction(
      transferId,
      "approve",
      user.role === "admin" ? "관리자 수동 즉시 승인" : "사용자 즉시 활성화 승인"
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || "승인 처리 실패" }, { status: result.statusCode || 500 });
    }

    return NextResponse.json({
      success: true,
      message: `축하합니다! ${transfer.tier.toUpperCase()} 멤버십이 즉시 활성화되었습니다.`,
      user: result.user,
      transfer: result.transfer,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "서버 오류" }, { status: 500 });
  }
}

