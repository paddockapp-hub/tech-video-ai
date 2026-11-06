import { NextRequest, NextResponse } from "next/server";
import { generateKeyframes, generateWithAI } from "@/lib/prompt-generator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { script, audioDurationSec, topic, apiKey, useAI } = body;

    if (!script || !audioDurationSec || !topic) {
      return NextResponse.json(
        { error: "script, audioDurationSec, topic are required" },
        { status: 400 }
      );
    }

    let keyframes;
    if (useAI && apiKey) {
      keyframes = await generateWithAI(script, audioDurationSec, topic, apiKey);
    } else {
      keyframes = generateKeyframes(script, audioDurationSec, topic);
    }

    return NextResponse.json({ keyframes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
