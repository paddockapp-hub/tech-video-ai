import { createDownload, experimental_generateVideo as generateVideo } from "ai";
import { NextRequest, NextResponse } from "next/server";
import {
  AI_VIDEO_CLIP_COUNT,
  AI_VIDEO_CLIP_DURATION_SEC,
  AI_VIDEO_MAX_COST_USD,
  SEEDANCE_MAX_CLIP_DURATION_SEC,
  SEEDANCE_RATE_CEILING_USD_PER_SEC,
  SEEDANCE_MODEL_ID,
} from "@/lib/ai-video-config";

export const runtime = "nodejs";
export const maxDuration = 240;

const MODEL_CATALOG_URL = "https://ai-gateway.vercel.sh/v1/models";

async function getLive1080pRate() {
  const response = await fetch(MODEL_CATALOG_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error("Gateway 가격표를 확인할 수 없습니다.");
  }

  const catalog = await response.json();
  const model = catalog?.data?.find(
    (entry: { id?: string }) => entry.id === SEEDANCE_MODEL_ID,
  );
  const price = model?.pricing?.video_duration_pricing?.find(
    (entry: { resolution?: string }) => entry.resolution === "1080p",
  );
  const rate = Number(price?.cost_per_second);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("모델의 현재 1080p 단가를 확인할 수 없습니다.");
  }
  return rate;
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      {
        error:
          "AI 유료 영상 생성은 영구 인증과 사용량 제한이 준비되기 전까지 프로덕션에서 비활성화되어 있습니다.",
      },
      { status: 503 },
    );
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const forwardedHost = request.headers.get("x-forwarded-host");
      const requestHost = request.headers.get("host");
      if (originHost !== forwardedHost && originHost !== requestHost) {
        return NextResponse.json({ error: "허용되지 않은 요청 출처입니다." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "요청 출처를 확인할 수 없습니다." }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 요청 본문이 필요합니다." }, { status: 400 });
  }

  const prompt = typeof body === "object" && body !== null && "prompt" in body
    ? (body as { prompt?: unknown }).prompt
    : null;
  if (typeof prompt !== "string" || prompt.trim().length < 12 || prompt.length > 3_000) {
    return NextResponse.json(
      { error: "유효한 영상 프롬프트(12~3,000자)를 입력해주세요." },
      { status: 400 },
    );
  }

  let rate: number;
  try {
    rate = await getLive1080pRate();
  } catch {
    return NextResponse.json(
      { error: "현재 Gateway 요금을 확인할 수 없어 유료 생성을 중단했습니다." },
      { status: 503 },
    );
  }

  const maximumCurrentCost =
    rate * SEEDANCE_MAX_CLIP_DURATION_SEC * AI_VIDEO_CLIP_COUNT;
  if (
    rate > SEEDANCE_RATE_CEILING_USD_PER_SEC ||
    maximumCurrentCost >= 2 ||
    AI_VIDEO_MAX_COST_USD >= 2
  ) {
    return NextResponse.json(
      { error: "현재 요금으로는 편당 $2 미만을 보장할 수 없어 생성을 차단했습니다." },
      { status: 409 },
    );
  }

  try {
    const { video } = await generateVideo({
      model: SEEDANCE_MODEL_ID,
      prompt: prompt.trim(),
      aspectRatio: "9:16",
      resolution: "1080x1920",
      duration: AI_VIDEO_CLIP_DURATION_SEC,
      maxRetries: 0,
      poll: {
        intervalMs: 5_000,
        timeoutMs: 210_000,
      },
      download: createDownload({ maxBytes: 32 * 1024 * 1024 }),
      abortSignal: AbortSignal.timeout(215_000),
    });

    return new NextResponse(Buffer.from(video.uint8Array), {
      status: 200,
      headers: {
        "Content-Type": video.mediaType || "video/mp4",
        "Cache-Control": "no-store, private",
        "X-AI-Video-Model": SEEDANCE_MODEL_ID,
        "X-AI-Video-Rate": String(rate),
        "X-AI-Video-Estimated-Cost": String(rate * AI_VIDEO_CLIP_DURATION_SEC),
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "AI 클립 생성에 실패했습니다. 자동 재시도는 하지 않습니다. 공급자 처리 상태에 따라 실패한 요청도 비용이 발생했을 수 있습니다.",
      },
      { status: 502 },
    );
  }
}
