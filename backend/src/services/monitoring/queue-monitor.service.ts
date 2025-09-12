import { db } from '../db';
import { queueStatus, systemEventLogs, processingStatuses, messageHistories } from '../db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

export interface QueueMetrics {
  queueName: string;
  pendingMessages: number;
  processingMessages: number;
  failedMessages: number;
  completedMessages: number;
  deadLetterMessages: number;
  avgProcessingTime: number;
  throughput: number;
  lastProcessed: Date;
  maxRetries: number;
  ttl: number;
}

export interface QueueConfig {
  queueName: string;
  maxRetries: number;
  ttl: number;
  warningThreshold: number;
  criticalThreshold: number;
  monitoringInterval: number;
}

export class QueueMonitorService {
  private static instance: QueueMonitorService;
  private queueConfigs: Map<string, QueueConfig> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): QueueMonitorService {
    if (!QueueMonitorService.instance) {
      QueueMonitorService.instance = new QueueMonitorService();
    }
    return QueueMonitorService.instance;
  }

  // 注册队列监控配置
  registerQueueConfig(config: QueueConfig): void {
    this.queueConfigs.set(config.queueName, config);
    console.log(`已注册队列监控配置: ${config.queueName}`);
    
    // 立即执行一次监控
    this.monitorQueue(config.queueName);
    
    // 设置定时监控
    const interval = setInterval(() => {
      this.monitorQueue(config.queueName);
    }, config.monitoringInterval * 1000);
    
    this.monitoringIntervals.set(config.queueName, interval);
  }

  // 取消队列监控
  unregisterQueueConfig(queueName: string): void {
    const interval = this.monitoringIntervals.get(queueName);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(queueName);
    }
    
    this.queueConfigs.delete(queueName);
    console.log(`已取消队列监控: ${queueName}`);
  }

  // 监控队列状态
  async monitorQueue(queueName: string): Promise<QueueMetrics> {
    const config = this.queueConfigs.get(queueName);
    if (!config) {
      throw new Error(`未找到队列 ${queueName} 的监控配置`);
    }

    try {
      // 获取队列状态
      const metrics = await this.getQueueMetrics(queueName);
      
      // 更新数据库中的队列状态
      await this.updateQueueStatus(queueName, metrics);
      
      // 检查队列健康状态
      await this.checkQueueHealth(queueName, metrics, config);
      
      // 记录监控事件
      await this.logQueueMonitoringEvent(queueName, metrics);
      
      return metrics;
    } catch (error) {
      console.error(`监控队列 ${queueName} 失败:`, error);
      throw error;
    }
  }

  private async getQueueMetrics(queueName: string): Promise<QueueMetrics> {
    try {
      // 从数据库获取队列处理状态
      const processingStats = await db
        .select({
          pending: sql<number>`COUNT(CASE WHEN status = 'pending' THEN 1 END)`,
          processing: sql<number>`COUNT(CASE WHEN status = 'processing' THEN 1 END)`,
          failed: sql<number>`COUNT(CASE WHEN status = 'failed' THEN 1 END)`,
          completed: sql<number>`COUNT(CASE WHEN status = 'completed' THEN 1 END)`
        })
        .from(processingStatuses)
        .where(eq(processingStatuses.messageId, `${queueName}_*`));

      // 获取消息历史记录计算处理时间
      const messageHistory = await db
        .select({
          processingTime: messageHistories.processingTime,
          timestamp: messageHistories.timestamp
        })
        .from(messageHistories)
        .where(
          and(
            eq(messageHistories.status, 'completed'),
            gte(messageHistories.timestamp, Date.now() - 60 * 60 * 1000) // 最近1小时
          )
        )
        .limit(100);

      // 计算平均处理时间和吞吐量
      const processingTimes = messageHistory
        .filter(h => h.processingTime && h.processingTime > 0)
        .map(h => h.processingTime);

      const avgProcessingTime = processingTimes.length > 0
        ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length)
        : 0;

      // 计算吞吐量（消息/分钟）
      const completedCount = processingStats[0]?.completed || 0;
      const throughput = completedCount > 0 ? Math.round(completedCount / 60) : 0;

      // 获取死信消息数量
      const deadLetterCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(messageHistories)
        .where(eq(messageHistories.status, 'dead_letter'));

      const metrics: QueueMetrics = {
        queueName,
        pendingMessages: processingStats[0]?.pending || 0,
        processingMessages: processingStats[0]?.processing || 0,
        failedMessages: processingStats[0]?.failed || 0,
        completedMessages: processingStats[0]?.completed || 0,
        deadLetterMessages: deadLetterCount[0]?.count || 0,
        avgProcessingTime,
        throughput,
        lastProcessed: new Date(),
        maxRetries: 3,
        ttl: 86400
      };

      return metrics;
    } catch (error) {
      console.error(`获取队列 ${queueName} 指标失败:`, error);
      
      // 返回默认指标
      return {
        queueName,
        pendingMessages: 0,
        processingMessages: 0,
        failedMessages: 0,
        completedMessages: 0,
        deadLetterMessages: 0,
        avgProcessingTime: 0,
        throughput: 0,
        lastProcessed: new Date(),
        maxRetries: 3,
        ttl: 86400
      };
    }
  }

  private async updateQueueStatus(queueName: string, metrics: QueueMetrics): Promise<void> {
    try {
      await db.insert(queueStatus).values({
        queueName: metrics.queueName,
        pendingMessages: metrics.pendingMessages,
        processingMessages: metrics.processingMessages,
        failedMessages: metrics.failedMessages,
        completedMessages: metrics.completedMessages,
        deadLetterMessages: metrics.deadLetterMessages,
        avgProcessingTime: metrics.avgProcessingTime,
        throughput: metrics.throughput,
        lastProcessed: metrics.lastProcessed.getTime(),
        maxRetries: metrics.maxRetries,
        ttl: metrics.ttl,
        lastUpdated: Date.now(),
        createdAt: Date.now()
      }).onConflictDoUpdate({
        target: queueStatus.queueName,
        set: {
          pendingMessages: metrics.pendingMessages,
          processingMessages: metrics.processingMessages,
          failedMessages: metrics.failedMessages,
          completedMessages: metrics.completedMessages,
          deadLetterMessages: metrics.deadLetterMessages,
          avgProcessingTime: metrics.avgProcessingTime,
          throughput: metrics.throughput,
          lastProcessed: metrics.lastProcessed.getTime(),
          lastUpdated: Date.now()
        }
      });
    } catch (error) {
      console.error(`更新队列 ${queueName} 状态失败:`, error);
    }
  }

  private async checkQueueHealth(queueName: string, metrics: QueueMetrics, config: QueueConfig): Promise<void> {
    try {
      const totalMessages = metrics.pendingMessages + metrics.processingMessages + metrics.failedMessages;
      
      // 检查积压情况
      if (totalMessages > config.criticalThreshold) {
        await this.logQueueAlert(queueName, 'critical', 
          `队列积压严重: ${totalMessages} 条消息 (阈值: ${config.criticalThreshold})`);
      } else if (totalMessages > config.warningThreshold) {
        await this.logQueueAlert(queueName, 'warning', 
          `队列积压警告: ${totalMessages} 条消息 (阈值: ${config.warningThreshold})`);
      }

      // 检查失败率
      const failureRate = metrics.failedMessages / Math.max(1, metrics.completedMessages + metrics.failedMessages);
      if (failureRate > 0.1) { // 失败率超过10%
        await this.logQueueAlert(queueName, 'warning', 
          `队列失败率过高: ${(failureRate * 100).toFixed(1)}%`);
      }

      // 检查处理时间
      if (metrics.avgProcessingTime > 30000) { // 处理时间超过30秒
        await this.logQueueAlert(queueName, 'warning', 
          `队列处理时间过长: ${metrics.avgProcessingTime}ms`);
      }

      // 检查死信消息
      if (metrics.deadLetterMessages > 10) {
        await this.logQueueAlert(queueName, 'critical', 
          `死信消息过多: ${metrics.deadLetterMessages} 条`);
      }

    } catch (error) {
      console.error(`检查队列 ${queueName} 健康状态失败:`, error);
    }
  }

  private async logQueueAlert(queueName: string, level: 'warning' | 'critical', message: string): Promise<void> {
    try {
      await db.insert(systemEventLogs).values({
        eventType: 'queue_alert',
        eventName: '队列报警',
        service: 'queue',
        level: level === 'critical' ? 'error' : 'warning',
        message: `队列 ${queueName}: ${message}`,
        details: JSON.stringify({
          queue_name: queueName,
          alert_level: level,
          alert_message: message,
          timestamp: new Date().toISOString()
        }),
        timestamp: Date.now(),
        createdAt: Date.now()
      });
    } catch (error) {
      console.error('记录队列报警失败:', error);
    }
  }

  private async logQueueMonitoringEvent(queueName: string, metrics: QueueMetrics): Promise<void> {
    try {
      await db.insert(systemEventLogs).values({
        eventType: 'queue_monitoring',
        eventName: '队列监控',
        service: 'queue',
        level: 'info',
        message: `队列 ${queueName} 状态监控完成`,
        details: JSON.stringify({
          queue_name: queueName,
          pending_messages: metrics.pendingMessages,
          processing_messages: metrics.processingMessages,
          failed_messages: metrics.failedMessages,
          completed_messages: metrics.completedMessages,
          dead_letter_messages: metrics.deadLetterMessages,
          avg_processing_time: metrics.avgProcessingTime,
          throughput: metrics.throughput
        }),
        timestamp: Date.now(),
        createdAt: Date.now()
      });
    } catch (error) {
      console.error('记录队列监控事件失败:', error);
    }
  }

  // 获取队列状态
  async getQueueStatus(queueName?: string): Promise<QueueMetrics[]> {
    try {
      let query = db
        .select()
        .from(queueStatus)
        .where(eq(queueStatus.isActive, true));

      if (queueName) {
        query = query.where(eq(queueStatus.queueName, queueName));
      }

      const results = await query.orderBy(desc(queueStatus.lastUpdated));
      
      return results.map(row => ({
        queueName: row.queueName,
        pendingMessages: row.pendingMessages,
        processingMessages: row.processingMessages,
        failedMessages: row.failedMessages,
        completedMessages: row.completedMessages,
        deadLetterMessages: row.deadLetterMessages,
        avgProcessingTime: row.avgProcessingTime,
        throughput: row.throughput,
        lastProcessed: new Date(row.lastProcessed),
        maxRetries: row.maxRetries,
        ttl: row.ttl
      }));
    } catch (error) {
      console.error('获取队列状态失败:', error);
      throw error;
    }
  }

  // 获取队列状态概览
  async getQueueOverview(): Promise<{
    totalQueues: number;
    totalPending: number;
    totalProcessing: number;
    totalFailed: number;
    totalCompleted: number;
    totalDeadLetter: number;
    averageProcessingTime: number;
    totalThroughput: number;
    queues: QueueMetrics[];
  }> {
    try {
      const queues = await this.getQueueStatus();
      
      const overview = {
        totalQueues: queues.length,
        totalPending: queues.reduce((sum, q) => sum + q.pendingMessages, 0),
        totalProcessing: queues.reduce((sum, q) => sum + q.processingMessages, 0),
        totalFailed: queues.reduce((sum, q) => sum + q.failedMessages, 0),
        totalCompleted: queues.reduce((sum, q) => sum + q.completedMessages, 0),
        totalDeadLetter: queues.reduce((sum, q) => sum + q.deadLetterMessages, 0),
        averageProcessingTime: queues.length > 0 
          ? Math.round(queues.reduce((sum, q) => sum + q.avgProcessingTime, 0) / queues.length)
          : 0,
        totalThroughput: queues.reduce((sum, q) => sum + q.throughput, 0),
        queues
      };

      return overview;
    } catch (error) {
      console.error('获取队列状态概览失败:', error);
      throw error;
    }
  }

  // 获取队列历史数据
  async getQueueHistory(queueName: string, timeRange: string = '1h'): Promise<QueueMetrics[]> {
    try {
      const now = Date.now();
      let startTime: number;
      
      switch (timeRange) {
        case '1h':
          startTime = now - 60 * 60 * 1000;
          break;
        case '24h':
          startTime = now - 24 * 60 * 60 * 1000;
          break;
        case '7d':
          startTime = now - 7 * 24 * 60 * 60 * 1000;
          break;
        default:
          startTime = now - 60 * 60 * 1000;
      }

      // 这里应该从历史数据表中获取，暂时返回当前状态
      const currentStatus = await this.getQueueStatus(queueName);
      return currentStatus;
    } catch (error) {
      console.error('获取队列历史数据失败:', error);
      throw error;
    }
  }

  // 重置队列状态
  async resetQueueStatus(queueName: string): Promise<void> {
    try {
      await db
        .update(queueStatus)
        .set({
          pendingMessages: 0,
          processingMessages: 0,
          failedMessages: 0,
          completedMessages: 0,
          deadLetterMessages: 0,
          avgProcessingTime: 0,
          throughput: 0,
          lastProcessed: Date.now(),
          lastUpdated: Date.now()
        })
        .where(eq(queueStatus.queueName, queueName));

      await this.logQueueMonitoringEvent(queueName, {
        queueName,
        pendingMessages: 0,
        processingMessages: 0,
        failedMessages: 0,
        completedMessages: 0,
        deadLetterMessages: 0,
        avgProcessingTime: 0,
        throughput: 0,
        lastProcessed: new Date(),
        maxRetries: 3,
        ttl: 86400
      });

      console.log(`队列 ${queueName} 状态已重置`);
    } catch (error) {
      console.error(`重置队列 ${queueName} 状态失败:`, error);
      throw error;
    }
  }

  // 启动队列监控
  startQueueMonitoring(): void {
    console.log('启动队列监控...');
    
    // 注册默认队列监控配置
    const defaultQueues = [
      {
        queueName: 'rss_processing',
        maxRetries: 3,
        ttl: 86400,
        warningThreshold: 100,
        criticalThreshold: 500,
        monitoringInterval: 60
      },
      {
        queueName: 'ai_processing',
        maxRetries: 3,
        ttl: 86400,
        warningThreshold: 50,
        criticalThreshold: 200,
        monitoringInterval: 30
      },
      {
        queueName: 'notification',
        maxRetries: 3,
        ttl: 3600,
        warningThreshold: 20,
        criticalThreshold: 100,
        monitoringInterval: 120
      }
    ];

    for (const queue of defaultQueues) {
      this.registerQueueConfig(queue);
    }
  }

  // 停止队列监控
  stopQueueMonitoring(): void {
    console.log('停止队列监控...');
    
    for (const [queueName, interval] of this.monitoringIntervals.entries()) {
      clearInterval(interval);
    }
    
    this.monitoringIntervals.clear();
    this.queueConfigs.clear();
  }

  // 获取队列统计信息
  async getQueueStats(timeRange: string = '1h'): Promise<{
    totalMessagesProcessed: number;
    averageProcessingTime: number;
    successRate: number;
    failureRate: number;
    queueUtilization: Record<string, number>;
  }> {
    try {
      const now = Date.now();
      let startTime: number;
      
      switch (timeRange) {
        case '1h':
          startTime = now - 60 * 60 * 1000;
          break;
        case '24h':
          startTime = now - 24 * 60 * 60 * 1000;
          break;
        case '7d':
          startTime = now - 7 * 24 * 60 * 60 * 1000;
          break;
        default:
          startTime = now - 60 * 60 * 1000;
      }

      // 从消息历史中获取统计数据
      const history = await db
        .select()
        .from(messageHistories)
        .where(gte(messageHistories.timestamp, startTime));

      const totalMessages = history.length;
      const completedMessages = history.filter(h => h.status === 'completed').length;
      const failedMessages = history.filter(h => h.status === 'failed').length;

      const processingTimes = history
        .filter(h => h.processingTime && h.processingTime > 0)
        .map(h => h.processingTime);

      const averageProcessingTime = processingTimes.length > 0
        ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length)
        : 0;

      const successRate = totalMessages > 0 ? (completedMessages / totalMessages) * 100 : 0;
      const failureRate = totalMessages > 0 ? (failedMessages / totalMessages) * 100 : 0;

      // 获取队列利用率
      const queues = await this.getQueueStatus();
      const queueUtilization: Record<string, number> = {};
      
      for (const queue of queues) {
        const totalCapacity = 1000; // 假设每个队列的容量为1000
        const utilization = ((queue.pendingMessages + queue.processingMessages) / totalCapacity) * 100;
        queueUtilization[queue.queueName] = Math.min(utilization, 100);
      }

      return {
        totalMessagesProcessed: completedMessages,
        averageProcessingTime,
        successRate,
        failureRate,
        queueUtilization
      };
    } catch (error) {
      console.error('获取队列统计失败:', error);
      throw error;
    }
  }
}