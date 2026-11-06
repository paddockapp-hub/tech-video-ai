import { v4 as uuidv4 } from "uuid";
import type { Keyframe, Project } from "@/types";
import { calculateKeyframeCount, splitScriptIntoSegments } from "./timing";

const VISUAL_STYLES = [
  "cinematic scientific visualization",
  "3D rendered engineering diagram",
  "macro photography of fluid dynamics",
  "cross-section technical illustration",
  "dark background with glowing particles",
  "blueprint-style technical drawing come to life",
  "laboratory experiment visualization",
  "aerial view of industrial process",
];

const INFOGRAPHIC_ELEMENTS = [
  "animated arrows showing flow direction",
  "temperature/pressure gauge overlays",
  "labeled callout boxes with Korean text",
  "animated data charts and graphs",
  "highlighted regions with color coding",
  "step-by-step numbered annotations",
  "comparison split-screen labels",
  "formula and equation overlays",
];

const MOTION_EFFECTS = [
  "smooth camera push-in with particle flow animation",
  "slow orbital camera rotation around subject",
  "gentle zoom with highlighted infographic fade-in",
  "fluid simulation with dynamic lighting changes",
  "morphing transition between states with data overlay",
  "parallax depth effect with floating labels",
  "time-lapse style acceleration of process",
  "dramatic reveal with spotlight effect",
];

function pickStyle(index: number, arr: string[]): string {
  return arr[index % arr.length];
}

export function generateKeyframes(
  script: string,
  audioDurationSec: number,
  topic: string
): Keyframe[] {
  const count = calculateKeyframeCount(audioDurationSec);
  const segments = splitScriptIntoSegments(script, count);
  const durationPerFrame = audioDurationSec / count;

  return segments.map((segment, i) => ({
    id: uuidv4(),
    index: i + 1,
    durationSec: Math.round(durationPerFrame * 10) / 10,
    scriptSegment: segment,
    baseImagePrompt: generateBaseImagePrompt(segment, topic, i),
    infographicPrompt: generateInfographicPrompt(segment, topic, i),
    videoPrompt: generateVideoPrompt(segment, topic, i),
  }));
}

function generateBaseImagePrompt(
  segment: string,
  topic: string,
  index: number
): string {
  const style = pickStyle(index, VISUAL_STYLES);
  return `[Image ${index + 1}] ${style}, topic: ${topic}. Scene depicting: "${segment}". No text, no labels, no infographics, no watermarks. Clean composition, 9:16 vertical aspect ratio, photorealistic quality, dramatic lighting, dark moody background. Engineering/science educational content style.`;
}

function generateInfographicPrompt(
  segment: string,
  topic: string,
  index: number
): string {
  const style = pickStyle(index, VISUAL_STYLES);
  const infographic = pickStyle(index, INFOGRAPHIC_ELEMENTS);
  return `[Image ${index + 1} - Infographic Version] Same scene as base image: ${style}, topic: ${topic}. Scene: "${segment}". ADD: ${infographic}. Include Korean text labels where appropriate. Professional educational infographic overlay on the same composition. 9:16 vertical, maintain same visual base.`;
}

function generateVideoPrompt(
  segment: string,
  topic: string,
  index: number
): string {
  const motion = pickStyle(index, MOTION_EFFECTS);
  return `[Clip ${index + 1}] Create a 4-second motion graphics clip. Start with base image (no infographic), transition to infographic version. Motion: ${motion}. Topic: ${topic}. Scene: "${segment}". Smooth cinematic transition, professional educational style, 9:16 vertical format.`;
}

export function generateAllPromptsText(keyframes: Keyframe[], type: "base" | "infographic" | "video"): string {
  const key = type === "base" ? "baseImagePrompt" : type === "infographic" ? "infographicPrompt" : "videoPrompt";
  return keyframes.map((kf) => kf[key]).join("\n\n---\n\n");
}

export function generateGoogleFlowInstructions(project: Project): string {
  const { keyframes, audioDurationSec, script, topic } = project;
  const clipCount = Math.ceil(audioDurationSec / 4);

  return `# ${project.title} - Google Flow 제작 가이드

## 프로젝트 정보
- 주제: ${topic}
- 음성 길이: ${audioDurationSec}초
- 키프레임 수: ${keyframes.length}장
- 영상 클립 수: ${clipCount}개 (각 4초)

## Step 1: 기본 키프레임 이미지 생성
Google Flow 에이전트 모드를 켜고 아래 프롬프트를 입력하세요.

${generateAllPromptsText(keyframes, "base")}

## Step 2: 인포그래픽 이미지 생성
Step 1에서 생성한 이미지를 참조하여 아래 프롬프트로 인포그래픽 버전을 생성하세요.

${generateAllPromptsText(keyframes, "infographic")}

## Step 3: 영상 클립 생성
기본 이미지 + 인포그래픽 이미지 쌍을 사용하여 아래 프롬프트로 영상을 생성하세요.
모델: Google Omni Flash, 4초 클립

${generateAllPromptsText(keyframes, "video")}

## Step 4: TTS 음성 생성
Google Generate Speech에서:
- 모델: Gemini 2.5 Pro
- 목소리: Achird
- 속도: Rapid Fire

대본:
${script}

## Step 5: 편집
1. Google Flow에서 '프로젝트 다운로드'로 ZIP 받기
2. 클립 파일명을 01, 02, 03... 순서로 변경
3. CapCut/Premiere에서 음성에 맞춰 클립 배치
4. 효과음 볼륨 낮추기
5. Vrew로 자막 추가
6. 렌더링
`;
}

export async function generateWithAI(
  script: string,
  audioDurationSec: number,
  topic: string,
  apiKey: string
): Promise<Keyframe[]> {
  const count = calculateKeyframeCount(audioDurationSec);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert at creating engineering/science educational short video prompts for Google Flow AI image and video generation. Generate exactly ${count} keyframes. Each keyframe covers 2-4 seconds of narration. Return JSON array with objects: { "scriptSegment", "baseImagePrompt", "infographicPrompt", "videoPrompt" }. All prompts in English except Korean text in infographics. 9:16 vertical format.`,
        },
        {
          role: "user",
          content: `Topic: ${topic}\nAudio duration: ${audioDurationSec} seconds\nKeyframe count: ${count}\n\nScript:\n${script}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = JSON.parse(data.choices[0].message.content);
  const items = content.keyframes || content.items || content;

  const durationPerFrame = audioDurationSec / count;

  return (Array.isArray(items) ? items : []).map(
    (item: Record<string, string>, i: number) => ({
      id: uuidv4(),
      index: i + 1,
      durationSec: Math.round(durationPerFrame * 10) / 10,
      scriptSegment: item.scriptSegment || "",
      baseImagePrompt: item.baseImagePrompt || "",
      infographicPrompt: item.infographicPrompt || "",
      videoPrompt: item.videoPrompt || "",
    })
  );
}
