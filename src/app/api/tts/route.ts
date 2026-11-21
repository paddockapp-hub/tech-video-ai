import { NextResponse } from "next/server";

export const runtime = "nodejs";

// 무상태(stateless) TTS: Vercel에서도 동작. OPENAI_API_KEY 환경변수 필요.
export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "TTS 설정 없음" }, { status: 503 });

  const { text } = await req.json().catch(() => ({ text: "" }));
  if (typeof text !== "string" || !text.trim() || text.length > 400)
    return NextResponse.json({ error: "text는 1~400자" }, { status: 400 });

  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", voice: "alloy", input: text, response_format: "mp3" }),
  });
  if (!r.ok) return NextResponse.json({ error: "TTS 제공자 오류" }, { status: 502 });
  return new Response(await r.arrayBuffer(), { headers: { "Content-Type": "audio/mpeg" } });
}
