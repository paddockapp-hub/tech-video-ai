import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DB } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { transferId } = await req.json();
  if (!transferId) {
    return NextResponse.json({ error: "신청 ID가 필요합니다." }, { status: 400 });
  }

  const transfers = DB.getTransfers();
  const index = transfers.findIndex(
    (t) => t.id === transferId && t.userId === user.id
  );

  if (index === -1) {
    return NextResponse.json(
      { error: "해당 신청 내역을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const transfer = transfers[index];
  if (transfer.status === "completed") {
    return NextResponse.json(
      { error: "이미 승인 완료된 멤버십입니다." },
      { status: 400 }
    );
  }

  transfer.status = "verifying";
  transfer.updatedAt = new Date().toISOString();
  transfers[index] = transfer;
  DB.setTransfers(transfers);

  return NextResponse.json({
    success: true,
    message: "입금 확인 요청이 접수되었습니다. 관리자 확인 후 즉시 활성화됩니다.",
    transfer,
  });
}

