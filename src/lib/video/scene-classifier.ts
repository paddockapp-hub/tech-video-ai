// Classifies each script sentence into one of the 3D scene presets.
// Pure and deterministic so the same script always produces the same scenes.

export const SCENE_PRESETS = ["chip", "network", "robot", "space", "code"] as const;
export type ScenePreset = (typeof SCENE_PRESETS)[number];

export const SCENE_LABELS: Record<ScenePreset, string> = {
  chip: "칩 · 반도체",
  network: "네트워크 · 통신",
  robot: "기계 · 동력전달",
  space: "우주 · 물리",
  code: "코드 · 소프트웨어",
};

// Keywords are matched as lowercase substrings, so Korean stems ("반도체", "트랜지스터")
// and English words both work. Longer / more specific keywords carry more weight.
const KEYWORDS: Record<ScenePreset, Array<[string, number]>> = {
  chip: [
    ["반도체", 3],
    ["트랜지스터", 3],
    ["칩", 2],
    ["cpu", 3],
    ["gpu", 3],
    ["프로세서", 3],
    ["웨이퍼", 3],
    ["회로", 2],
    ["게이트", 2],
    ["나노", 2],
    ["실리콘", 3],
    ["전압", 2],
    ["전류", 2],
    ["전자", 1],
    ["메모리", 2],
    ["d램", 3],
    ["ram", 2],
    ["낸드", 3],
    ["집적", 2],
    ["semiconductor", 3],
    ["transistor", 3],
    ["chip", 2],
    ["circuit", 2],
    ["silicon", 3],
    ["wafer", 3],
    ["voltage", 2],
    ["memory", 2],
    ["processor", 3],
  ],
  network: [
    ["네트워크", 3],
    ["인터넷", 3],
    ["통신", 3],
    ["5g", 3],
    ["6g", 3],
    ["와이파이", 3],
    ["wifi", 3],
    ["신호", 2],
    ["패킷", 3],
    ["서버", 2],
    ["클라우드", 3],
    ["데이터센터", 3],
    ["라우터", 3],
    ["연결", 1],
    ["전송", 2],
    ["무선", 2],
    ["광섬유", 3],
    ["블록체인", 3],
    ["gps", 2],
    ["위성통신", 3],
    ["network", 3],
    ["internet", 3],
    ["signal", 2],
    ["packet", 3],
    ["server", 2],
    ["cloud", 3],
    ["router", 3],
    ["wireless", 2],
    ["fiber", 2],
    ["protocol", 2],
  ],
  robot: [
    ["로봇", 3],
    ["기계", 2],
    ["엔진", 3],
    ["모터", 3],
    ["실린더", 3],
    ["피스톤", 3],
    ["기어", 3],
    ["관절", 2],
    ["자동화", 2],
    ["액추에이터", 3],
    ["드론", 2],
    ["자동차", 2],
    ["터빈", 3],
    ["유압", 3],
    ["토크", 2],
    ["폭발", 1],
    ["동력", 2],
    ["크랭크", 3],
    ["변속기", 3],
    ["듀얼 클러치", 3],
    ["클러치", 3],
    ["dct", 3],
    ["transmission", 3],
    ["gearbox", 3],
    ["clutch", 3],
    ["날개", 1],
    ["양력", 2],
    ["robot", 3],
    ["engine", 3],
    ["motor", 3],
    ["gear", 3],
    ["piston", 3],
    ["turbine", 3],
    ["actuator", 3],
    ["mechanic", 2],
    ["torque", 2],
  ],
  space: [
    ["우주", 3],
    ["행성", 3],
    ["블랙홀", 3],
    ["은하", 3],
    ["태양", 2],
    ["항성", 3],
    ["별빛", 2],
    ["궤도", 3],
    ["중력", 3],
    ["로켓", 3],
    ["위성", 2],
    ["상대성", 3],
    ["광속", 3],
    ["빛의", 2],
    ["시간 지연", 3],
    ["시간지연", 3],
    ["우주선", 3],
    ["천체", 3],
    ["초음속", 2],
    ["소닉붐", 2],
    ["충격파", 2],
    ["원자", 2],
    ["분자", 2],
    ["양자", 2],
    ["에너지", 1],
    ["물리학", 2],
    ["space", 3],
    ["planet", 3],
    ["galaxy", 3],
    ["orbit", 3],
    ["gravity", 3],
    ["rocket", 3],
    ["relativity", 3],
    ["quantum", 2],
    ["atom", 2],
  ],
  code: [
    ["코드", 3],
    ["코딩", 3],
    ["프로그래밍", 3],
    ["알고리즘", 3],
    ["소프트웨어", 3],
    ["인공지능", 3],
    ["ai", 2],
    ["머신러닝", 3],
    ["딥러닝", 3],
    ["신경망", 3],
    ["모델", 1],
    ["데이터", 2],
    ["함수", 2],
    ["미적분", 2],
    ["수학", 2],
    ["방정식", 2],
    ["그래프", 2],
    ["계산", 2],
    ["앱", 1],
    ["파이썬", 3],
    ["자바스크립트", 3],
    ["컴퓨터", 2],
    ["학습", 1],
    ["수식", 2],
    ["code", 3],
    ["coding", 3],
    ["software", 3],
    ["algorithm", 3],
    ["neural", 3],
    ["python", 3],
    ["javascript", 3],
    ["function", 2],
    ["data", 2],
    ["equation", 2],
  ],
};

export function scoreSentence(sentence: string): Record<ScenePreset, number> {
  const text = sentence.toLowerCase();
  const scores = { chip: 0, network: 0, robot: 0, space: 0, code: 0 } as Record<
    ScenePreset,
    number
  >;
  for (const preset of SCENE_PRESETS) {
    for (const [keyword, weight] of KEYWORDS[preset]) {
      // "ai" and other short Latin tokens must stand alone, not match inside other words.
      if (/^[a-z0-9]{1,3}$/.test(keyword)) {
        const re = new RegExp(`(^|[^a-z0-9])${keyword}([^a-z0-9]|$)`);
        if (re.test(text)) scores[preset] += weight;
      } else if (text.includes(keyword)) {
        scores[preset] += weight;
      }
    }
  }
  return scores;
}

/** Best preset for one sentence, or null when no keyword matches. */
export function classifySentence(sentence: string): ScenePreset | null {
  const scores = scoreSentence(sentence);
  let best: ScenePreset | null = null;
  let bestScore = 0;
  for (const preset of SCENE_PRESETS) {
    if (scores[preset] > bestScore) {
      best = preset;
      bestScore = scores[preset];
    }
  }
  return best;
}

/** Default scene for each field, used unless a sentence clearly talks about something else. */
export const SUBCATEGORY_SCENE: Record<string, ScenePreset> = {
  "sat-college": "code",
  math: "code",
  physics: "space",
  chemistry: "space",
  "economics-society": "network",
  "college-deep": "code",
  "mechanical-automotive": "robot",
  aerospace: "space",
  "electrical-electronics": "chip",
  "robotics-control": "robot",
  "cs-ai": "code",
  "chemical-materials": "chip",
};

/** A sentence needs at least this score to move away from the field's default scene. */
export const STRONG_MATCH = 3;

export const SCENE_VARIANTS = {
  chip: ["processor", "wafer"],
  network: ["server", "topology"],
  robot: ["engine", "arm", "gearbox"],
  space: ["planet", "solar"],
  code: ["terminal", "neural"],
} as const;

export type SceneVariant =
  | (typeof SCENE_VARIANTS)[ScenePreset][number]
  | "chalkboard"
  | "exam"
  | "graph"
  | "vector"
  | "wave"
  | "field"
  | "molecule"
  | "cell"
  | "economy"
  | "timeline"
  | "research"
  | "attention"
  | "gpu"
  | "memory"
  | "hash-table";

const SUBCATEGORY_VARIANTS: Record<string, readonly SceneVariant[]> = {
  "sat-college": ["exam", "chalkboard"],
  math: ["graph", "vector"],
  physics: ["wave", "field"],
  chemistry: ["molecule", "cell"],
  "economics-society": ["economy", "timeline"],
  "college-deep": ["research", "wave"],
  "cs-ai": ["attention", "gpu", "memory", "hash-table"],
};

function hashText(value: string) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function sceneShotIndex(text: string, shot = 0, profileCount = 4) {
  const count = Number.isInteger(profileCount) && profileCount > 0 ? profileCount : 1;
  const safeShot = Number.isFinite(shot) ? Math.abs(Math.trunc(shot)) : 0;
  return (hashText(text.toLowerCase()) + safeShot * 7) % count;
}

/** Pick a topic-matched 3D composition, then alternate deterministic cuts for generic lines. */
export function sceneVariantFor(
  preset: ScenePreset,
  text: string,
  shot = 0,
  subcategory?: string,
): SceneVariant {
  const normalized = text.toLowerCase();
  const includesAny = (keywords: string[]) =>
    keywords.some((keyword) => normalized.includes(keyword));
  const hasAiToken = /(^|[^a-z0-9])ai([^a-z0-9]|$)/.test(normalized);

  if (subcategory && SUBCATEGORY_SCENE[subcategory] === preset) {
    const variants = SUBCATEGORY_VARIANTS[subcategory];
    if (variants) {
      if (
        subcategory === "sat-college" &&
        includesAny(["문제", "수능", "선지", "오답", "문항", "지문", "exam", "reading"])
      )
        return "exam";
      if (subcategory === "math" && includesAny(["벡터", "기하", "복소수", "vector", "geometry"]))
        return "vector";
      if (
        subcategory === "math" &&
        includesAny(["그래프", "미적분", "기울기", "극한", "적분", "미분", "graph", "calculus"])
      )
        return "graph";
      if (subcategory === "physics" && includesAny(["파동", "진동", "주파수", "wave", "frequency"]))
        return "wave";
      if (
        subcategory === "physics" &&
        includesAny(["중력", "궤도", "전자기장", "field", "gravity", "orbit"])
      )
        return "field";
      if (
        subcategory === "chemistry" &&
        includesAny(["dna", "세포", "효소", "유전자", "cell", "enzyme"])
      )
        return "cell";
      if (
        subcategory === "chemistry" &&
        includesAny(["분자", "원자", "결합", "리튬", "전해질", "molecule", "atom"])
      )
        return "molecule";
      if (
        subcategory === "economics-society" &&
        includesAny(["역사", "연도", "전쟁", "시대", "timeline", "history"])
      )
        return "timeline";
      if (
        subcategory === "college-deep" &&
        includesAny(["푸리에", "주파수", "신호", "fourier", "signal"])
      )
        return "wave";
      if (
        subcategory === "cs-ai" &&
        includesAny(["어텐션", "attention", "트랜스포머", "transformer"])
      )
        return "attention";
      if (subcategory === "cs-ai" && includesAny(["gpu", "병렬", "코어", "parallel"])) return "gpu";
      if (
        subcategory === "cs-ai" &&
        includesAny(["메모리", "페이징", "램", "ssd", "memory", "paging"])
      )
        return "memory";
      if (subcategory === "cs-ai" && includesAny(["해시", "hash", "자료 구조", "자료구조"]))
        return "hash-table";

      return variants[sceneShotIndex(normalized, shot, variants.length)];
    }
  }

  if (preset === "chip" && includesAny(["웨이퍼", "노광", "포토", "증착", "식각", "lithography"]))
    return "wafer";
  if (
    preset === "chip" &&
    includesAny(["반도체", "프로세서", "회로", "트랜지스터", "cpu", "gpu", "chip"])
  )
    return "processor";
  if (preset === "network" && includesAny(["데이터센터", "서버", "클라우드", "server", "cloud"]))
    return "server";
  if (
    preset === "network" &&
    includesAny(["패킷", "라우터", "통신", "네트워크", "신호", "packet", "router", "internet"])
  )
    return "topology";
  if (
    preset === "robot" &&
    includesAny([
      "듀얼 클러치",
      "변속기",
      "클러치",
      "기어박스",
      "dct",
      "transmission",
      "gearbox",
      "clutch",
      "차동기어",
      "차동 기어",
      "디퍼렌셜",
      "차가 코너",
      "안쪽 바퀴",
      "바깥 바퀴",
      "differential gear",
      "differential",
    ])
  )
    return "gearbox";
  if (
    preset === "robot" &&
    includesAny(["엔진", "기어", "피스톤", "실린더", "모터", "터빈", "engine", "gear"])
  )
    return "engine";
  if (
    preset === "robot" &&
    includesAny(["로봇", "관절", "액추에이터", "자동화", "드론", "robot", "actuator"])
  )
    return "arm";
  if (
    preset === "space" &&
    includesAny(["태양계", "행성", "궤도", "로켓", "위성", "planet", "orbit", "rocket"])
  )
    return "solar";
  if (
    preset === "space" &&
    includesAny(["블랙홀", "은하", "중력", "우주", "양자", "원자", "black hole", "gravity"])
  )
    return "planet";
  if (
    preset === "code" &&
    (hasAiToken ||
      includesAny(["인공지능", "머신러닝", "딥러닝", "신경망", "neural", "machine learning"]))
  )
    return "neural";
  if (
    preset === "code" &&
    includesAny(["코드", "코딩", "알고리즘", "프로그래밍", "소프트웨어", "python", "software"])
  )
    return "terminal";

  const variants = SCENE_VARIANTS[preset];
  return variants[sceneShotIndex(normalized, shot, variants.length)];
}

/**
 * Classify every sentence.
 * - With a known field (subcategory): every sentence shows the field's scene unless it
 *   clearly scores another topic (>= STRONG_MATCH); weak hits fall back to the field scene.
 * - Without one: unmatched sentences inherit the previous scene (keeps the video calm);
 *   a leading unmatched run uses the title's topic, then the category default.
 */
export function classifyScript(
  sentences: string[],
  options: { title?: string; category?: "education" | "engineering"; subcategory?: string } = {},
): ScenePreset[] {
  const base = options.subcategory ? SUBCATEGORY_SCENE[options.subcategory] : undefined;
  if (base) {
    return sentences.map((sentence) => {
      const scores = scoreSentence(sentence);
      let best: ScenePreset = base;
      let bestScore = STRONG_MATCH - 1;
      for (const preset of SCENE_PRESETS) {
        if (preset === base) continue;
        if (scores[preset] > bestScore && scores[preset] > scores[base]) {
          best = preset;
          bestScore = scores[preset];
        }
      }
      return best;
    });
  }
  const fallback: ScenePreset =
    (options.title ? classifySentence(options.title) : null) ??
    (options.category === "education" ? "space" : "chip");
  const result: ScenePreset[] = [];
  let previous: ScenePreset = fallback;
  for (const sentence of sentences) {
    const preset = classifySentence(sentence) ?? previous;
    result.push(preset);
    previous = preset;
  }
  return result;
}

/** Split narration into sentences on . ! ? and line breaks (Korean and CJK punctuation included). */
export function splitSentences(script: string): string[] {
  return script
    .replace(/([.!?。！？\n])\s*/g, "$1|")
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
