import {
  CLIP_DURATION_SEC,
  CREDITS_PER_CLIP,
  CREDIT_COST_KRW,
  SECONDS_PER_IMAGE_MAX,
  SECONDS_PER_IMAGE_MIN,
} from "@/types";

export function calculateKeyframeCount(audioDurationSec: number): number {
  const avgSecPerImage = (SECONDS_PER_IMAGE_MIN + SECONDS_PER_IMAGE_MAX) / 2;
  return Math.max(1, Math.round(audioDurationSec / avgSecPerImage));
}

export function calculateCostEstimate(
  audioDurationSec: number
): { keyframeCount: number; clipCount: number; totalCredits: number; costKRW: number } {
  const clipCount = Math.ceil(audioDurationSec / CLIP_DURATION_SEC);
  const totalCredits = clipCount * CREDITS_PER_CLIP;
  const costKRW = Math.round(totalCredits * CREDIT_COST_KRW);
  const keyframeCount = calculateKeyframeCount(audioDurationSec);

  return { keyframeCount, clipCount, totalCredits, costKRW };
}

export function splitScriptIntoSegments(
  script: string,
  segmentCount: number
): string[] {
  const sentences = script
    .split(/(?<=[.!?。])\s+|[\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return Array(segmentCount).fill("");

  const segments: string[] = [];
  const perSegment = Math.ceil(sentences.length / segmentCount);

  for (let i = 0; i < segmentCount; i++) {
    const start = i * perSegment;
    const chunk = sentences.slice(start, start + perSegment).join(" ");
    segments.push(chunk || sentences[sentences.length - 1] || "");
  }

  return segments;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}
