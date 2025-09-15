// GLM 监控和成本统计服务 - 负责API调用的监控、统计和成本分析
import { GLMRequest, GLMResponse, GLMError } from '../config/glm.config';
import { db } from '../../db';
import { 
  glmConfigs, 
  glmUsageStats, 
  glmCallLogs,
  glmMonitoring,
  users 
} from '../../db/schema';
import { eq, and, desc, sql, gte, lt, between, sum, avg, count } from 'drizzle-orm';

export interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  averageResponseTime: number;
  averageRetryCount: number;
  successRate: number;
  errorRate: number;
}

export interface CostBreakdown {
  model: string;
  promptTokens: number;
  completionTokens: number;
  promptCost: number;
  completionCost: number;
  totalCost: number;
  requestCount: number;
  averageTokensPerRequest: number;
}

export interface TimeSeriesData {
  timestamp: Date;
  requests: number;
  tokens: number;
  cost: number;
  successRate: number;
  averageResponseTime: number;
}

export interface MonitoringMetrics {
  currentConcurrency: number;
  queueLength: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  errorRate: number;
  lastError?: GLMError;
  systemHealth: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck: Date;
}

export interface UserUsageReport {
  userId: number;
  username?: string;
  dailyUsage: UsageStats;
  monthlyUsage: UsageStats;
  totalUsage: UsageStats;
  dailyLimit?: number;
  monthlyLimit?: number;
  usagePercentage: {
    daily: number;
    monthly: number;
  };
}

export interface SystemReport {
  overall: UsageStats;
  byModel: CostBreakdown[];
  byUser: Array<{
    userId: number;
    username?: string;
    usage: UsageStats;
  }>;
  timeSeries: TimeSeriesData[];
  monitoring: MonitoringMetrics;
  topErrors: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
  generatedAt: Date;
}

export class GLMMonitoringService {
  private metricsInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private currentMetrics: MonitoringMetrics;

  constructor() {
    this.currentMetrics = {
      currentConcurrency: 0,
      queueLength: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      systemHealth: 'healthy',
      lastHealthCheck: new Date()
    };

    this.startMetricsCollection();
    this.startHealthCheck();
  }

  /**
   * 获取用户使用统计
   */
  async getUserUsageStats(
    userId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageStats> {
    const conditions = [eq(glmCallLogs.userId, userId)];
    
    if (startDate && endDate) {
      conditions.push(between(glmCallLogs.createdAt, startDate, endDate));
    } else if (startDate) {
      conditions.push(gte(glmCallLogs.createdAt, startDate));
    }

    const stats = await db
      .select({
        totalRequests: count(),
        successfulRequests: count(sql`CASE WHEN status = 'success' THEN 1 END`),
        failedRequests: count(sql`CASE WHEN status = 'failed' THEN 1 END`),
        totalTokens: sum(glmCallLogs.totalTokens),
        promptTokens: sum(glmCallLogs.promptTokens),
        completionTokens: sum(glmCallLogs.completionTokens),
        totalCost: sum(glmCallLogs.cost),
        averageResponseTime: avg(glmCallLogs.processingTime),
        averageRetryCount: avg(glmCallLogs.retryCount)
      })
      .from(glmCallLogs)
      .where(and(...conditions));

    const stat = stats[0] || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalCost: 0,
      averageResponseTime: 0,
      averageRetryCount: 0
    };

    return {
      totalRequests: Number(stat.totalRequests) || 0,
      successfulRequests: Number(stat.successfulRequests) || 0,
      failedRequests: Number(stat.failedRequests) || 0,
      totalTokens: Number(stat.totalTokens) || 0,
      promptTokens: Number(stat.promptTokens) || 0,
      completionTokens: Number(stat.completionTokens) || 0,
      totalCost: Number(stat.totalCost) || 0,
      averageResponseTime: Number(stat.averageResponseTime) || 0,
      averageRetryCount: Number(stat.averageRetryCount) || 0,
      successRate: stat.totalRequests > 0 
        ? (Number(stat.successfulRequests) / Number(stat.totalRequests)) * 100 
        : 0,
      errorRate: stat.totalRequests > 0 
        ? (Number(stat.failedRequests) / Number(stat.totalRequests)) * 100 
        : 0
    };
  }

  /**
   * 获取系统整体统计
   */
  async getSystemStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageStats> {
    const conditions = [];
    
    if (startDate && endDate) {
      conditions.push(between(glmCallLogs.createdAt, startDate, endDate));
    } else if (startDate) {
      conditions.push(gte(glmCallLogs.createdAt, startDate));
    }

    const stats = await db
      .select({
        totalRequests: count(),
        successfulRequests: count(sql`CASE WHEN status = 'success' THEN 1 END`),
        failedRequests: count(sql`CASE WHEN status = 'failed' THEN 1 END`),
        totalTokens: sum(glmCallLogs.totalTokens),
        promptTokens: sum(glmCallLogs.promptTokens),
        completionTokens: sum(glmCallLogs.completionTokens),
        totalCost: sum(glmCallLogs.cost),
        averageResponseTime: avg(glmCallLogs.processingTime),
        averageRetryCount: avg(glmCallLogs.retryCount)
      })
      .from(glmCallLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const stat = stats[0] || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalCost: 0,
      averageResponseTime: 0,
      averageRetryCount: 0
    };

    return {
      totalRequests: Number(stat.totalRequests) || 0,
      successfulRequests: Number(stat.successfulRequests) || 0,
      failedRequests: Number(stat.failedRequests) || 0,
      totalTokens: Number(stat.totalTokens) || 0,
      promptTokens: Number(stat.promptTokens) || 0,
      completionTokens: Number(stat.completionTokens) || 0,
      totalCost: Number(stat.totalCost) || 0,
      averageResponseTime: Number(stat.averageResponseTime) || 0,
      averageRetryCount: Number(stat.averageRetryCount) || 0,
      successRate: stat.totalRequests > 0 
        ? (Number(stat.successfulRequests) / Number(stat.totalRequests)) * 100 
        : 0,
      errorRate: stat.totalRequests > 0 
        ? (Number(stat.failedRequests) / Number(stat.totalRequests)) * 100 
        : 0
    };
  }

  /**
   * 按模型获取成本分析
   */
  async getCostByModel(startDate?: Date, endDate?: Date): Promise<CostBreakdown[]> {
    const conditions = [];
    
    if (startDate && endDate) {
      conditions.push(between(glmCallLogs.createdAt, startDate, endDate));
    } else if (startDate) {
      conditions.push(gte(glmCallLogs.createdAt, startDate));
    }

    const modelStats = await db
      .select({
        model: glmCallLogs.model,
        promptTokens: sum(glmCallLogs.promptTokens),
        completionTokens: sum(glmCallLogs.completionTokens),
        totalCost: sum(glmCallLogs.cost),
        requestCount: count()
      })
      .from(glmCallLogs)
      .leftJoin(glmConfigs, eq(glmCallLogs.configId, glmConfigs.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(glmCallLogs.model);

    return modelStats.map(stat => ({
      model: stat.model || 'unknown',
      promptTokens: Number(stat.promptTokens) || 0,
      completionTokens: Number(stat.completionTokens) || 0,
      promptCost: this.calculatePromptCost(Number(stat.promptTokens) || 0, stat.model || 'unknown'),
      completionCost: this.calculateCompletionCost(Number(stat.completionTokens) || 0, stat.model || 'unknown'),
      totalCost: Number(stat.totalCost) || 0,
      requestCount: Number(stat.requestCount) || 0,
      averageTokensPerRequest: Number(stat.requestCount) > 0 
        ? (Number(stat.promptTokens) + Number(stat.completionTokens)) / Number(stat.requestCount) 
        : 0
    }));
  }

  /**
   * 获取时间序列数据
   */
  async getTimeSeriesData(
    startDate: Date,
    endDate: Date,
    interval: 'hour' | 'day' | 'week' = 'hour'
  ): Promise<TimeSeriesData[]> {
    let timeFormat;
    switch (interval) {
      case 'hour':
        timeFormat = '%Y-%m-%d %H:00:00';
        break;
      case 'day':
        timeFormat = '%Y-%m-%d 00:00:00';
        break;
      case 'week':
        timeFormat = '%Y-%W';
        break;
    }

    const timeSeries = await db
      .select({
        timestamp: sql<Date>`strftime(${timeFormat}, createdAt)`,
        requests: count(),
        tokens: sum(glmCallLogs.totalTokens),
        cost: sum(glmCallLogs.cost),
        successRate: sql<number>`(COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*))`,
        averageResponseTime: avg(glmCallLogs.processingTime)
      })
      .from(glmCallLogs)
      .where(between(glmCallLogs.createdAt, startDate, endDate))
      .groupBy(sql`strftime(${timeFormat}, createdAt)`)
      .orderBy(sql`strftime(${timeFormat}, createdAt)`);

    return timeSeries.map(item => ({
      timestamp: item.timestamp,
      requests: Number(item.requests) || 0,
      tokens: Number(item.tokens) || 0,
      cost: Number(item.cost) || 0,
      successRate: Number(item.successRate) || 0,
      averageResponseTime: Number(item.averageResponseTime) || 0
    }));
  }

  /**
   * 获取热门错误
   */
  async getTopErrors(
    startDate?: Date,
    endDate?: Date,
    limit: number = 10
  ): Promise<Array<{
    error: string;
    count: number;
    percentage: number;
  }>> {
    const conditions = [eq(glmCallLogs.status, 'failed')];
    
    if (startDate && endDate) {
      conditions.push(between(glmCallLogs.createdAt, startDate, endDate));
    } else if (startDate) {
      conditions.push(gte(glmCallLogs.createdAt, startDate));
    }

    const errors = await db
      .select({
        error: glmCallLogs.error,
        count: count()
      })
      .from(glmCallLogs)
      .where(and(...conditions))
      .groupBy(glmCallLogs.error)
      .orderBy(desc(count()))
      .limit(limit);

    const total = errors.reduce((sum, error) => sum + Number(error.count), 0);

    return errors.map(error => ({
      error: this.extractErrorMessage(error.error),
      count: Number(error.count),
      percentage: total > 0 ? (Number(error.count) / total) * 100 : 0
    }));
  }

  /**
   * 生成用户使用报告
   */
  async generateUserUsageReport(userId: number): Promise<UserUsageReport> {
    // 获取用户信息
    const userInfo = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // 获取用户配置信息
    const userConfig = await db
      .select({ dailyLimit: glmConfigs.dailyLimit, monthlyLimit: glmConfigs.monthlyLimit })
      .from(glmConfigs)
      .where(and(
        eq(glmConfigs.userId, userId),
        eq(glmConfigs.isActive, true)
      ))
      .limit(1);

    // 计算时间范围
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // 获取不同时间范围的统计
    const [dailyUsage, monthlyUsage, totalUsage] = await Promise.all([
      this.getUserUsageStats(userId, today),
      this.getUserUsageStats(userId, monthStart),
      this.getUserUsageStats(userId)
    ]);

    // 计算使用百分比
    const dailyLimit = userConfig[0]?.dailyLimit;
    const monthlyLimit = userConfig[0]?.monthlyLimit;

    return {
      userId,
      username: userInfo[0]?.username,
      dailyUsage,
      monthlyUsage,
      totalUsage,
      dailyLimit,
      monthlyLimit,
      usagePercentage: {
        daily: dailyLimit ? (dailyUsage.totalRequests / dailyLimit) * 100 : 0,
        monthly: monthlyLimit ? (monthlyUsage.totalRequests / monthlyLimit) * 100 : 0
      }
    };
  }

  /**
   * 生成系统报告
   */
  async generateSystemReport(
    startDate?: Date,
    endDate?: Date
  ): Promise<SystemReport> {
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);

    const reportStartDate = startDate || defaultStartDate;
    const reportEndDate = endDate || new Date();

    const [overall, byModel, timeSeries, topErrors, monitoring] = await Promise.all([
      this.getSystemStats(reportStartDate, reportEndDate),
      this.getCostByModel(reportStartDate, reportEndDate),
      this.getTimeSeriesData(reportStartDate, reportEndDate, 'day'),
      this.getTopErrors(reportStartDate, reportEndDate, 10),
      this.getCurrentMetrics()
    ]);

    // 获取按用户分组的统计
    const userStats = await db
      .select({
        userId: glmCallLogs.userId,
        username: users.username,
        totalRequests: count(),
        successfulRequests: count(sql`CASE WHEN status = 'success' THEN 1 END`),
        failedRequests: count(sql`CASE WHEN status = 'failed' THEN 1 END`),
        totalTokens: sum(glmCallLogs.totalTokens),
        totalCost: sum(glmCallLogs.cost),
        averageResponseTime: avg(glmCallLogs.processingTime)
      })
      .from(glmCallLogs)
      .leftJoin(users, eq(glmCallLogs.userId, users.id))
      .where(between(glmCallLogs.createdAt, reportStartDate, reportEndDate))
      .groupBy(glmCallLogs.userId)
      .orderBy(desc(sum(glmCallLogs.totalTokens)))
      .limit(20);

    const byUser = userStats.map(stat => ({
      userId: Number(stat.userId),
      username: stat.username || `User ${stat.userId}`,
      usage: {
        totalRequests: Number(stat.totalRequests) || 0,
        successfulRequests: Number(stat.successfulRequests) || 0,
        failedRequests: Number(stat.failedRequests) || 0,
        totalTokens: Number(stat.totalTokens) || 0,
        promptTokens: 0, // 需要额外查询
        completionTokens: 0, // 需要额外查询
        totalCost: Number(stat.totalCost) || 0,
        averageResponseTime: Number(stat.averageResponseTime) || 0,
        averageRetryCount: 0, // 需要额外查询
        successRate: Number(stat.totalRequests) > 0 
          ? (Number(stat.successfulRequests) / Number(stat.totalRequests)) * 100 
          : 0,
        errorRate: Number(stat.totalRequests) > 0 
          ? (Number(stat.failedRequests) / Number(stat.totalRequests)) * 100 
          : 0
      }
    }));

    return {
      overall,
      byModel,
      byUser,
      timeSeries,
      monitoring,
      topErrors,
      generatedAt: new Date()
    };
  }

  /**
   * 获取当前监控指标
   */
  async getCurrentMetrics(): Promise<MonitoringMetrics> {
    // 获取队列状态
    const queueMetrics = await this.getQueueMetrics();
    
    // 获取最近的错误率
    const recentErrorRate = await this.getRecentErrorRate();
    
    // 获取最近的错误
    const lastError = await this.getLastError();
    
    // 确定系统健康状态
    const systemHealth = this.determineSystemHealth(
      queueMetrics.currentConcurrency,
      queueMetrics.queueLength,
      recentErrorRate
    );

    return {
      currentConcurrency: queueMetrics.currentConcurrency,
      queueLength: queueMetrics.queueLength,
      averageWaitTime: queueMetrics.averageWaitTime,
      averageProcessingTime: queueMetrics.averageProcessingTime,
      errorRate: recentErrorRate,
      lastError,
      systemHealth,
      lastHealthCheck: new Date()
    };
  }

  /**
   * 获取队列指标
   */
  private async getQueueMetrics(): Promise<{
    currentConcurrency: number;
    queueLength: number;
    averageWaitTime: number;
    averageProcessingTime: number;
  }> {
    // 这里需要从实际的队列控制器获取指标
    // 暂时返回模拟数据
    return {
      currentConcurrency: 0,
      queueLength: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0
    };
  }

  /**
   * 获取最近的错误率
   */
  private async getRecentErrorRate(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const result = await db
      .select({
        total: count(),
        errors: count(sql`CASE WHEN status = 'failed' THEN 1 END`)
      })
      .from(glmCallLogs)
      .where(gte(glmCallLogs.createdAt, oneHourAgo));

    const stats = result[0] || { total: 0, errors: 0 };
    return Number(stats.total) > 0 ? (Number(stats.errors) / Number(stats.total)) * 100 : 0;
  }

  /**
   * 获取最近的错误
   */
  private async getLastError(): Promise<GLMError | undefined> {
    const result = await db
      .select({ error: glmCallLogs.error })
      .from(glmCallLogs)
      .where(eq(glmCallLogs.status, 'failed'))
      .orderBy(desc(glmCallLogs.createdAt))
      .limit(1);

    if (result.length === 0 || !result[0].error) {
      return undefined;
    }

    try {
      const errorData = JSON.parse(result[0].error);
      return new GLMError(
        errorData.code || 'unknown',
        errorData.message || 'Unknown error',
        errorData.details,
        new Date(errorData.timestamp),
        errorData.retryable || false
      );
    } catch {
      return new GLMError('unknown', 'Unknown error', undefined, new Date(), false);
    }
  }

  /**
   * 确定系统健康状态
   */
  private determineSystemHealth(
    currentConcurrency: number,
    queueLength: number,
    errorRate: number
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (errorRate > 20 || queueLength > 100) {
      return 'unhealthy';
    }
    
    if (errorRate > 5 || queueLength > 50 || currentConcurrency > 8) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * 计算提示token成本
   */
  private calculatePromptCost(promptTokens: number, model: string): number {
    const rates: Record<string, number> = {
      'glm-4': 0.0001,
      'glm-4-air': 0.00005,
      'glm-4-airx': 0.0001,
      'glm-4-long': 0.0005,
      'glm-3-turbo': 0.00005
    };
    
    const rate = rates[model] || 0.0001;
    return (promptTokens / 1000) * rate;
  }

  /**
   * 计算补全token成本
   */
  private calculateCompletionCost(completionTokens: number, model: string): number {
    const rates: Record<string, number> = {
      'glm-4': 0.0002,
      'glm-4-air': 0.0001,
      'glm-4-airx': 0.0002,
      'glm-4-long': 0.001,
      'glm-3-turbo': 0.0001
    };
    
    const rate = rates[model] || 0.0002;
    return (completionTokens / 1000) * rate;
  }

  /**
   * 提取错误消息
   */
  private extractErrorMessage(errorJson: string | null): string {
    if (!errorJson) return 'Unknown error';
    
    try {
      const errorData = JSON.parse(errorJson);
      return errorData.message || errorData.code || 'Unknown error';
    } catch {
      return 'Unknown error';
    }
  }

  /**
   * 启动指标收集
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        this.currentMetrics = await this.getCurrentMetrics();
        
        // 记录监控数据
        await db.insert(glmMonitoring).values({
          metrics: JSON.stringify(this.currentMetrics),
          createdAt: new Date()
        });
        
        // 清理过期的监控数据（保留30天）
        const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await db
          .delete(glmMonitoring)
          .where(lt(glmMonitoring.createdAt, cutoffDate));
          
      } catch (error) {
        console.error('Error collecting GLM monitoring metrics:', error);
      }
    }, 60000); // 每分钟收集一次
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const metrics = await this.getCurrentMetrics();
        
        // 如果系统状态异常，发送警报
        if (metrics.systemHealth === 'unhealthy') {
          console.warn('GLM System Health Check: Unhealthy', metrics);
          // 这里可以添加发送邮件或通知的逻辑
        }
        
      } catch (error) {
        console.error('Error during GLM health check:', error);
      }
    }, 5 * 60 * 1000); // 每5分钟检查一次
  }

  /**
   * 获取用户成本统计
   */
  async getUserCostStats(
    userId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalCost: number;
    dailyAverage: number;
    monthlyTotal: number;
    costByModel: CostBreakdown[];
    costTrend: TimeSeriesData[];
  }> {
    const conditions = [eq(glmCallLogs.userId, userId)];
    
    if (startDate && endDate) {
      conditions.push(between(glmCallLogs.createdAt, startDate, endDate));
    } else if (startDate) {
      conditions.push(gte(glmCallLogs.createdAt, startDate));
    }

    // 获取总成本
    const totalCostResult = await db
      .select({ total: sum(glmCallLogs.cost) })
      .from(glmCallLogs)
      .where(and(...conditions));

    const totalCost = Number(totalCostResult[0]?.total) || 0;

    // 获取月度成本
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyResult = await db
      .select({ total: sum(glmCallLogs.cost) })
      .from(glmCallLogs)
      .where(and(
        eq(glmCallLogs.userId, userId),
        gte(glmCallLogs.createdAt, monthStart)
      ));

    const monthlyTotal = Number(monthlyResult[0]?.total) || 0;

    // 计算日均成本
    const daysDiff = startDate && endDate 
      ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      : 30;
    
    const dailyAverage = daysDiff > 0 ? totalCost / daysDiff : 0;

    // 获取按模型分组的成本
    const costByModel = await this.getCostByModelForUser(userId, startDate, endDate);

    // 获取成本趋势
    const trendStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const trendEndDate = endDate || new Date();
    const costTrend = await this.getTimeSeriesData(trendStartDate, trendEndDate, 'day');

    return {
      totalCost,
      dailyAverage,
      monthlyTotal,
      costByModel,
      costTrend
    };
  }

  /**
   * 获取用户的按模型分组的成本
   */
  private async getCostByModelForUser(
    userId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<CostBreakdown[]> {
    const conditions = [eq(glmCallLogs.userId, userId)];
    
    if (startDate && endDate) {
      conditions.push(between(glmCallLogs.createdAt, startDate, endDate));
    } else if (startDate) {
      conditions.push(gte(glmCallLogs.createdAt, startDate));
    }

    const modelStats = await db
      .select({
        model: glmCallLogs.model,
        promptTokens: sum(glmCallLogs.promptTokens),
        completionTokens: sum(glmCallLogs.completionTokens),
        totalCost: sum(glmCallLogs.cost),
        requestCount: count()
      })
      .from(glmCallLogs)
      .leftJoin(glmConfigs, eq(glmCallLogs.configId, glmConfigs.id))
      .where(and(...conditions))
      .groupBy(glmCallLogs.model);

    return modelStats.map(stat => ({
      model: stat.model || 'unknown',
      promptTokens: Number(stat.promptTokens) || 0,
      completionTokens: Number(stat.completionTokens) || 0,
      promptCost: this.calculatePromptCost(Number(stat.promptTokens) || 0, stat.model || 'unknown'),
      completionCost: this.calculateCompletionCost(Number(stat.completionTokens) || 0, stat.model || 'unknown'),
      totalCost: Number(stat.totalCost) || 0,
      requestCount: Number(stat.requestCount) || 0,
      averageTokensPerRequest: Number(stat.requestCount) > 0 
        ? (Number(stat.promptTokens) + Number(stat.completionTokens)) / Number(stat.requestCount) 
        : 0
    }));
  }

  /**
   * 关闭监控服务
   */
  async shutdown(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    console.log('GLM Monitoring Service shutdown complete');
  }
}

// 创建监控服务的工厂函数
export function createGLMMonitoringService(): GLMMonitoringService {
  return new GLMMonitoringService();
}