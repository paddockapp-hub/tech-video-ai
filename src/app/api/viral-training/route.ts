import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DB } from "@/lib/db";
import { viralModel, ViralExample, ViralFeatures } from "@/lib/viral-predictor";

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

  const trainingData = viralModel.exportTrainingData();
  return NextResponse.json({ examples: trainingData, count: trainingData.length });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = await req.json();
  const { action, example } = body;

  if (action === "add" && example) {
    viralModel.addExample(example);
    DB.addLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "VIRAL_TRAINING_ADD",
      details: { category: example.category, engagement: example.engagement },
    });
    return NextResponse.json({ success: true, message: "학습 데이터 추가 완료" });
  }

  if (action === "batch" && Array.isArray(body.examples)) {
    for (const ex of body.examples) {
      viralModel.addExample(ex);
    }
    DB.addLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "VIRAL_TRAINING_BATCH",
      details: { count: body.examples.length },
    });
    return NextResponse.json({ success: true, message: `${body.examples.length}개 학습 데이터 추가 완료` });
  }

  if (action === "predict" && body.features) {
    const score = viralModel.predictViralScore(body.features);
    return NextResponse.json({ success: true, viralScore: score });
  }

  if (action === "recommend" && body.category) {
    const features = viralModel.recommendFeatures(body.category, body.script || "");
    return NextResponse.json({ success: true, recommendedFeatures: features });
  }

  return NextResponse.json({ error: "올바르지 않은 action입니다." }, { status: 400 });
}
