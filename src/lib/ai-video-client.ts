import { composeSeedanceVideo } from "@/lib/ai-video-compositor";
import {
  AI_VIDEO_CLIP_COUNT,
  AI_VIDEO_CLIP_DURATION_SEC,
  SEEDANCE_MODEL_LABEL,
} from "@/lib/ai-video-config";
interface SeedanceVideoOptions {
  title: string;
  script: string;
  category: "education" | "engineering";
  onProgress?: (message: string) => void;
}

function splitScriptIntoScenes(script: string): string[] {
  const cleanScript = script.trim();
  let units = cleanScript
    .split(/(?<=[.!?。！？])\s*|\n+/)
    .map((unit) => unit.trim())
    .filter(Boolean);

  if (units.length < AI_VIDEO_CLIP_COUNT) {
    const words = cleanScript.split(/\s+/).filter(Boolean);
    if (words.length >= AI_VIDEO_CLIP_COUNT) {
      const wordsPerScene = Math.ceil(words.length / AI_VIDEO_CLIP_COUNT);
      units = Array.from({ length: AI_VIDEO_CLIP_COUNT }, (_, index) =>
        words.slice(index * wordsPerScene, (index + 1) * wordsPerScene).join(" "),
      ).filter(Boolean);
    } else {
      const characters = Array.from(cleanScript);
      const charactersPerScene = Math.ceil(characters.length / AI_VIDEO_CLIP_COUNT);
      units = Array.from({ length: AI_VIDEO_CLIP_COUNT }, (_, index) =>
        characters
          .slice(index * charactersPerScene, (index + 1) * charactersPerScene)
          .join(""),
      ).filter(Boolean);
    }
  }

  const scenes = Array.from({ length: AI_VIDEO_CLIP_COUNT }, () => "");
  units.forEach((unit, index) => {
    const sceneIndex = Math.min(
      AI_VIDEO_CLIP_COUNT - 1,
      Math.floor((index / units.length) * AI_VIDEO_CLIP_COUNT),
    );
    scenes[sceneIndex] = `${scenes[sceneIndex]} ${unit}`.trim();
  });

  return scenes;
}

function buildScenePrompts(
  title: string,
  script: string,
  category: "education" | "engineering",
) {
  const scenes = splitScriptIntoScenes(script);
  const visualDirection = category === "engineering"
    ? "cinematic engineering visualization, believable materials and mechanisms, clean controlled camera movement"
    : "cinematic science education visualization, clear cause-and-effect, accurate scale and purposeful camera movement";

  return scenes.map((scene, index) => [
    `Create a polished ${AI_VIDEO_CLIP_DURATION_SEC}-second vertical 9:16 short-video shot, true 1080p, scene ${index + 1} of ${AI_VIDEO_CLIP_COUNT}.`,
    `Topic: ${title}.`,
    `This shot visualizes: ${scene || title}.`,
    visualDirection,
    "Use a consistent dark cinematic palette with teal highlights, realistic lighting, smooth motion, and one clear subject. Compose for a phone screen.",
    "No readable text, captions, logos, watermarks, split screens, or sudden scene changes.",
  ].join(" "));
}

export async function renderSeedanceVideo({
  title,
  script,
  category,
  onProgress,
}: SeedanceVideoOptions): Promise<Blob> {
  const prompts = buildScenePrompts(title, script, category);
  const clips: Blob[] = [];

  for (let index = 0; index < prompts.length; index += 1) {
    onProgress?.(
      `${SEEDANCE_MODEL_LABEL} 클립 ${index + 1}/${AI_VIDEO_CLIP_COUNT} 생성 중 · 자동 재시도 없음`,
    );

    let response: Response;
    try {
      response = await fetch("/api/ai-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompts[index] }),
      });
    } catch {
      throw new Error(
        `클립 ${index + 1}/${AI_VIDEO_CLIP_COUNT} 요청에 실패했습니다. 앞서 완료된 클립은 비용이 발생했을 수 있습니다. 자동 재시도는 하지 않았습니다.`,
      );
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message = typeof payload?.error === "string"
        ? payload.error
        : "AI 영상 생성 요청이 거부되었습니다.";
      throw new Error(
        `클립 ${index + 1}/${AI_VIDEO_CLIP_COUNT}: ${message} 앞서 완료된 클립은 비용이 발생했을 수 있습니다. 자동 재시도는 하지 않았습니다.`,
      );
    }

    const mediaType = response.headers.get("content-type") ?? "";
    if (!mediaType.startsWith("video/")) {
      throw new Error(
        `클립 ${index + 1}/${AI_VIDEO_CLIP_COUNT} 응답이 영상 파일이 아닙니다. 앞서 완료된 클립은 비용이 발생했을 수 있습니다. 자동 재시도는 하지 않았습니다.`,
      );
    }

    const clip = await response.blob();
    if (clip.size === 0) {
      throw new Error(
        `클립 ${index + 1}/${AI_VIDEO_CLIP_COUNT} 파일이 비어 있습니다. 앞서 완료된 클립은 비용이 발생했을 수 있습니다. 자동 재시도는 하지 않았습니다.`,
      );
    }
    clips.push(clip);
  }

  onProgress?.("AI 클립을 1080p WebM으로 연결하고 자막·배경음을 합성하는 중...");
  try {
    return await composeSeedanceVideo({
      clips,
      title,
      captions: splitScriptIntoScenes(script),
      onProgress: (fraction) => {
        const percent = Math.round(fraction * 100);
        onProgress?.(`3개 AI 클립 합성 중... ${percent}%`);
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "영상 합성 중 오류가 발생했습니다.";
    throw new Error(`${message} 이미 생성된 AI 클립은 비용이 청구됐을 수 있으며 자동 재시도는 하지 않았습니다.`);
  }
}
