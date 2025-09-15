// GLM 请求队列管理服务 - 负责管理AI请求的队列处理
import { GLMRequest, GLMResponse, GLMError } from '../config/glm.config';
import { GLMAPIClient } from './glm-client';
import { GLMRetryHandler, RetryResult } from './retry-handler';
import { GLMConcurrencyController } from './concurrency-controller';
import { db } from '../../db';
import { 
  glmConfigs, 
  glmUsageStats, 
  glmRequestQueue, 
  glmCallLogs,
  users 
} from '../../db/schema';
import { eq, and, desc, sql, lt, gte, isNull } from 'drizzle-orm';

export interface QueueItem {
  id: string;
  userId: number;
  configId: number;
  contentId: string;
  request: GLMRequest;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: GLMError;
  response?: GLMResponse;
  retryCount: number;
  maxRetries: number;
}

export interface QueueMetrics {
  pendingItems: number;
  processingItems: number;
  completedItems: number;
  failedItems: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  totalItems: number;
  successRate: number;
}

export interface ProcessingResult {
  success: boolean;
  queueItem: QueueItem;
  response?: GLMResponse;
  error?: GLMError;
  processingTime: number;
  retryCount: number;
}

export class GLMRequestQueueManager {
  private concurrencyController: GLMConcurrencyController;
  private retryHandler: GLMRetryHandler;
  private isProcessing: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  private maxBatchSize: number = 10;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    concurrencyController: GLMConcurrencyController,
    retryHandler: GLMRetryHandler
  ) {
    this.concurrencyController = concurrencyController;
    this.retryHandler = retryHandler;
    this.startQueueProcessor();
    this.startCleanupProcess();
  }

  /**
   * 添加请求到队列
   */
  async enqueueRequest(
    userId: number,
    configId: number,
    contentId: string,
    request: GLMRequest,
    priority: number = 0
  ): Promise<string> {
    const queueId = this.generateQueueId();
    
    // 检查用户配额
    const quotaCheck = await this.checkUserQuota(userId);
    if (!quotaCheck.allowed) {
      throw new GLMError(
        'quota_exceeded',
        quotaCheck.reason || 'User quota exceeded',
        { userId, limit: quotaCheck.limit },
        new Date(),
        false
      );
    }

    // 获取GLM配置
    const config = await this.getGLMConfig(configId);
    if (!config) {
      throw new GLMError(
        'config_not_found',
        'GLM configuration not found',
        { configId },
        new Date(),
        false
      );
    }

    // 检查配置状态
    if (!config.isActive) {
      throw new GLMError(
        'config_inactive',
        'GLM configuration is inactive',
        { configId },
        new Date(),
        false
      );
    }

    // 插入队列记录
    await db.insert(glmRequestQueue).values({
      id: queueId,
      userId,
      configId,
      contentId,
      request: JSON.stringify(request),
      priority,
      status: 'pending',
      retryCount: 0,
      maxRetries: config.maxRetries || 3,
      createdAt: new Date()
    });

    console.log(`GLM request queued: ${queueId} for user ${userId}`);
    return queueId;
  }

  /**
   * 批量添加请求到队列
   */
  async enqueueBatch(
    userId: number,
    configId: number,
    requests: Array<{ contentId: string; request: GLMRequest; priority?: number }>
  ): Promise<string[]> {
    const queueIds: string[] = [];
    
    // 检查用户配额
    const quotaCheck = await this.checkUserQuota(userId, requests.length);
    if (!quotaCheck.allowed) {
      throw new GLMError(
        'quota_exceeded',
        quotaCheck.reason || 'User quota exceeded',
        { userId, limit: quotaCheck.limit },
        new Date(),
        false
      );
    }

    // 获取GLM配置
    const config = await this.getGLMConfig(configId);
    if (!config) {
      throw new GLMError(
        'config_not_found',
        'GLM configuration not found',
        { configId },
        new Date(),
        false
      );
    }

    // 准备批量插入数据
    const queueItems = requests.map((item, index) => ({
      id: this.generateQueueId(),
      userId,
      configId,
      contentId: item.contentId,
      request: JSON.stringify(item.request),
      priority: item.priority || 0,
      status: 'pending' as const,
      retryCount: 0,
      maxRetries: config.maxRetries || 3,
      createdAt: new Date()
    }));

    // 批量插入
    await db.insert(glmRequestQueue).values(queueItems);
    
    queueIds.push(...queueItems.map(item => item.id));
    console.log(`GLM batch request queued: ${queueItems.length} items for user ${userId}`);
    
    return queueIds;
  }

  /**
   * 启动队列处理器
   */
  private startQueueProcessor(): void {
    const processQueue = async () => {
      if (this.isProcessing) return;
      
      this.isProcessing = true;
      try {
        await this.processPendingRequests();
      } catch (error) {
        console.error('Error processing GLM request queue:', error);
      } finally {
        this.isProcessing = false;
      }
    };

    // 每2秒检查一次队列
    this.processingInterval = setInterval(processQueue, 2000);
    
    // 立即执行一次
    processQueue();
  }

  /**
   * 处理待处理请求
   */
  private async processPendingRequests(): Promise<void> {
    // 获取待处理的请求（按优先级排序）
    const pendingItems = await db
      .select()
      .from(glmRequestQueue)
      .where(and(
        eq(glmRequestQueue.status, 'pending'),
        isNull(glmRequestQueue.error)
      ))
      .orderBy(desc(glmRequestQueue.priority), glmRequestQueue.createdAt)
      .limit(this.maxBatchSize);

    if (pendingItems.length === 0) return;

    console.log(`Processing ${pendingItems.length} GLM requests from queue`);

    // 并行处理请求（受并发控制器限制）
    const processingPromises = pendingItems.map(async (item) => {
      try {
        return await this.processQueueItem(item);
      } catch (error) {
        console.error(`Error processing queue item ${item.id}:`, error);
        return {
          success: false,
          queueItem: item,
          error: error instanceof GLMError ? error : new GLMError(
            'processing_error',
            error instanceof Error ? error.message : 'Unknown error',
            { originalError: error },
            new Date(),
            false
          ),
          processingTime: 0,
          retryCount: item.retryCount
        };
      }
    });

    const results = await Promise.allSettled(processingPromises);
    
    // 处理结果
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value) {
        const processingResult = result.value;
        await this.updateQueueItemStatus(pendingItems[i], processingResult);
      }
    }
  }

  /**
   * 处理单个队列项
   */
  private async processQueueItem(item: any): Promise<ProcessingResult> {
    const startTime = Date.now();
    const request = JSON.parse(item.request);
    
    // 更新状态为处理中
    await db
      .update(glmRequestQueue)
      .set({
        status: 'processing',
        startedAt: new Date(),
        retryCount: sql`${glmRequestQueue.retryCount} + 1`
      })
      .where(eq(glmRequestQueue.id, item.id));

    try {
      // 获取GLM配置创建客户端
      const config = await this.getGLMConfig(item.configId);
      if (!config) {
        throw new GLMError('config_not_found', 'GLM configuration not found');
      }

      // 创建GLM客户端
      const client = new GLMAPIClient({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        timeout: config.timeout,
        model: config.model
      });

      // 执行带重试的请求
      const retryResult = await this.retryHandler.executeWithRetry(
        client,
        {
          ...request,
          maxTokens: config.maxTokens,
          temperature: config.temperature
        },
        config.maxRetries
      );

      if (retryResult.success && retryResult.response) {
        const processingTime = Date.now() - startTime;
        
        // 记录使用统计
        await this.recordUsageStats(
          item.userId,
          item.configId,
          retryResult.response,
          processingTime
        );

        // 记录调用日志
        await this.recordCallLog(
          item.userId,
          item.configId,
          item.contentId,
          request,
          retryResult.response,
          processingTime,
          retryResult.attempts - 1
        );

        return {
          success: true,
          queueItem: item,
          response: retryResult.response,
          processingTime,
          retryCount: retryResult.attempts - 1
        };
      } else {
        throw retryResult.error || new GLMError('processing_failed', 'Processing failed');
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const glmError = this.normalizeError(error);
      
      // 记录错误日志
      await this.recordErrorLog(
        item.userId,
        item.configId,
        item.contentId,
        request,
        glmError,
        processingTime
      );

      return {
        success: false,
        queueItem: item,
        error: glmError,
        processingTime,
        retryCount: item.retryCount
      };
    }
  }

  /**
   * 更新队列项状态
   */
  private async updateQueueItemStatus(
    queueItem: any,
    result: ProcessingResult
  ): Promise<void> {
    const updateData: any = {
      status: result.success ? 'completed' : 'failed',
      completedAt: new Date(),
      retryCount: result.retryCount
    };

    if (result.success) {
      updateData.response = JSON.stringify(result.response);
      updateData.error = null;
    } else {
      updateData.error = JSON.stringify(result.error);
      
      // 检查是否需要重试
      if (result.error.retryable && result.retryCount < queueItem.maxRetries) {
        updateData.status = 'pending';
        updateData.startedAt = null;
        updateData.completedAt = null;
      }
    }

    await db
      .update(glmRequestQueue)
      .set(updateData)
      .where(eq(glmRequestQueue.id, queueItem.id));
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus(userId?: number): Promise<QueueMetrics> {
    const conditions = [];
    if (userId) {
      conditions.push(eq(glmRequestQueue.userId, userId));
    }

    const [pending, processing, completed, failed, total] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(glmRequestQueue)
        .where(and(eq(glmRequestQueue.status, 'pending'), ...conditions)),
      
      db
        .select({ count: sql<number>`count(*)` })
        .from(glmRequestQueue)
        .where(and(eq(glmRequestQueue.status, 'processing'), ...conditions)),
      
      db
        .select({ count: sql<number>`count(*)` })
        .from(glmRequestQueue)
        .where(and(eq(glmRequestQueue.status, 'completed'), ...conditions)),
      
      db
        .select({ count: sql<number>`count(*)` })
        .from(glmRequestQueue)
        .where(and(eq(glmRequestQueue.status, 'failed'), ...conditions)),
      
      db
        .select({ count: sql<number>`count(*)` })
        .from(glmRequestQueue)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
    ]);

    const successRate = total[0].count > 0 
      ? completed[0].count / total[0].count 
      : 0;

    // 计算平均等待和处理时间
    const avgTimes = await this.calculateAverageTimes(conditions);

    return {
      pendingItems: pending[0].count,
      processingItems: processing[0].count,
      completedItems: completed[0].count,
      failedItems: failed[0].count,
      totalItems: total[0].count,
      successRate,
      averageWaitTime: avgTimes.averageWaitTime,
      averageProcessingTime: avgTimes.averageProcessingTime
    };
  }

  /**
   * 计算平均等待和处理时间
   */
  private async calculateAverageTimes(conditions: any[]): Promise<{
    averageWaitTime: number;
    averageProcessingTime: number;
  }> {
    const completedItems = await db
      .select({
        waitTime: sql<number>`(strftime('%s', startedAt) - strftime('%s', createdAt)) * 1000`,
        processingTime: sql<number>`(strftime('%s', completedAt) - strftime('%s', startedAt)) * 1000`
      })
      .from(glmRequestQueue)
      .where(and(
        eq(glmRequestQueue.status, 'completed'),
        ...conditions,
        isNull(glmRequestQueue.error)
      ));

    if (completedItems.length === 0) {
      return { averageWaitTime: 0, averageProcessingTime: 0 };
    }

    const totalWaitTime = completedItems.reduce((sum, item) => sum + (item.waitTime || 0), 0);
    const totalProcessingTime = completedItems.reduce((sum, item) => sum + (item.processingTime || 0), 0);

    return {
      averageWaitTime: totalWaitTime / completedItems.length,
      averageProcessingTime: totalProcessingTime / completedItems.length
    };
  }

  /**
   * 清理过期队列项
   */
  private async cleanupExpiredItems(): Promise<void> {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7天前
    
    await db
      .delete(glmRequestQueue)
      .where(and(
        eq(glmRequestQueue.status, 'completed'),
        lt(glmRequestQueue.completedAt, cutoffDate)
      ));
  }

  /**
   * 启动清理进程
   */
  private startCleanupProcess(): void {
    // 每小时清理一次过期数据
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredItems().catch(error => {
        console.error('Error cleaning up expired queue items:', error);
      });
    }, 60 * 60 * 1000);
  }

  /**
   * 检查用户配额
   */
  private async checkUserQuota(userId: number, requestCount: number = 1): Promise<{
    allowed: boolean;
    reason?: string;
    limit?: number;
  }> {
    // 获取用户配置
    const userConfig = await db
      .select()
      .from(glmConfigs)
      .where(and(
        eq(glmConfigs.userId, userId),
        eq(glmConfigs.isActive, true)
      ))
      .limit(1);

    if (userConfig.length === 0) {
      return { allowed: false, reason: 'No active GLM configuration found' };
    }

    const config = userConfig[0];
    
    // 检查日限制
    if (config.dailyLimit) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dailyUsage = await db
        .select({ count: sql<number>`count(*)` })
        .from(glmCallLogs)
        .where(and(
          eq(glmCallLogs.userId, userId),
          gte(glmCallLogs.createdAt, today)
        ));

      if (dailyUsage[0].count + requestCount > config.dailyLimit) {
        return { 
          allowed: false, 
          reason: `Daily limit exceeded (${dailyUsage[0].count}/${config.dailyLimit})`,
          limit: config.dailyLimit 
        };
      }
    }

    // 检查月限制
    if (config.monthlyLimit) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      
      const monthlyUsage = await db
        .select({ count: sql<number>`count(*)` })
        .from(glmCallLogs)
        .where(and(
          eq(glmCallLogs.userId, userId),
          gte(glmCallLogs.createdAt, monthStart)
        ));

      if (monthlyUsage[0].count + requestCount > config.monthlyLimit) {
        return { 
          allowed: false, 
          reason: `Monthly limit exceeded (${monthlyUsage[0].count}/${config.monthlyLimit})`,
          limit: config.monthlyLimit 
        };
      }
    }

    return { allowed: true };
  }

  /**
   * 获取GLM配置
   */
  private async getGLMConfig(configId: number) {
    const result = await db
      .select()
      .from(glmConfigs)
      .where(eq(glmConfigs.id, configId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * 记录使用统计
   */
  private async recordUsageStats(
    userId: number,
    configId: number,
    response: GLMResponse,
    processingTime: number
  ): Promise<void> {
    await db.insert(glmUsageStats).values({
      userId,
      configId,
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      processingTime,
      cost: this.calculateCost(response.usage.prompt_tokens, response.usage.completion_tokens),
      createdAt: new Date()
    });
  }

  /**
   * 记录调用日志
   */
  private async recordCallLog(
    userId: number,
    configId: number,
    contentId: string,
    request: GLMRequest,
    response: GLMResponse,
    processingTime: number,
    retryCount: number
  ): Promise<void> {
    await db.insert(glmCallLogs).values({
      userId,
      configId,
      contentId,
      request: JSON.stringify(request),
      response: JSON.stringify(response),
      status: 'success',
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      processingTime,
      retryCount,
      createdAt: new Date()
    });
  }

  /**
   * 记录错误日志
   */
  private async recordErrorLog(
    userId: number,
    configId: number,
    contentId: string,
    request: GLMRequest,
    error: GLMError,
    processingTime: number
  ): Promise<void> {
    await db.insert(glmCallLogs).values({
      userId,
      configId,
      contentId,
      request: JSON.stringify(request),
      error: JSON.stringify(error),
      status: 'failed',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      processingTime,
      retryCount: 0,
      createdAt: new Date()
    });
  }

  /**
   * 计算成本
   */
  private calculateCost(promptTokens: number, completionTokens: number): number {
    // 简化的成本计算，可以根据实际模型价格调整
    const promptCost = (promptTokens / 1000) * 0.0001;
    const completionCost = (completionTokens / 1000) * 0.0002;
    return promptCost + completionCost;
  }

  /**
   * 标准化错误对象
   */
  private normalizeError(error: any): GLMError {
    if (error instanceof GLMError) {
      return error;
    }

    return new GLMError(
      'unknown_error',
      error instanceof Error ? error.message : 'Unknown error',
      { originalError: error },
      new Date(),
      false
    );
  }

  /**
   * 生成队列ID
   */
  private generateQueueId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取用户队列状态
   */
  async getUserQueueStatus(userId: number): Promise<{
    pending: any[];
    processing: any[];
    recentCompleted: any[];
    recentFailed: any[];
  }> {
    const [pending, processing, recentCompleted, recentFailed] = await Promise.all([
      db
        .select()
        .from(glmRequestQueue)
        .where(and(
          eq(glmRequestQueue.userId, userId),
          eq(glmRequestQueue.status, 'pending')
        ))
        .orderBy(glmRequestQueue.createdAt)
        .limit(10),
      
      db
        .select()
        .from(glmRequestQueue)
        .where(and(
          eq(glmRequestQueue.userId, userId),
          eq(glmRequestQueue.status, 'processing')
        ))
        .orderBy(glmRequestQueue.createdAt)
        .limit(10),
      
      db
        .select()
        .from(glmRequestQueue)
        .where(and(
          eq(glmRequestQueue.userId, userId),
          eq(glmRequestQueue.status, 'completed')
        ))
        .orderBy(desc(glmRequestQueue.completedAt))
        .limit(5),
      
      db
        .select()
        .from(glmRequestQueue)
        .where(and(
          eq(glmRequestQueue.userId, userId),
          eq(glmRequestQueue.status, 'failed')
        ))
        .orderBy(desc(glmRequestQueue.completedAt))
        .limit(5)
    ]);

    return {
      pending,
      processing,
      recentCompleted,
      recentFailed
    };
  }

  /**
   * 取消队列中的请求
   */
  async cancelRequest(queueId: string, userId: number): Promise<boolean> {
    const result = await db
      .update(glmRequestQueue)
      .set({
        status: 'failed',
        completedAt: new Date(),
        error: JSON.stringify(new GLMError(
          'cancelled',
          'Request cancelled by user',
          { userId },
          new Date(),
          false
        ))
      })
      .where(and(
        eq(glmRequestQueue.id, queueId),
        eq(glmRequestQueue.userId, userId),
        eq(glmRequestQueue.status, 'pending')
      ));

    return result.changes > 0;
  }

  /**
   * 关闭队列管理器
   */
  async shutdown(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    console.log('GLM Request Queue Manager shutdown complete');
  }
}

// 创建队列管理器的工厂函数
export function createGLMRequestQueueManager(
  concurrencyController: GLMConcurrencyController,
  retryHandler: GLMRetryHandler
): GLMRequestQueueManager {
  return new GLMRequestQueueManager(concurrencyController, retryHandler);
}