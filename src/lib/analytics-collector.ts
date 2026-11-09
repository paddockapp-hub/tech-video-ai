/**
 * Analytics & Viral Data Collector
 * 생성된 영상의 성과를 추적하여 AI 학습 데이터로 자동 수집
 */

export interface VideoAnalytics {
  videoId: string;
  userId: string;
  title: string;
  category: string;
  features: {
    primaryColor: { r: number; g: number; b: number };
    fontSize: number;
    animationSpeed: number;
    subtitleDuration: number;
    // ... 기타 사용된 특징들
  };
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    watchTime: number;
    retention: number;
  };
  createdAt: string;
  updatedAt: string;
}

export class AnalyticsCollector {
  private analytics: Map<string, VideoAnalytics> = new Map();

  /**
   * 영상 성과 기록
   */
  recordAnalytics(analytics: VideoAnalytics) {
    this.analytics.set(analytics.videoId, analytics);
  }

  /**
   * 성과 업데이트
   */
  updateMetrics(videoId: string, metrics: Partial<VideoAnalytics['metrics']>) {
    const existing = this.analytics.get(videoId);
    if (existing) {
      existing.metrics = { ...existing.metrics, ...metrics };
      existing.updatedAt = new Date().toISOString();
    }
  }

  /**
   * 바이럴 예측을 위한 학습 데이터로 변환
   */
  toTrainingData(): any[] {
    const trainingData = [];

    for (const analytics of Array.from(this.analytics.values())) {
      const engagement = this.calculateEngagement(analytics.metrics);
      const viralScore = this.calculateViralScore(analytics.metrics);

      trainingData.push({
        features: analytics.features,
        views: analytics.metrics.views,
        engagement,
        category: analytics.category
      });
    }

    return trainingData;
  }

  private calculateEngagement(metrics: VideoAnalytics['metrics']): number {
    const totalInteractions = metrics.likes + metrics.comments + metrics.shares;
    const engagementRate = metrics.views > 0 ? totalInteractions / metrics.views : 0;
    return engagementRate;
  }

  private calculateViralScore(metrics: VideoAnalytics['metrics']): number {
    const engagementScore = this.calculateEngagement(metrics);
    const retentionScore = metrics.retention / 100;
    const viralScore = (engagementScore * 0.6) + (retentionScore * 0.4);
    return Math.min(1, Math.max(0, viralScore));
  }

  /**
   * 상위 성과 영상 분석
   */
  getTopPerformers(limit: number = 10): VideoAnalytics[] {
    const all = Array.from(this.analytics.values());
    return all
      .sort((a, b) => this.calculateViralScore(b.metrics) - this.calculateViralScore(a.metrics))
      .slice(0, limit);
  }

  /**
   * 카테고리별 평균 성과
   */
  getCategoryPerformance(): Record<string, { avgViews: number; avgEngagement: number; count: number }> {
    const byCategory: Record<string, VideoAnalytics[]> = {};

    for (const analytics of Array.from(this.analytics.values())) {
      if (!byCategory[analytics.category]) {
        byCategory[analytics.category] = [];
      }
      byCategory[analytics.category].push(analytics);
    }

    const result: Record<string, any> = {};
    for (const [category, items] of Object.entries(byCategory)) {
      const avgViews = items.reduce((sum, a) => sum + a.metrics.views, 0) / items.length;
      const avgEngagement = items.reduce((sum, a) => sum + this.calculateEngagement(a.metrics), 0) / items.length;
      result[category] = { avgViews, avgEngagement, count: items.length };
    }

    return result;
  }
}

// 싱글톤 인스턴스
export const analyticsCollector = new AnalyticsCollector();
