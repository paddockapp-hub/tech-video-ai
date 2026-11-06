import { getSubcategoryById } from "./categories";

export interface ScriptGenerationRequest {
  category: string;
  subcategory: string;
  customTopic?: string;
  targetDurationSec?: number; // 30, 45, 60
}

export interface GeneratedScriptResult {
  title: string;
  hook: string;
  narrationScript: string;
  visualPlan: {
    secondRange: string;
    narrationPart: string;
    visualDescription: string;
    infographicElements: string;
  }[];
  wordCount: number;
  estimatedDurationSec: number;
}

export function generateScriptTemplate(
  req: ScriptGenerationRequest
): GeneratedScriptResult {
  const sub = getSubcategoryById(req.category, req.subcategory);
  const topic = req.customTopic || sub?.sampleTopics[0] || "핵심 작동 원리";
  const duration = req.targetDurationSec || 45;

  const hook =
    sub?.recommendedHooks[Math.floor(Math.random() * sub.recommendedHooks.length)] ||
    `${topic}, 과연 어떤 원리로 작동하는 걸까요?`;

  // 공학 카테고리일 때와 교육 카테고리일 때의 차별화 템플릿
  const isEngineering = req.category === "engineering";

  let sentences: string[] = [];

  if (isEngineering) {
    sentences = [
      `${hook}`,
      `우리가 매일 마주하는 ${topic}의 핵심은 바로 내부의 물리적 메커니즘에 있습니다.`,
      `단면을 들여다보면 회전축과 기어가 정밀한 각도로 맞물려 있습니다.`,
      `에너지가 입력되면 고압 상태가 형성되면서 내부 유체가 한 방향으로 가속됩니다.`,
      `이 과정에서 손실되는 마찰열을 줄이기 위해 특수 냉각 채널이 열을 흡수합니다.`,
      `결과적으로 작은 힘만으로도 수백 킬로그램의 하중을 완벽하게 제어할 수 있게 됩니다.`,
      `단순한 부품의 조합이 아닌 수학과 물리학이 완성한 공학의 정수입니다.`,
    ];
  } else {
    sentences = [
      `${hook}`,
      `${topic}을 이해하려면 먼저 교과서가 알려주지 않는 기본 전제부터 짚어야 합니다.`,
      `대부분의 학생들이 공식만 암기하지만, 실제 핵심은 두 변수 사이의 변화율에 있습니다.`,
      `그래프의 기울기가 0이 되는 지점을 보면 숨겨진 균형 상태가 명확히 드러납니다.`,
      `이 조건을 실제 수식에 대입하면 복잡했던 풀이가 단 3줄 만에 정리됩니다.`,
      `출제자가 변별력을 두는 포인트도 바로 이 직관적 해석 능력입니다.`,
      `원리를 알면 어떤 응용 문제가 나와도 흔들리지 않습니다.`,
    ];
  }

  const narrationScript = sentences.join("\n");
  const stepCount = sentences.length;
  const secPerStep = Math.round(duration / stepCount);

  const visualPlan = sentences.map((st, i) => {
    const startSec = i * secPerStep;
    const endSec = Math.min(duration, (i + 1) * secPerStep);
    return {
      secondRange: `${startSec}s ~ ${endSec}s`,
      narrationPart: st,
      visualDescription: isEngineering
        ? `[클립 ${i + 1}] 3D 금속 메커니즘 분해도, 내부 단면 투시 (Cutaway), 작동 축 회전`
        : `[클립 ${i + 1}] 다크 배경의 네온 그래프 시각화, 핵심 수식 및 좌표계 강조 애니메이션`,
      infographicElements: isEngineering
        ? "유체 흐름 화살표(파란색/빨간색 벡터), 압력 게이지, 치수선 콜아웃"
        : "주요 등식 하이라이트 박스, 변화량(Δ) 화살표, 1등급 체크 포인트 뱃지",
    };
  });

  return {
    title: topic,
    hook,
    narrationScript,
    visualPlan,
    wordCount: narrationScript.replace(/\s+/g, "").length,
    estimatedDurationSec: duration,
  };
}

