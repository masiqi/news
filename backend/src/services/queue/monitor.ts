// src/services/queue/monitor.ts
import { QueueMessage, QueueMonitor, QueueStats, MessageHistory } from './types';

export class QueueMonitorService implements QueueMonitor {
  private queue: any; // Cloudflare Queue binding
  private statsCache: Map<string, QueueStats> = new Map();
  private historyCache: Map<string, MessageHistory[]> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5分钟缓存

  constructor(queue: any) {
    this.queue = queue;
  }

  /**
   * 获取队列统计信息
   */
  async getQueueStats(queueName?: string): Promise<QueueStats> {
    const targetQueue = queueName || 'default';
    
    // 检查缓存
    const cachedStats = this.statsCache.get(targetQueue);
    if (cachedStats && !this.isCacheExpired(cachedStats.lastUpdated)) {
      return cachedStats;
    }

    try {
      // 从Cloudflare Queues获取统计信息
      const queueStats = await this.fetchQueueStatsFromCloudflare(targetQueue);
      
      // 更新缓存
      this.statsCache.set(targetQueue, queueStats);
      
      return queueStats;
    } catch (error) {
      console.error('获取队列统计信息失败:', error);
      
      // 返回缓存的统计信息（如果存在）
      if (cachedStats) {
        console.warn('使用缓存的队列统计信息');
        return cachedStats;
      }
      
      // 返回默认统计信息
      return this.getDefaultQueueStats(targetQueue);
    }
  }

  /**
   * 获取消息历史记录
   */
  async getMessageHistory(messageId: string): Promise<MessageHistory[]> {
    // 检查缓存
    const cachedHistory = this.historyCache.get(messageId);
    if (cachedHistory && cachedHistory.length > 0) {
      const latestRecord = cachedHistory[cachedHistory.length - 1];
      if (!this.isCacheExpired(latestRecord.timestamp)) {
        return cachedHistory;
      }
    }

    try {
      // 从数据库或日志中获取消息历史
      const history = await this.fetchMessageHistoryFromStorage(messageId);
      
      // 更新缓存
      this.historyCache.set(messageId, history);
      
      return history;
    } catch (error) {
      console.error(`获取消息历史记录失败: ${messageId}`, error);
      
      // 返回缓存的历史记录（如果存在）
      if (cachedHistory) {
        console.warn(`使用缓存的消息历史记录: ${messageId}`);
        return cachedHistory;
      }
      
      // 返回默认历史记录
      return [];
    }
  }

  /**
   * 获取失败的消息列表
   */
  async getFailedMessages(): Promise<QueueMessage[]> {
    try {
      // 从死信队列中获取失败的消息
      const failedMessages = await this.fetchFailedMessagesFromDeadLetterQueue();
      
      return failedMessages;
    } catch (error) {
      console.error('获取失败消息失败:', error);
      return [];
    }
  }

  /**
   * 从Cloudflare Queues获取统计信息
   */
  private async fetchQueueStatsFromCloudflare(queueName: string): Promise<QueueStats> {
    // 注意：Cloudflare Queues的API可能会变化
    // 这里使用模拟的实现，实际使用时需要根据Cloudflare的API调整
    
    try {
      // 尝试获取队列的统计信息
      const queueInfo = await this.queue.info();
      
      return {
        queueName,
        pendingMessages: queueInfo.pending || 0,
        processingMessages: queueInfo.processing || 0,
        failedMessages: queueInfo.failed || 0,
        deadLetterMessages: queueInfo.deadLetter || 0,
        averageProcessingTime: queueInfo.averageProcessingTime || 0,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.warn('无法从Cloudflare Queues获取详细统计信息，使用默认值', error);
      
      return this.getDefaultQueueStats(queueName);
    }
  }

  /**
   * 从存储中获取消息历史
   */
  private async fetchMessageHistoryFromStorage(messageId: string): Promise<MessageHistory[]> {
    // 这里应该从数据库或日志系统中获取消息历史
    // 由于当前系统还没有专门的消息历史表，返回模拟数据
    
    const history: MessageHistory[] = [
      {
        id: this.generateHistoryId(),
        messageId,
        status: 'queued',
        timestamp: new Date(Date.now() - 60000), // 1分钟前
        retryCount: 0
      },
      {
        id: this.generateHistoryId(),
        messageId,
        status: 'processing',
        timestamp: new Date(Date.now() - 30000), // 30秒前
        retryCount: 0
      }
    ];

    return history;
  }

  /**
   * 从死信队列获取失败消息
   */
  private async fetchFailedMessagesFromDeadLetterQueue(): Promise<QueueMessage[]> {
    // 这里应该从死信队列中获取失败的消息
    // 由于Cloudflare Queues的死信队列API限制，返回空数组
    
    console.log('从死信队列获取失败消息（模拟）');
    return [];
  }

  /**
   * 获取默认队列统计信息
   */
  private getDefaultQueueStats(queueName: string): QueueStats {
    return {
      queueName,
      pendingMessages: 0,
      processingMessages: 0,
      failedMessages: 0,
      deadLetterMessages: 0,
      averageProcessingTime: 0,
      lastUpdated: new Date()
    };
  }

  /**
   * 检查缓存是否过期
   */
  private isCacheExpired(lastUpdated: Date): boolean {
    const now = Date.now();
    const cacheTime = lastUpdated.getTime();
    return (now - cacheTime) > this.cacheExpiry;
  }

  /**
   * 生成历史记录ID
   */
  private generateHistoryId(): string {
    return `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.statsCache.clear();
    this.historyCache.clear();
    console.log('队列监控缓存已清除');
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { statsCacheSize: number; historyCacheSize: number } {
    return {
      statsCacheSize: this.statsCache.size,
      historyCacheSize: this.historyCache.size
    };
  }

  /**
   * 监控队列健康状态
   */
  async checkQueueHealth(queueName?: string): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      const stats = await this.getQueueStats(queueName);
      
      // 检查失败消息数量
      if (stats.failedMessages > 10) {
        issues.push(`队列中有大量失败消息: ${stats.failedMessages}`);
      }
      
      // 检查死信队列消息数量
      if (stats.deadLetterMessages > 5) {
        issues.push(`死信队列中有过多消息: ${stats.deadLetterMessages}`);
      }
      
      // 检查平均处理时间
      if (stats.averageProcessingTime > 30000) { // 30秒
        issues.push(`平均处理时间过长: ${stats.averageProcessingTime}ms`);
      }
      
      // 检查积压消息数量
      if (stats.pendingMessages > 100) {
        issues.push(`队列积压消息过多: ${stats.pendingMessages}`);
      }
      
      const healthy = issues.length === 0;
      
      return { healthy, issues };
    } catch (error) {
      console.error('检查队列健康状态失败:', error);
      return {
        healthy: false,
        issues: ['无法获取队列统计信息']
      };
    }
  }
}