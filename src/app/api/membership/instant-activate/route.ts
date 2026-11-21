import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { DB } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "멤버십 즉시 활성화는 관리자만 가능합니다. 입금 후 확인 요청을 남겨주세요." },
        { status: 403 }
      );
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

    if (transfer.status === "completed") {
      return NextResponse.json({ success: true, message: "이미 승인 완료된 멤버십입니다." });
    }

    // 원자적 결제 승인 트랜잭션 실행
    const result = await DB.executePaymentApprovalTransaction(
      transferId,
      "approve",
      "관리자 수동 즉시 승인"
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

