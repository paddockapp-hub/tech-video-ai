import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { OUTPUT_DIR, publicUrl } from "@/lib/paths";
import { getCurrentUser } from "@/lib/auth";
import { checkUserCredits, deductCredit, refundCredit } from "@/lib/credits";
import { DB } from "@/lib/db";

const execAsync = promisify(exec);

// 서버 자원 보호를 위한 동시 렌더링 수 제한 (최대 2개 동시 처리)
let activeRenders = 0;
const MAX_CONCURRENT_RENDERS = 2;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (process.env.VERCEL === "1") {
    return NextResponse.json(
      {
        error:
          "서버 Python 렌더링은 Vercel에서 지원되지 않습니다. /auto에서 브라우저 기반 WebM 영상을 생성할 수 있습니다.",
        code: "RENDERER_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  let currentUser = await getCurrentUser();
  let creditDeducted = false;

  const body = await request.json();
  const { script, title, category, subcategory, jobId } = body;

  // jobId 생성 시 사용자 ID 포함 (멱등성 강화)
  const id = jobId || (currentUser ? `${currentUser.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}` : `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`);

  // 멱등성 검증: jobId가 제공된 경우 사용자 소유 여부 확인
  if (jobId && currentUser) {
    // jobId 형식 검증 (userId_timestamp_random 형식인지 확인)
    const jobParts = jobId.split('_');
    if (jobParts.length >= 3) {
      const jobUserId = jobParts[0];

      // 다른 사용자의 jobId인 경우 거부
      if (jobUserId !== currentUser.id) {
        return NextResponse.json(
          { error: "다른 사용자의 작업 ID는 사용할 수 없습니다." },
          { status: 403 }
        );
      }

      const existingOutputDir = path.join(OUTPUT_DIR, jobId);
      if (fs.existsSync(existingOutputDir)) {
        // jobId로 생성된 결과가 이미 존재하는 경우
        const files = fs.readdirSync(existingOutputDir);
        const videoFile = files.find((f: string) => f.endsWith("_final.mp4"));

        if (videoFile) {
          // 이미 완료된 작업인 경우 결과 반환
          return NextResponse.json({
            success: true,
            jobId: id,
            video: videoFile ? publicUrl(id, videoFile) : null,
            existing: true,
            message: "이미 완료된 작업입니다.",
          });
        }
      }
    }
  }

  if (!script || !script.trim()) {
    return NextResponse.json({ error: "스크립트 내용이 필요합니다." }, { status: 400 });
  }

  // 동시 렌더링 수 검사 (서버 OOM / 과부하 방지)
  if (activeRenders >= MAX_CONCURRENT_RENDERS) {
    return NextResponse.json(
      { error: "현재 영상 제작 서버가 혼잡합니다. 잠시 후 다시 시도해주세요. (동시 작업 제한)" },
      { status: 429 }
    );
  }

  activeRenders += 1;

  try {
    // 로그인된 사용자 크레딧 검증 및 사전 차감 (jobId 기반 멱등성 보장)
    if (currentUser) {
      const creditCheck = checkUserCredits(currentUser.id);
      if (!creditCheck.allowed) {
        activeRenders -= 1;
        return NextResponse.json(
          {
            error: creditCheck.reason || "잔여 생성 크레딧이 부족합니다.",
            creditDetails: creditCheck,
          },
          { status: 403 }
        );
      }

      const deductResult = await deductCredit(currentUser.id, 1, id);
      if (!deductResult.success) {
        activeRenders -= 1;
        return NextResponse.json(
          { error: deductResult.error || "크레딧 차감 실패" },
          { status: 403 }
        );
      }
      creditDeducted = true;
    }

    const outputDir = path.join(OUTPUT_DIR, id);
    fs.mkdirSync(outputDir, { recursive: true });

    const pipelineScript = path.join(process.cwd(), "scripts", "pipeline.py");

    const arg = JSON.stringify({
      script: script.trim(),
      title: title || "shorts",
      category: category || "engineering",
      subcategory: subcategory || "",
      output_dir: outputDir,
    });

    // Windows 환경 파이썬 스크립트 실행 (180초 타임아웃)
    const pythonCmd = `python "${pipelineScript}" "${arg.replace(/"/g, '\\"')}"`;
    const { stdout, stderr } = await execAsync(pythonCmd, {
      timeout: 180000,
      maxBuffer: 20 * 1024 * 1024,
    });

    if (stderr) {
      console.warn("[Pipeline stderr]", stderr);
    }

    // 결과 파싱
    const resultLine = stdout.split("\n").find((l: string) => l.startsWith("__RESULT__"));
    let pipelineResult: any = {};
    if (resultLine) {
      try {
        pipelineResult = JSON.parse(resultLine.replace("__RESULT__", ""));
      } catch (e) {
        console.error("JSON 파싱 오류", e);
      }
    }

    // 파일 확인
    const files = fs.readdirSync(outputDir);
    const videoFile = files.find((f: string) => f.endsWith("_final.mp4"));
    const audioFile = files.find((f: string) => f.endsWith("_tts.mp3"));
    const subsFile = files.find((f: string) => f.endsWith("_subs.vtt") || f.endsWith("_subs.srt"));
    const viralFile = files.find((f: string) => f.endsWith("_viral_subs.json"));

    if (!videoFile) {
      throw new Error("영상 파일 생성에 실패했습니다.");
    }

    // 비디오 생성 로그 기록
    DB.addVideoLog({
      userId: currentUser?.id || "guest",
      title: title || "shorts",
      category: category || "engineering",
      subcategory: subcategory || "",
      durationSec: Math.round(pipelineResult.duration_sec || 45),
      creditCost: 1,
      status: "success",
      costEstimatedKRW: 12.6, // 상용 원가 정밀 산정치
    });

    return NextResponse.json({
      success: true,
      jobId: id,
      video: videoFile ? publicUrl(id, videoFile) : null,
      audio: audioFile ? publicUrl(id, audioFile) : null,
      subtitles: subsFile ? publicUrl(id, subsFile) : null,
      viralSubtitles: viralFile ? publicUrl(id, viralFile) : null,
      files: files.map((f: string) => publicUrl(id, f)),
      qualityPassed: pipelineResult.quality_passed ?? true,
      qualityReport: pipelineResult.quality_report ?? "품질 검증 완료",
    });
  } catch (error: any) {
    console.error("[Auto-Pipeline Error]", error);

    // 실패 시 멱등성 기반 크레딧 환불 처리 (중복 환불 방지)
    if (currentUser && creditDeducted) {
      await refundCredit(currentUser.id, 1, `영상 렌더링 실패: ${error.message}`, id);
    }

    DB.addVideoLog({
      userId: currentUser?.id || "guest",
      title: title || "failed_attempt",
      category: category || "unknown",
      subcategory: subcategory || "unknown",
      durationSec: 0,
      creditCost: 0,
      status: "failed",
      error: error.message,
      costEstimatedKRW: 0,
    });

    return NextResponse.json(
      { error: "영상 생성 중 오류가 발생하여 크레딧이 안전하게 자동 환불되었습니다." },
      { status: 500 }
    );
  } finally {
    activeRenders = Math.max(0, activeRenders - 1);
  }
}
