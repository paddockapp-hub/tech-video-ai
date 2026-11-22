// BGM ducking schedule and mix constants. Pure functions so the timing rules are testable.

export const MIX = {
  /** BGM level when nobody is speaking. */
  bgmBaseGain: 0.18,
  /** BGM level under narration. */
  bgmDuckedGain: 0.06,
  /** Seconds the BGM takes to dip before a sentence starts. */
  duckAttackSec: 0.15,
  /** Seconds the BGM takes to come back after a sentence ends. */
  duckReleaseSec: 0.6,
  /** Fade from silence at the start of the video. */
  fadeInSec: 1.2,
  /** Fade to silence at the end of the video. */
  fadeOutSec: 1.6,
  /** Equal-power crossfade length used to hide the loop seam. */
  loopCrossfadeSec: 0.75,
  /** Speech-band carve applied to the BGM so the voice sits on top. */
  speechEq: [
    { frequency: 300, gainDb: -2, q: 0.9 },
    { frequency: 1200, gainDb: -5, q: 0.8 },
    { frequency: 3000, gainDb: -4, q: 1.0 },
  ],
  voiceHighpassHz: 90,
  voicePresence: { frequency: 3200, gainDb: 2.5, q: 0.9 },
} as const;

export interface Interval {
  start: number;
  end: number;
}

export interface GainPoint {
  time: number;
  value: number;
}

/**
 * Merge voice intervals whose gap is too short for the BGM to recover
 * (release + attack). The BGM then stays ducked across that gap.
 */
export function mergeVoiceIntervals(
  intervals: Interval[],
  minGap = MIX.duckReleaseSec + MIX.duckAttackSec,
): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .map((i) => ({ ...i }))
    .sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const current of sorted) {
    const last = merged[merged.length - 1];
    if (last && current.start - last.end < minGap) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }
  return merged;
}

/**
 * Breakpoints for the ducking gain (multiplied with the separate fade envelope).
 * Values are linear-ramped between consecutive points.
 */
export function buildDuckingSchedule(voice: Interval[], totalSec: number): GainPoint[] {
  const {
    bgmBaseGain: base,
    bgmDuckedGain: ducked,
    duckAttackSec: attack,
    duckReleaseSec: release,
  } = MIX;
  const points: GainPoint[] = [{ time: 0, value: base }];
  for (const v of mergeVoiceIntervals(voice)) {
    const duckStart = Math.max(0, v.start - attack);
    const releaseEnd = Math.min(totalSec, v.end + release);
    if (duckStart === 0) {
      points[0] = { time: 0, value: ducked };
    } else {
      points.push({ time: duckStart, value: base });
    }
    points.push({ time: Math.max(duckStart, v.start), value: ducked });
    points.push({ time: Math.min(v.end, totalSec), value: ducked });
    if (releaseEnd > v.end) points.push({ time: releaseEnd, value: base });
  }
  return points;
}

/** Gain at a given time from a breakpoint list (linear interpolation). */
export function gainAt(points: GainPoint[], time: number): number {
  if (points.length === 0) return 0;
  if (time <= points[0].time) return points[0].value;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (time <= b.time) {
      if (b.time === a.time) return b.value;
      return a.value + ((b.value - a.value) * (time - a.time)) / (b.time - a.time);
    }
  }
  return points[points.length - 1].value;
}

/** Master fade envelope: 0 → 1 over fadeIn, 1 → 0 over fadeOut at the end. */
export function fadeEnvelope(totalSec: number): GainPoint[] {
  const fadeIn = Math.min(MIX.fadeInSec, totalSec / 3);
  const fadeOut = Math.min(MIX.fadeOutSec, totalSec / 3);
  return [
    { time: 0, value: 0 },
    { time: fadeIn, value: 1 },
    { time: Math.max(fadeIn, totalSec - fadeOut), value: 1 },
    { time: totalSec, value: 0 },
  ];
}

/**
 * Hide the loop seam: the last `crossfadeSec` of the buffer is blended (equal-power)
 * into its first `crossfadeSec`, then the tail is dropped. Looping the returned
 * samples has no click because the end flows straight into the start.
 */
export function makeSeamlessLoop(
  samples: Float32Array,
  sampleRate: number,
  crossfadeSec = MIX.loopCrossfadeSec,
): Float32Array {
  const fade = Math.min(Math.floor(crossfadeSec * sampleRate), Math.floor(samples.length / 3));
  if (fade <= 0) return samples.slice();
  const outLength = samples.length - fade;
  const out = samples.slice(0, outLength);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    const fadeInGain = Math.sin((t * Math.PI) / 2);
    const fadeOutGain = Math.cos((t * Math.PI) / 2);
    out[i] = samples[i] * fadeInGain + samples[outLength + i] * fadeOutGain;
  }
  return out;
}
