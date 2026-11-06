export type ProjectStatus =
  | "draft"
  | "script"
  | "keyframes"
  | "infographics"
  | "videos"
  | "audio"
  | "editing"
  | "complete";

export interface Keyframe {
  id: string;
  index: number;
  durationSec: number;
  scriptSegment: string;
  baseImagePrompt: string;
  infographicPrompt: string;
  videoPrompt: string;
  clipFileName?: string;
}

export interface Project {
  id: string;
  title: string;
  topic: string;
  script: string;
  audioDurationSec: number;
  status: ProjectStatus;
  keyframes: Keyframe[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface CostEstimate {
  clipCount: number;
  creditsPerClip: number;
  totalCredits: number;
  costKRW: number;
  durationMin: number;
}

export const WORKFLOW_STEPS = [
  { id: "script", label: "대본 & TTS", description: "대본 작성 및 음성 길이 입력" },
  { id: "keyframes", label: "키프레임 이미지", description: "인포그래픽 없는 기본 이미지 생성" },
  { id: "infographics", label: "인포그래픽", description: "이미지에 인포그래픽 추가" },
  { id: "videos", label: "영상 클립", description: "모션 그래픽 영상 생성" },
  { id: "audio", label: "음성 생성", description: "TTS 음성 파일 생성" },
  { id: "editing", label: "편집 & 완성", description: "클립 배치 및 최종 렌더링" },
] as const;

export const CREDIT_COST_KRW = 14.4;
export const CREDITS_PER_CLIP = 7;
export const CLIP_DURATION_SEC = 4;
export const SECONDS_PER_IMAGE_MIN = 2;
export const SECONDS_PER_IMAGE_MAX = 4;

export type JobStage =
  | "pending_payment"
  | "paid"
  | "script"
  | "tts"
  | "keyframes"
  | "infographics"
  | "videos"
  | "compose"
  | "complete"
  | "failed";

export interface JobClip {
  index: number;
  narration: string;
  visual: string;
  baseImagePrompt: string;
  infographicPrompt: string;
  videoPrompt: string;
  baseImageUrl?: string;
  infographicUrl?: string;
  clipUrl?: string;
  usedVideoFallback?: boolean;
}

export interface ProductionJob {
  id: string;
  orderId: string;
  title: string;
  topic: string;
  script: string;
  targetDurationSec: number;
  audioDurationSec: number;
  stage: JobStage;
  progress: number;
  message: string;
  clips: JobClip[];
  narrationUrl?: string;
  finalVideoUrl?: string;
  error?: string;
  logs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  jobId: string;
  amountKRW: number;
  durationSec: number;
  topic: string;
  status: "pending" | "paid" | "failed" | "canceled";
  paymentProvider: "demo" | "toss";
  paymentKey?: string;
  createdAt: string;
  paidAt?: string;
}

export const PIPELINE_STEPS = [
  { id: "paid", label: "결제 확인" },
  { id: "script", label: "대본 생성" },
  { id: "tts", label: "나레이션 TTS" },
  { id: "keyframes", label: "키프레임 이미지" },
  { id: "infographics", label: "인포그래픽" },
  { id: "videos", label: "모션 클립" },
  { id: "compose", label: "편집·렌더" },
  { id: "complete", label: "완성" },
] as const;
