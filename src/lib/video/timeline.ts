import type { ScenePreset } from "./scene-classifier";

export interface TimelineSegment {
  index: number;
  text: string;
  scene: ScenePreset;
  /** Seconds from video start. */
  start: number;
  end: number;
  /** Voice clip position inside the segment (equal to start/end when narrated). */
  voiceStart: number | null;
  voiceEnd: number | null;
}

export interface Timeline {
  segments: TimelineSegment[];
  totalSec: number;
  introSec: number;
  outroSec: number;
}

export const TIMELINE = {
  introSec: 0.8,
  outroSec: 1.4,
  gapSec: 0.3,
  /** Silent videos: reading speed used to size each caption. */
  charsPerSec: 7,
  minSegmentSec: 1.6,
  maxTotalSec: 60,
  transitionSec: 0.9,
} as const;

/**
 * Lay out sentences on the clock. With voice durations, each sentence lasts as long
 * as its narration plus a short gap; without, it is sized by character count.
 */
export function buildTimeline(
  sentences: string[],
  scenes: ScenePreset[],
  voiceDurations?: Array<number | null>,
): Timeline {
  const {
    introSec,
    outroSec,
    gapSec,
    charsPerSec,
    minSegmentSec,
    maxTotalSec,
  }: Record<string, number> = TIMELINE;
  const segments: TimelineSegment[] = [];
  let t = introSec;
  for (let i = 0; i < sentences.length; i++) {
    const voice = voiceDurations?.[i] ?? null;
    const body = voice != null ? voice : Math.max(minSegmentSec, sentences[i].length / charsPerSec);
    const start = t;
    const end = start + body + gapSec;
    if (end > maxTotalSec - outroSec) break;
    segments.push({
      index: i,
      text: sentences[i],
      scene: scenes[i] ?? scenes[scenes.length - 1] ?? "chip",
      start,
      end,
      voiceStart: voice != null ? start : null,
      voiceEnd: voice != null ? start + voice : null,
    });
    t = end;
  }
  return { segments, totalSec: t + outroSec, introSec, outroSec };
}

/** Index of the segment active at time `t` (clamped to the first/last segment). */
export function segmentIndexAt(timeline: Timeline, t: number): number {
  const segs = timeline.segments;
  if (segs.length === 0) return -1;
  for (let i = 0; i < segs.length; i++) {
    if (t < segs[i].end) return i;
  }
  return segs.length - 1;
}

/**
 * Scene blocks: consecutive segments with the same preset form one block so the camera
 * keeps moving smoothly instead of cutting on every sentence.
 */
export interface SceneBlock {
  scene: ScenePreset;
  start: number;
  end: number;
}

export function buildSceneBlocks(timeline: Timeline): SceneBlock[] {
  const blocks: SceneBlock[] = [];
  for (const seg of timeline.segments) {
    const last = blocks[blocks.length - 1];
    if (last && last.scene === seg.scene) {
      last.end = seg.end;
    } else {
      blocks.push({ scene: seg.scene, start: blocks.length === 0 ? 0 : seg.start, end: seg.end });
    }
  }
  if (blocks.length > 0) blocks[blocks.length - 1].end = timeline.totalSec;
  return blocks;
}
