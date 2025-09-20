// src/services/queue/llm-queue-controller.ts
// LLM处理队列控制器 - 严格控制并发数为1

import type { MessageBatch } from '@cloudflare/workers-types';
import { QueueMessage } from './types';

export interface LLMQueueConfig {
  maxConcurrency: number;           // 最大并发数（固定为1）
  batchSize: number;                // 批处理大小
  maxRetries: number;               // 最大重试次数
  retryDelay: number;               // 重试延迟（毫秒）
  processingTimeout: number;        // 处理超时时间
}

export interface LLMProcessingStats {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  averageProcessingTime: number;
  currentConcurrency: number;
  queueSize: number;
}

export class LLMQueueController {
  private readonly config: LLMQueueConfig;
  private isProcessing: boolean = false;
  private currentProcessingMessage: string | null = null;
  private processingStartTime: number = 0;
  private stats: LLMProcessingStats;

  constructor(config: Partial<LLMQueueConfig> = {}) {
    this.config = {
      maxConcurrency: 1,              // 严格限制为1个并发
      batchSize: config.batchSize || 1,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000,
      processingTimeout: config.processingTimeout || 300000 // 5分钟超时
    };

    this.stats = {
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      averageProcessingTime: 0,
      currentConcurrency: 0,
      queueSize: 0
    };
  }

  /**
   * 启动LLM处理队列控制器
   */
  async startLLMProcessing(
    queue: any,
    handler: (message: QueueMessage) => Promise<void>
  ): Promise<void> {
    console.log('启动LLM处理队列控制器，配置:', JSON.stringify(this.config, null, 2));

    queue.batch(async (batch: MessageBatch<any>) => {
      // 严格串行处理，一次只处理一个消息
      for (const message of batch.messages) {
        await this.processSingleMessage(message, handler);
      }
    });

    console.log('LLM处理队列控制器启动成功');
  }

  /**
   * 处理单个消息 - 严格串行处理
   */
  private async processSingleMessage(
    message: any,
    handler: (message: QueueMessage) => Promise<void>
  ): Promise<void> {
    // 如果正在处理其他消息，等待
    while (this.isProcessing) {
      console.log('LLM正在处理其他消息，等待...');
      await this.delay(1000); // 1秒后重试
    }

    const startTime = Date.now();
    this.isProcessing = true;
    this.currentProcessingMessage = message.id;
    this.processingStartTime = startTime;
    this.stats.currentConcurrency = 1;

    try {
      console.log(`开始LLM处理消息: ${message.id}`);

      // 解析消息
      const queueMessage = this.parseMessage(message);

      // 检查重试次数
      if (queueMessage.attempts >= this.config.maxRetries) {
        throw new Error(`消息 ${queueMessage.id} 已达到最大重试次数 (${this.config.maxRetries})`);
      }

      // 设置处理超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`LLM处理超时 (${this.config.processingTimeout}ms)`));
        }, this.config.processingTimeout);
      });

      // 执行LLM处理，带超时控制
      await Promise.race([
        handler(queueMessage),
        timeoutPromise
      ]);

      const processingTime = Date.now() - startTime;
      this.updateStats(true, processingTime);

      console.log(`LLM处理成功: ${message.id}, 耗时: ${processingTime}ms`);

      // 自动确认消息（Cloudflare Queues会自动处理）
      message.ack?.();

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(false, processingTime);

      console.error(`LLM处理失败: ${message.id}, 耗时: ${processingTime}ms`, error);

      // 根据错误类型决定是否重试
      if (this.shouldRetry(error as Error)) {
        console.log(`LLM处理失败，将重试: ${message.id}`);
        
        // 延迟后重试
        if (message.retry) {
          message.retry({ delay: this.config.retryDelay });
        }
      } else {
        console.error(`LLM处理失败，不重试: ${message.id}`);
        // 不重试的消息直接确认
        message.ack?.();
      }

    } finally {
      this.isProcessing = false;
      this.currentProcessingMessage = null;
      this.stats.currentConcurrency = 0;
    }
  }

  /**
   * 解析消息
   */
  private parseMessage(message: any): QueueMessage {
    try {
      const body = message.body;
      
      return {
        id: body.id || message.id,
        type: body.type,
        payload: body.payload,
        timestamp: new Date(body.timestamp),
        attempts: body.attempts || 0,
        maxRetries: body.maxRetries || this.config.maxRetries
      };
    } catch (error) {
      throw new Error(`消息解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    
    // 网络错误和临时错误可以重试
    const retryableErrors = [
      'timeout',
      'network',
      'connection',
      'temporary',
      'rate limit',
      'quota exceeded',
      'api error',
      'service unavailable'
    ];

    return retryableErrors.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * 更新统计信息
   */
  private updateStats(success: boolean, processingTime: number): void {
    this.stats.totalProcessed++;
    
    if (success) {
      this.stats.successCount++;
    } else {
      this.stats.failureCount++;
    }

    // 计算平均处理时间
    const totalTime = this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) + processingTime;
    this.stats.averageProcessingTime = totalTime / this.stats.totalProcessed;
  }

  /**
   * 获取当前处理状态
   */
  getProcessingStatus(): {
    isProcessing: boolean;
    currentMessage: string | null;
    processingTime: number;
    config: LLMQueueConfig;
  } {
    const processingTime = this.isProcessing && this.processingStartTime > 0
      ? Date.now() - this.processingStartTime
      : 0;

    return {
      isProcessing: this.isProcessing,
      currentMessage: this.currentProcessingMessage,
      processingTime,
      config: this.config
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): LLMProcessingStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      averageProcessingTime: 0,
      currentConcurrency: this.stats.currentConcurrency,
      queueSize: this.stats.queueSize
    };
  }

  /**
   * 检查队列健康状态
   */
  getHealthStatus(): {
    isHealthy: boolean;
    issues: string[];
    currentLoad: number;
  } {
    const issues: string[] = [];
    let isHealthy = true;

    // 检查并发控制
    if (this.stats.currentConcurrency > this.config.maxConcurrency) {
      issues.push(`并发数超限: ${this.stats.currentConcurrency}/${this.config.maxConcurrency}`);
      isHealthy = false;
    }

    // 检查失败率
    const failureRate = this.stats.totalProcessed > 0 
      ? (this.stats.failureCount / this.stats.totalProcessed) * 100 
      : 0;

    if (failureRate > 20) { // 失败率超过20%
      issues.push(`失败率过高: ${failureRate.toFixed(1)}%`);
      isHealthy = false;
    }

    // 检查平均处理时间
    if (this.stats.averageProcessingTime > this.config.processingTimeout * 0.8) {
      issues.push(`处理时间过长: ${this.stats.averageProcessingTime}ms`);
      isHealthy = false;
    }

    return {
      isHealthy,
      issues,
      currentLoad: this.stats.currentConcurrency / this.config.maxConcurrency
    };
  }

  /**
   * 延迟工具
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 强制停止当前处理（用于紧急情况）
   */
  async forceStop(): Promise<void> {
    if (this.isProcessing) {
      console.warn(`强制停止LLM处理: ${this.currentProcessingMessage}`);
      this.isProcessing = false;
      this.currentProcessingMessage = null;
      this.stats.currentConcurrency = 0;
    }
  }
}

// 默认配置 - 专为LLM处理优化
export const DEFAULT_LLM_QUEUE_CONFIG: LLMQueueConfig = {
  maxConcurrency: 1,        // 严格串行处理
  batchSize: 1,             // 单条处理
  maxRetries: 3,            // 最多重试3次
  retryDelay: 5000,         // 5秒重试间隔
  processingTimeout: 300000 // 5分钟处理超时
};