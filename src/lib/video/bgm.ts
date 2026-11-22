// Procedural background music rendered once into a seamless loop buffer.

import { makeSeamlessLoop, MIX } from "./audio-mix";

const BPM = 100;
const BEAT = 60 / BPM;
const BARS = 4;
export const LOOP_SECONDS = BARS * 4 * BEAT; // 9.6s

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// i - VI - III - VII in A minor (engineering) / I - V - vi - IV in C major (education)
const PROGRESSIONS: Record<"engineering" | "education", number[][]> = {
  engineering: [
    [57, 60, 64],
    [53, 57, 60],
    [48, 52, 55],
    [55, 59, 62],
  ],
  education: [
    [48, 52, 55],
    [55, 59, 62],
    [57, 60, 64],
    [53, 57, 60],
  ],
};

function pad(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  notes: number[],
  start: number,
  dur: number,
) {
  for (const n of notes) {
    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = midi(n);
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.05, start + 0.6);
      g.gain.setValueAtTime(0.05, start + dur - 0.5);
      g.gain.linearRampToValueAtTime(0, start + dur + 0.2);
      osc.connect(g).connect(dest);
      osc.start(start);
      osc.stop(start + dur + 0.25);
    }
  }
}

function bass(ctx: OfflineAudioContext, dest: AudioNode, root: number, start: number, dur: number) {
  for (let b = 0; b < 4; b++) {
    const t = start + b * BEAT;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = midi(root - 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.01, t + BEAT * 0.95);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + BEAT);
  }
  void dur;
}

function arp(ctx: OfflineAudioContext, dest: AudioNode, notes: number[], start: number) {
  const step = BEAT / 2;
  const seq = [0, 1, 2, 1, 0, 2, 1, 2];
  seq.forEach((idx, i) => {
    const t = start + i * step;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = midi(notes[idx] + 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + step * 0.9);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + step);
  });
}

function hats(ctx: OfflineAudioContext, dest: AudioNode, noise: AudioBuffer, start: number) {
  for (let i = 0; i < 8; i++) {
    const t = start + i * (BEAT / 2);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    const level = i % 2 === 1 ? 0.05 : 0.025;
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.06);
    src.connect(hp).connect(g).connect(dest);
    src.start(t);
    src.stop(t + 0.08);
  }
}

/** Render the BGM loop (stereo) with its seam crossfaded so it loops click-free. */
export async function renderBgmLoop(
  sampleRate: number,
  category: "engineering" | "education",
): Promise<{ channels: Float32Array[]; sampleRate: number }> {
  const tail = MIX.loopCrossfadeSec;
  const total = LOOP_SECONDS + tail;
  const ctx = new OfflineAudioContext(2, Math.ceil(total * sampleRate), sampleRate);

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2400;
  lp.Q.value = 0.7;
  const padBus = ctx.createGain();
  padBus.gain.value = 0.8;
  padBus.connect(lp).connect(ctx.destination);
  const dry = ctx.createGain();
  dry.gain.value = 1;
  dry.connect(ctx.destination);

  const noise = ctx.createBuffer(1, Math.floor(sampleRate * 0.1), sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const prog = PROGRESSIONS[category];
  // Render one extra bar so the tail used for the seam crossfade has real music in it.
  for (let bar = 0; bar < BARS + 1; bar++) {
    const chord = prog[bar % prog.length];
    const start = bar * 4 * BEAT;
    if (start >= total) break;
    pad(ctx, padBus, chord, start, 4 * BEAT);
    bass(ctx, dry, chord[0], start, 4 * BEAT);
    arp(ctx, dry, chord, start);
    arp(ctx, dry, chord, start + 2 * BEAT);
    hats(ctx, dry, noise, start);
    hats(ctx, dry, noise, start + 2 * BEAT);
  }

  const rendered = await ctx.startRendering();
  const channels: Float32Array[] = [];
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    channels.push(makeSeamlessLoop(rendered.getChannelData(c), sampleRate, tail));
  }
  return { channels, sampleRate };
}
