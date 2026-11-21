// 대본 문장 -> 3D 씬 종류 매핑 (영상 내용에 맞는 3D)
export type SceneKind = "chip" | "network" | "robot" | "rocket" | "code" | "energy" | "generic";

const RULES: [RegExp, SceneKind][] = [
  [/칩|반도체|GPU|NPU|CPU|프로세서|트랜지스터|나노/i, "chip"],
  [/네트워크|서버|클라우드|데이터센터|5G|6G|인터넷|통신/i, "network"],
  [/로봇|휴머노이드|자동화|드론|기계/i, "robot"],
  [/우주|로켓|위성|달|화성|발사|궤도/i, "rocket"],
  [/코드|개발|프로그래|API|AI|인공지능|모델|알고리즘|LLM/i, "code"],
  [/배터리|전기|에너지|전력|태양광|충전|원자력/i, "energy"],
];

export function pickScene(text: string): SceneKind {
  for (const [re, kind] of RULES) if (re.test(text)) return kind;
  return "generic";
}

// 씬별 색/카메라 프리셋: 3D 컴포넌트에서 이 값을 읽어 오브젝트·조명을 바꾸면 됨
export const SCENE_PRESETS: Record<SceneKind, { color: string; accent: string; camera: [number, number, number] }> = {
  chip:    { color: "#0ea5e9", accent: "#22d3ee", camera: [0, 3, 6] },
  network: { color: "#8b5cf6", accent: "#a78bfa", camera: [4, 2, 6] },
  robot:   { color: "#f97316", accent: "#fdba74", camera: [0, 1.5, 5] },
  rocket:  { color: "#ef4444", accent: "#fca5a5", camera: [0, -1, 8] },
  code:    { color: "#22c55e", accent: "#86efac", camera: [-3, 2, 6] },
  energy:  { color: "#eab308", accent: "#fde047", camera: [3, 1, 5] },
  generic: { color: "#64748b", accent: "#cbd5e1", camera: [0, 2, 7] },
};

export function splitSentences(script: string): string[] {
  return script
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
