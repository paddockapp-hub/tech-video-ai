import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { OUTPUT_DIR } from "@/lib/paths";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const id = Date.now().toString(36);
    const outputDir = path.join(OUTPUT_DIR, "tts_" + id);
    fs.mkdirSync(outputDir, { recursive: true });

    const audioFile = path.join(outputDir, "tts.mp3");
    const subsFile = path.join(outputDir, "subs.vtt");

    // edge-tts 직접 호출
    const voice = "ko-KR-InJoonNeural";
    const cmd = `python -m edge_tts --voice "${voice}" --rate "+0%" --pitch "-5Hz" --text "${text.replace(/"/g, '\\"').replace(/\n/g, ' ')}" --write-media "${audioFile}" --write-subtitles "${subsFile}"`;

    await execAsync(cmd, { timeout: 30000 });

    const audioBuffer = fs.readFileSync(audioFile);

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="tts_${id}.mp3"`,
        "X-Subtitles-Path": `/outputs/tts_${id}/subs.vtt`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
