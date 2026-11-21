// TTS + 자동 BGM(외부 음원 불필요) + 덕킹을 MediaRecorder 스트림에 연결
export type TimelineItem = { text: string; start: number; end: number };

const BGM_NORMAL = 0.14; // TTS 없을 때 BGM 볼륨
const BGM_DUCKED = 0.04; // TTS 나올 때 BGM 볼륨
const GAP = 0.25;        // 문장 사이 간격(초)

export class VideoAudio {
  ctx = new AudioContext();
  private dest = this.ctx.createMediaStreamDestination();
  private bgm = this.ctx.createGain();
  private voice = this.ctx.createGain();
  private buffers: AudioBuffer[] = [];
  timeline: TimelineItem[] = [];
  total = 0;

  constructor() {
    // 말소리 대역이 BGM에 묻히지 않도록 BGM 저역/고역 정리
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 1800;
    const notch = this.ctx.createBiquadFilter();
    notch.type = "peaking"; notch.frequency.value = 2000; notch.gain.value = -6; // 목소리 대역 비우기
    this.bgm.gain.value = 0;
    this.bgm.connect(lp); lp.connect(notch); notch.connect(this.dest);
    this.voice.gain.value = 1;
    this.voice.connect(this.dest);
    this.voice.connect(this.ctx.destination); // 사용자도 들을 수 있게(원치 않으면 제거)
  }

  get stream(): MediaStream { return this.dest.stream; }

  /** 문장별 TTS를 /api/tts 에서 받아 디코딩 */
  async prepare(sentences: string[]) {
    this.buffers = await Promise.all(
      sentences.map(async (text) => {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error(`TTS 실패 (${res.status})`);
        return this.ctx.decodeAudioData(await res.arrayBuffer());
      })
    );
    let t = 0.6; // 시작 여유
    this.timeline = sentences.map((text, i) => {
      const start = t;
      const end = t + this.buffers[i].duration;
      t = end + GAP;
      return { text, start, end };
    });
    this.total = t + 0.8;
    return this.timeline;
  }

  /** 녹화 시작과 동시에 호출: 음성·BGM·덕킹 전부 예약 */
  async start() {
    await this.ctx.resume();
    const t0 = this.ctx.currentTime + 0.1;
    this.scheduleBgm(t0);
    this.timeline.forEach((item, i) => {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers[i];
      src.connect(this.voice);
      src.start(t0 + item.start);
      // 덕킹: 시작은 빠르게, 복귀는 천천히
      this.bgm.gain.setTargetAtTime(BGM_DUCKED, t0 + item.start - 0.15, 0.08);
      this.bgm.gain.setTargetAtTime(BGM_NORMAL, t0 + item.end + 0.05, 0.5);
    });
  }

  private scheduleBgm(t0: number) {
    const g = this.bgm.gain;
    g.setValueAtTime(0, t0);
    g.linearRampToValueAtTime(BGM_NORMAL, t0 + 1.5);          // 페이드 인
    g.setTargetAtTime(0, t0 + this.total - 1.5, 0.5);          // 페이드 아웃
    // Am - F - C - G 잔잔한 패드 루프 (4초/코드)
    const chords = [
      [220.0, 261.63, 329.63], [174.61, 220.0, 261.63],
      [196.0, 261.63, 329.63], [196.0, 246.94, 293.66],
    ];
    const len = 4;
    for (let c = 0, t = 0; t < this.total; c++, t += len) {
      for (const f of chords[c % 4]) {
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = "sine"; osc.frequency.value = f;
        env.gain.setValueAtTime(0, t0 + t);
        env.gain.linearRampToValueAtTime(0.3, t0 + t + 1.2);
        env.gain.linearRampToValueAtTime(0, t0 + t + len + 0.8); // 코드끼리 겹쳐서 부드럽게 이어짐
        osc.connect(env); env.connect(this.bgm);
        osc.start(t0 + t); osc.stop(t0 + t + len + 1);
      }
    }
  }

  close() { this.ctx.close(); }
}
