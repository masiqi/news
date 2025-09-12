import { initDB } from '../../db/index';
import { sources, sourceValidationHistories } from '../../db/schema';
import { eq, and, or, isNull, lte, desc, sql, gte } from 'drizzle-orm';
import { QualityAssessmentService } from './quality-assessment.service';

interface ValidationSchedulerConfig {
  batchSize: number;
  intervalMinutes: number;
  maxAgeHours: number;
  enabled: boolean;
}

interface ValidationResult {
  sourceId: number;
  status: 'passed' | 'failed' | 'warning';
  metrics: {
    availability: number;
    contentQuality: number;
    updateFrequency: number;
    overall: number;
  };
  errorMessage?: string;
}

export class ValidationSchedulerService {
  private config: ValidationSchedulerConfig;
  private qualityService: QualityAssessmentService;
  private db: any;

  constructor(config: Partial<ValidationSchedulerConfig> = {}, db?: any) {
    this.config = {
      batchSize: 10,
      intervalMinutes: 60,
      maxAgeHours: 24,
      enabled: true,
      ...config,
    };
    this.db = db;
    this.qualityService = new QualityAssessmentService(db);
  }

  /**
   * 获取需要验证的源
   */
  async getSourcesNeedingValidation(): Promise<any[]> {
    const cutoffTime = new Date(Date.now() - this.config.maxAgeHours * 60 * 60 * 1000);
    
    const sourcesList = await this.db
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
      )
      .orderBy(asc(sources.qualityLastValidatedAt))
      .limit(this.config.batchSize);

    return sourcesList;
  }

  /**
   * 获取质量风险源
   */
  async getSourcesAtRisk(): Promise<any[]> {
    const threshold = 60;
    
    const sourcesList = await this.db
      .select()
      .from(sources)
      .where(
        and(
          eq(sources.isRecommended, true),
          eq(sources.qualityValidationStatus, 'approved'),
          or(
            lte(sources.qualityAvailability, threshold),
            lte(sources.qualityContentQuality, threshold),
            lte(sources.qualityUpdateFrequency, threshold)
          )
        )
      )
      .limit(this.config.batchSize);

    // 手动排序，因为无法在ORDER BY中直接使用表达式
    return sourcesList.sort((a, b) => {
      const scoreA = a.qualityAvailability + a.qualityContentQuality + a.qualityUpdateFrequency;
      const scoreB = b.qualityAvailability + b.qualityContentQuality + b.qualityUpdateFrequency;
      return scoreA - scoreB;
    });
  }

  /**
   * 执行自动验证任务
   */
  async runAutomaticValidation(): Promise<{
    processed: number;
    passed: number;
    failed: number;
    warnings: number;
    errors: string[];
  }> {
    const results = {
      processed: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      errors: [] as string[],
    };

    try {
      const sourcesToValidate = await this.getSourcesNeedingValidation();
      
      if (sourcesToValidate.length === 0) {
        console.log('没有需要验证的推荐源');
        return results;
      }

      console.log(`开始自动验证 ${sourcesToValidate.length} 个推荐源`);

      for (const source of sourcesToValidate) {
        try {
          const validationResult = await this.qualityService.assessSourceQuality(source.id);
          
          // 记录验证历史
          await this.qualityService.recordValidationHistory(
            validationResult,
            'automatic'
          );

          // 更新源的质量信息
          await this.updateSourceAfterValidation(source.id, validationResult);

          results.processed++;
          
          if (validationResult.status === 'passed') {
            results.passed++;
          } else if (validationResult.status === 'failed') {
            results.failed++;
          } else {
            results.warnings++;
          }

          // 避免过于频繁的请求
          if (sourcesToValidate.length > 1) {
            await this.delay(1000);
          }

        } catch (error) {
          console.error(`验证推荐源 ${source.id} 失败:`, error);
          results.errors.push(`源 ${source.id}: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }

      console.log(`自动验证完成: 处理 ${results.processed} 个，通过 ${results.passed} 个，失败 ${results.failed} 个，警告 ${results.warnings} 个`);

    } catch (error) {
      console.error('自动验证任务失败:', error);
      results.errors.push(`系统错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return results;
  }

  /**
   * 执行风险评估任务
   */
  async runRiskAssessment(): Promise<{
    processed: number;
    atRisk: number;
    errors: string[];
  }> {
    const results = {
      processed: 0,
      atRisk: 0,
      errors: [] as string[],
    };

    try {
      const sourcesAtRisk = await this.getSourcesAtRisk();
      
      if (sourcesAtRisk.length === 0) {
        console.log('没有质量风险的推荐源');
        return results;
      }

      console.log(`发现 ${sourcesAtRisk.length} 个质量风险推荐源`);

      for (const source of sourcesAtRisk) {
        try {
          // 对风险源进行重新验证
          const validationResult = await this.qualityService.assessSourceQuality(source.id);
          
          // 记录验证历史
          await this.qualityService.recordValidationHistory(
            validationResult,
            'automatic'
          );

          // 更新源的质量信息
          await this.updateSourceAfterValidation(source.id, validationResult);

          results.processed++;
          
          if (validationResult.status !== 'passed') {
            results.atRisk++;
          }

          await this.delay(1000);

        } catch (error) {
          console.error(`评估风险源 ${source.id} 失败:`, error);
          results.errors.push(`源 ${source.id}: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }

      console.log(`风险评估完成: 处理 ${results.processed} 个，发现 ${results.atRisk} 个风险源`);

    } catch (error) {
      console.error('风险评估任务失败:', error);
      results.errors.push(`系统错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return results;
  }

  /**
   * 验证后更新源信息
   */
  private async updateSourceAfterValidation(sourceId: number, result: ValidationResult): Promise<void> {
    const newStatus = result.status === 'passed' ? 'approved' : 
                     result.status === 'failed' ? 'rejected' : 'pending';

    await this.db
      .update(sources)
      .set({
        qualityAvailability: result.metrics.availability,
        qualityContentQuality: result.metrics.contentQuality,
        qualityUpdateFrequency: result.metrics.updateFrequency,
        qualityLastValidatedAt: new Date(),
        qualityValidationStatus: newStatus,
        qualityValidationNotes: result.errorMessage,
      })
      .where(eq(sources.id, sourceId));
  }

  /**
   * 获取验证统计信息
   */
  async getValidationStatistics(): Promise<{
    totalSources: number;
    validatedIn24h: number;
    passedIn24h: number;
    failedIn24h: number;
    averageQuality: number;
    needsValidation: number;
    atRisk: number;
  }> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 总推荐源数
    const [totalSourcesResult] = await this.db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(sources)
      .where(eq(sources.isRecommended, true));

    // 最近24小时验证数
    const [validated24hResult] = await this.db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(sourceValidationHistories)
      .where(gte(sourceValidationHistories.validatedAt, last24h));

    // 最近24小时通过数
    const [passed24hResult] = await this.db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(sourceValidationHistories)
      .where(
        and(
          gte(sourceValidationHistories.validatedAt, last24h),
          eq(sourceValidationHistories.status, 'passed')
        )
      );

    // 最近24小时失败数
    const [failed24hResult] = await this.db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(sourceValidationHistories)
      .where(
        and(
          gte(sourceValidationHistories.validatedAt, last24h),
          eq(sourceValidationHistories.status, 'failed')
        )
      );

    // 平均质量评分
    const [avgQualityResult] = await this.db
      .select({
        avg: sql`AVG(${sources.qualityAvailability} + ${sources.qualityContentQuality} + ${sources.qualityUpdateFrequency}) / 3`.mapWith(Number),
      })
      .from(sources)
      .where(eq(sources.isRecommended, true));

    // 需要验证的源数
    const needsValidation = await this.getSourcesNeedingValidation();

    // 风险源数
    const atRisk = await this.getSourcesAtRisk();

    return {
      totalSources: totalSourcesResult?.count || 0,
      validatedIn24h: validated24hResult?.count || 0,
      passedIn24h: passed24hResult?.count || 0,
      failedIn24h: failed24hResult?.count || 0,
      averageQuality: Math.round(avgQualityResult?.avg || 0),
      needsValidation: needsValidation.length,
      atRisk: atRisk.length,
    };
  }

  /**
   * 获取验证历史记录
   */
  async getRecentValidationHistory(limit: number = 50): Promise<any[]> {
    const history = await this.db
      .select({
        id: sourceValidationHistories.id,
        sourceId: sourceValidationHistories.sourceId,
        validationType: sourceValidationHistories.validationType,
        availabilityScore: sourceValidationHistories.availabilityScore,
        contentQualityScore: sourceValidationHistories.contentQualityScore,
        updateFrequencyScore: sourceValidationHistories.updateFrequencyScore,
        overallScore: sourceValidationHistories.overallScore,
        status: sourceValidationHistories.status,
        errorMessage: sourceValidationHistories.errorMessage,
        validatedBy: sourceValidationHistories.validatedBy,
        validatedAt: sourceValidationHistories.validatedAt,
        createdAt: sourceValidationHistories.createdAt,
      })
      .from(sourceValidationHistories)
      .leftJoin(sources, eq(sourceValidationHistories.sourceId, sources.id))
      .orderBy(desc(sourceValidationHistories.validatedAt))
      .limit(limit);

    return history.map(item => ({
      ...item,
      sourceName: item.sources?.name || '未知源',
      sourceUrl: item.sources?.url || '',
    }));
  }

  /**
   * 生成验证报告
   */
  async generateValidationReport(): Promise<{
    summary: any;
    statistics: any;
    recommendations: string[];
    generatedAt: string;
  }> {
    const stats = await this.getValidationStatistics();

    // 生成推荐建议
    const recommendations: string[] = [];

    if (stats.needsValidation > 0) {
      recommendations.push(`有 ${stats.needsValidation} 个推荐源需要验证，建议尽快处理`);
    }

    if (stats.atRisk > 0) {
      recommendations.push(`发现 ${stats.atRisk} 个质量风险推荐源，建议重点关注`);
    }

    if (stats.failedIn24h > stats.passedIn24h * 0.5) {
      recommendations.push('最近24小时验证失败率较高，建议检查验证机制');
    }

    if (stats.averageQuality < 70) {
      recommendations.push('推荐源平均质量评分较低，建议优化推荐源选择标准');
    }

    const passRate = stats.validatedIn24h > 0 
      ? (stats.passedIn24h / stats.validatedIn24h * 100).toFixed(1)
      : '0';

    const report = {
      summary: {
        totalSources: stats.totalSources,
        averageQuality: stats.averageQuality,
        last24hPassRate: `${passRate}%`,
        urgentActions: stats.needsValidation + stats.atRisk,
      },
      statistics: {
        validatedIn24h: stats.validatedIn24h,
        passedIn24h: stats.passedIn24h,
        failedIn24h: stats.failedIn24h,
        needsValidation: stats.needsValidation,
        atRisk: stats.atRisk,
      },
      recommendations,
      generatedAt: new Date().toISOString(),
    };

    return report;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 启动定时验证任务
   */
  startScheduler(): void {
    if (!this.config.enabled) {
      console.log('验证调度器已禁用');
      return;
    }

    console.log(`启动验证调度器，每 ${this.config.intervalMinutes} 分钟运行一次`);

    // 立即执行一次
    this.runScheduledTasks();

    // 设置定时执行
    setInterval(() => {
      this.runScheduledTasks();
    }, this.config.intervalMinutes * 60 * 1000);
  }

  /**
   * 执行调度的任务
   */
  private async runScheduledTasks(): Promise<void> {
    try {
      console.log('开始执行调度验证任务');
      
      // 执行自动验证
      const validationResults = await this.runAutomaticValidation();
      
      // 执行风险评估
      const riskResults = await this.runRiskAssessment();
      
      console.log('调度验证任务完成');
      
      // 如果有错误，可以发送通知
      if (validationResults.errors.length > 0 || riskResults.errors.length > 0) {
        console.warn('验证任务发现错误:', {
          validationErrors: validationResults.errors,
          riskErrors: riskResults.errors,
        });
      }
      
    } catch (error) {
      console.error('调度验证任务执行失败:', error);
    }
  }
}