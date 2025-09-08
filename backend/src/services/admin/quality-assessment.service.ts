import { db } from '../index';
import { sources, sourceValidationHistories } from '../../db/schema';
import { eq, and, desc, gte, lte, or, isNull } from 'drizzle-orm';

export interface QualityMetrics {
  availability: number; // 0-100
  contentQuality: number; // 0-100
  updateFrequency: number; // 0-100
  overall: number; // 0-100
}

export interface ValidationResult {
  sourceId: number;
  metrics: QualityMetrics;
  status: 'passed' | 'failed' | 'warning';
  errorMessage?: string;
  validationDetails: {
    lastFetchSuccess: boolean;
    fetchErrorRate: number;
    averageArticlesPerDay: number;
    contentLengthScore: number;
    lastUpdateTime?: Date;
    consecutiveFailures: number;
  };
}

export class QualityAssessmentService {
  /**
   * 评估推荐源的质量
   */
  async assessSourceQuality(sourceId: number): Promise<ValidationResult> {
    try {
      // 获取源的基本信息
      const [source] = await db
        .select()
        .from(sources)
        .where(eq(sources.id, sourceId));

      if (!source) {
        throw new Error(`Source with ID ${sourceId} not found`);
      }

      // 计算各项质量指标
      const availability = await this.calculateAvailabilityScore(source);
      const contentQuality = await this.calculateContentQualityScore(source);
      const updateFrequency = await this.calculateUpdateFrequencyScore(source);
      
      // 计算总体评分
      const overall = Math.round((availability + contentQuality + updateFrequency) / 3);

      // 确定验证状态
      let status: 'passed' | 'failed' | 'warning' = 'passed';
      let errorMessage: string | undefined;

      if (overall < 60) {
        status = 'failed';
        errorMessage = 'Source quality is below acceptable threshold';
      } else if (overall < 80) {
        status = 'warning';
        errorMessage = 'Source quality needs improvement';
      }

      // 获取详细的验证信息
      const validationDetails = await this.getValidationDetails(source);

      const result: ValidationResult = {
        sourceId,
        metrics: {
          availability,
          contentQuality,
          updateFrequency,
          overall,
        },
        status,
        errorMessage,
        validationDetails,
      };

      return result;
    } catch (error) {
      throw new Error(`Failed to assess source quality: ${error}`);
    }
  }

  /**
   * 计算可用性评分
   */
  private async calculateAvailabilityScore(source: typeof sources.$inferSelect): Promise<number> {
    let score = 100;

    // 基于失败次数扣分
    if (source.fetchFailureCount > 0) {
      score -= Math.min(source.fetchFailureCount * 10, 50);
    }

    // 基于最后获取时间扣分
    if (source.lastFetchedAt) {
      const daysSinceLastFetch = Math.floor(
        (Date.now() - new Date(source.lastFetchedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastFetch > 7) {
        score -= Math.min(daysSinceLastFetch * 2, 30);
      }
    } else {
      // 从未获取过内容
      score -= 50;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 计算内容质量评分
   */
  private async calculateContentQualityScore(source: typeof sources.$inferSelect): Promise<number> {
    let score = 80; // 基础分

    // 基于描述长度和质量调整分数
    if (source.description) {
      const descriptionLength = source.description.length;
      if (descriptionLength > 100) {
        score += 10;
      } else if (descriptionLength < 20) {
        score -= 10;
      }
    }

    // 基于URL的域名可信度调整分数
    try {
      const url = new URL(source.url);
      const domain = url.hostname;
      
      // 常见可信新闻域名加分
      const trustedDomains = [
        'reuters.com', 'ap.org', 'bbc.com', 'cnn.com', 'nytimes.com',
        'wsj.com', 'theguardian.com', 'economist.com', 'bloomberg.com'
      ];
      
      if (trustedDomains.some(trusted => domain.includes(trusted))) {
        score += 15;
      }
    } catch {
      score -= 20; // 无效URL
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 计算更新频率评分
   */
  private async calculateUpdateFrequencyScore(source: typeof sources.$inferSelect): Promise<number> {
    let score = 70; // 基础分

    if (source.lastFetchedAt) {
      // 基于最后获取时间评估更新频率
      const hoursSinceLastFetch = Math.floor(
        (Date.now() - new Date(source.lastFetchedAt).getTime()) / (1000 * 60 * 60)
      );
      
      if (hoursSinceLastFetch <= 24) {
        score += 30; // 24小时内更新过，优秀
      } else if (hoursSinceLastFetch <= 72) {
        score += 15; // 3天内更新过，良好
      } else if (hoursSinceLastFetch <= 168) {
        score += 5; // 一周内更新过，一般
      } else {
        score -= 20; // 超过一周未更新，较差
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 获取详细的验证信息
   */
  private async getValidationDetails(source: typeof sources.$inferSelect) {
    return {
      lastFetchSuccess: source.lastFetchedAt !== null,
      fetchErrorRate: source.fetchFailureCount > 0 ? 
        Math.min(source.fetchFailureCount * 10, 100) : 0,
      averageArticlesPerDay: 0, // 需要从RSS entries表计算
      contentLengthScore: source.description ? 
        Math.min(source.description.length / 10, 100) : 0,
      lastUpdateTime: source.lastFetchedAt ? new Date(source.lastFetchedAt) : undefined,
      consecutiveFailures: source.fetchFailureCount,
    };
  }

  /**
   * 记录验证历史
   */
  async recordValidationHistory(
    result: ValidationResult,
    validationType: 'automatic' | 'manual',
    validatedBy?: number
  ): Promise<void> {
    await db.insert(sourceValidationHistories).values({
      sourceId: result.sourceId,
      validationType,
      availabilityScore: result.metrics.availability,
      contentQualityScore: result.metrics.contentQuality,
      updateFrequencyScore: result.metrics.updateFrequency,
      overallScore: result.metrics.overall,
      status: result.status,
      errorMessage: result.errorMessage,
      validationDetails: JSON.stringify(result.validationDetails),
      validatedBy,
      validatedAt: new Date(),
      createdAt: new Date(),
    });
  }

  /**
   * 获取源的验证历史
   */
  async getSourceValidationHistory(sourceId: number, limit: number = 10) {
    return await db
      .select()
      .from(sourceValidationHistories)
      .where(eq(sourceValidationHistories.sourceId, sourceId))
      .orderBy(desc(sourceValidationHistories.validatedAt))
      .limit(limit);
  }

  /**
   * 批量验证推荐源
   */
  async batchValidateSources(sourceIds: number[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const sourceId of sourceIds) {
      try {
        const result = await this.assessSourceQuality(sourceId);
        results.push(result);
        
        // 记录验证历史
        await this.recordValidationHistory(result, 'automatic');
        
        // 更新源的质量信息
        await this.updateSourceQualityMetrics(sourceId, result.metrics);
      } catch (error) {
        console.error(`Failed to validate source ${sourceId}:`, error);
      }
    }

    return results;
  }

  /**
   * 更新源的质量指标
   */
  private async updateSourceQualityMetrics(sourceId: number, metrics: QualityMetrics): Promise<void> {
    await db
      .update(sources)
      .set({
        qualityAvailability: metrics.availability,
        qualityContentQuality: metrics.contentQuality,
        qualityUpdateFrequency: metrics.updateFrequency,
        qualityLastValidatedAt: new Date(),
        qualityValidationStatus: metrics.overall >= 80 ? 'approved' : 
                                  metrics.overall >= 60 ? 'pending' : 'rejected',
      })
      .where(eq(sources.id, sourceId));
  }

  /**
   * 获取需要验证的源
   */
  async getSourcesNeedingValidation(maxAgeHours: number = 24): Promise<typeof sources.$inferSelect[]> {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    return await db
      .select()
      .from(sources)
      .where(
        and(
          eq(sources.isRecommended, true),
          or(
            eq(sources.qualityValidationStatus, 'pending'),
            lte(sources.qualityLastValidatedAt, cutoffTime),
            isNull(sources.qualityLastValidatedAt)
          )
        )
      );
  }
}