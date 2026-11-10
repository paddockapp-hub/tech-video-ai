import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DB, OpenAIIntegration } from "@/lib/db";

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  return user;
}

export async function GET() {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const integrations = DB.getOpenAIIntegrations();
  const userIntegration = integrations.find((i) => i.userId === user.id);

  if (userIntegration) {
    const { apiKey, ...safeData } = userIntegration;
    return NextResponse.json({ linked: true, integration: safeData });
  }

  return NextResponse.json({ linked: false });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await req.json();
  const { apiKey, action } = body;

  if (action === "link") {
    if (!apiKey) {
      return NextResponse.json({ error: "API 키가 필요합니다." }, { status: 400 });
    }

    // OpenAI API 키 유효성 검증
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        return NextResponse.json({ error: "유효하지 않은 OpenAI API 키입니다." }, { status: 400 });
      }

      const data = await response.json();
      const balance = data.data?.[0]?.id || "unknown";

      const integration = DB.addOpenAIIntegration({
        userId: user.id,
        apiKey,
        balanceCredits: 0,
      });

      return NextResponse.json({ success: true, integration: { ...integration, apiKey: undefined } });
    } catch (error) {
      return NextResponse.json({ error: "OpenAI API 키 검증 실패" }, { status: 500 });
    }
  }

  if (action === "unlink") {
    const integrations = DB.getOpenAIIntegrations();
    const filtered = integrations.filter((i) => i.userId !== user.id);
    DB.setOpenAIIntegrations(filtered);

    return NextResponse.json({ success: true, message: "연동 해제 완료" });
  }

  if (action === "purchase") {
    const { packageId } = body;
    const config = DB.getConfig();
    const pkg = config.creditPackages.find((p) => p.id === packageId);

    if (!pkg) {
      return NextResponse.json({ error: "존재하지 않는 패키지입니다." }, { status: 404 });
    }

    const integrations = DB.getOpenAIIntegrations();
    const userIntegration = integrations.find((i) => i.userId === user.id);

    if (!userIntegration) {
      return NextResponse.json({ error: "OpenAI 계정이 연동되지 않았습니다." }, { status: 400 });
    }

    // OpenAI API에서 크레딧 차감 (시뮬레이션)
    // 실제로는 OpenAI 사용량과 연동해야 함
    userIntegration.balanceCredits = (userIntegration.balanceCredits || 0) + pkg.credits;
    userIntegration.lastUsedAt = new Date().toISOString();
    DB.addOpenAIIntegration(userIntegration);

    // 사용자 보너스 크레딧 증가
    const users = DB.getUsers();
    const userIdx = users.findIndex((u) => u.id === user.id);

    if (userIdx !== -1) {
      users[userIdx].bonusCredits = (users[userIdx].bonusCredits || 0) + pkg.credits;
      users[userIdx].updatedAt = new Date().toISOString();
      DB.setUsers(users);
    }

    const purchase = DB.addCreditPurchase({
      userId: user.id,
      packageId,
      credits: pkg.credits,
      priceKRW: pkg.priceKRW,
      paymentMethod: "gpt",
      status: "completed",
      gptTransactionId: "gpt_" + Date.now().toString(36),
    });

    return NextResponse.json({ success: true, purchase, credits: pkg.credits });
  }

  return NextResponse.json({ error: "올바르지 않은 action입니다." }, { status: 400 });
}
