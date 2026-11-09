/**
 * Viral Pattern AI Model
 * 성공한 바이럴 영상의 패턴을 학습하여 최적의 시각 요소 추천
 */

export interface ViralFeatures {
  // 색상 패턴
  primaryColor: { r: number; g: number; b: number };
  secondaryColor: { r: number; g: number; b: number };
  backgroundColor: { r: number; g: number; b: number };
  contrast: number;

  // 폰트 스타일
  fontSize: number;
  fontWeight: number;
  fontFamily: string;

  // 자막 타이밍
  subtitleDuration: number;
  subtitleGap: number;
  subtitleLineLength: number;

  // 애니메이션
  animationSpeed: number;
  easing: string;
  transitionDuration: number;

  // 컴포지션
  textPosition: { x: number; y: number };
  elementSpacing: number;
  gridAlignment: boolean;

  // 오디오
  musicTempo: number;
  soundEffects: boolean;
  voicePitch: number;
}

export interface ViralExample {
  features: ViralFeatures;
  views: number;
  engagement: number;
  category: string;
}

export class ViralPatternModel {
  private examples: ViralExample[] = [];
  private weights: Map<string, number> = new Map();

  constructor() {
    this.initializeWeights();
  }

  private initializeWeights() {
    // 초기 가중치 설정 (도메인 지식 기반)
    this.weights.set('colorContrast', 0.15);
    this.weights.set('fontSize', 0.12);
    this.weights.set('animationSpeed', 0.10);
    this.weights.set('subtitleTiming', 0.13);
    this.weights.set('composition', 0.12);
    this.weights.set('audio', 0.10);
    this.weights.set('consistency', 0.14);
    this.weights.set('hook', 0.14);
  }

  addExample(example: ViralExample) {
    this.examples.push(example);
  }

  /**
   * 특징 벡터 생성
   */
  private extractFeatureVector(features: ViralFeatures): number[] {
    return [
      features.contrast,
      features.fontSize / 100,
      features.animationSpeed,
      features.subtitleDuration,
      features.subtitleGap,
      features.textPosition.x,
      features.textPosition.y,
      features.elementSpacing,
      features.musicTempo / 120,
      features.voicePitch
    ];
  }

  /**
   * 바이럴 점수 예측
   */
  predictViralScore(features: ViralFeatures): number {
    if (this.examples.length === 0) {
      return 0.5; // 기본값
    }

    const featureVector = this.extractFeatureVector(features);
    let score = 0;

    // 유사한 예제들 찾기 (KNN 방식)
    const k = Math.min(5, this.examples.length);
    const similarities = this.examples.map(example => {
      const exampleVector = this.extractFeatureVector(example.features);
      const similarity = this.cosineSimilarity(featureVector, exampleVector);
      return { similarity, example };
    });

    similarities.sort((a, b) => b.similarity - a.similarity);
    const topK = similarities.slice(0, k);

    // 가중 평균으로 점수 계산
    let totalWeight = 0;
    for (const { similarity, example } of topK) {
      const weight = similarity * example.engagement;
      score += weight;
      totalWeight += similarity;
    }

    return totalWeight > 0 ? score / totalWeight : 0.5;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    return normA > 0 && normB > 0 ? dotProduct / (normA * normB) : 0;
  }

  /**
   * 최적의 바이럴 특징 추천
   */
  recommendFeatures(category: string, script: string): ViralFeatures {
    const baseFeatures = this.getBaseFeatures(category);

    // 카테고리별 평균 특징 계산
    const categoryExamples = this.examples.filter(e => e.category === category);
    if (categoryExamples.length > 0) {
      const avgFeatures = this.averageFeatures(categoryExamples);
      return this.mergeFeatures(baseFeatures, avgFeatures);
    }

    return baseFeatures;
  }

  private getBaseFeatures(category: string): ViralFeatures {
    const isEngineering = category.toLowerCase() === 'engineering';

    return {
      primaryColor: isEngineering ? { r: 56, g: 189, b: 248 } : { r: 251, g: 191, b: 36 },
      secondaryColor: isEngineering ? { r: 100, g: 200, b: 255 } : { r: 255, g: 220, b: 100 },
      backgroundColor: { r: 10, g: 14, b: 26 },
      contrast: 0.85,
      fontSize: 68,
      fontWeight: 700,
      fontFamily: 'sans-serif',
      subtitleDuration: 2.5,
      subtitleGap: 0.3,
      subtitleLineLength: 14,
      animationSpeed: 1.0,
      easing: 'ease-out',
      transitionDuration: 0.3,
      textPosition: { x: 0.5, y: 0.78 },
      elementSpacing: 36,
      gridAlignment: true,
      musicTempo: 120,
      soundEffects: true,
      voicePitch: 1.0
    };
  }

  private averageFeatures(examples: ViralExample[]): ViralFeatures {
    const features = examples[0].features;
    const count = examples.length;

    const avgFeature = { ...features };

    for (let i = 1; i < count; i++) {
      const f = examples[i].features;
      avgFeature.contrast = (avgFeature.contrast + f.contrast) / 2;
      avgFeature.fontSize = (avgFeature.fontSize + f.fontSize) / 2;
      avgFeature.animationSpeed = (avgFeature.animationSpeed + f.animationSpeed) / 2;
      avgFeature.subtitleDuration = (avgFeature.subtitleDuration + f.subtitleDuration) / 2;
    }

    return avgFeature;
  }

  private mergeFeatures(base: ViralFeatures, learned: ViralFeatures): ViralFeatures {
    return {
      ...base,
      contrast: (base.contrast + learned.contrast) / 2,
      fontSize: Math.round((base.fontSize + learned.fontSize) / 2),
      animationSpeed: (base.animationSpeed + learned.animationSpeed) / 2,
      subtitleDuration: (base.subtitleDuration + learned.subtitleDuration) / 2
    };
  }

  /**
   * 학습 데이터 로드
   */
  loadTrainingData(data: ViralExample[]) {
    this.examples = data;
  }

  /**
   * 학습 데이터 내보내기
   */
  exportTrainingData(): ViralExample[] {
    return this.examples;
  }
}

// 싱글톤 인스턴스
export const viralModel = new ViralPatternModel();
