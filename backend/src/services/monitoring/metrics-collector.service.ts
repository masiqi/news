import { db } from '../db';
import {
  systemMetrics,
  serviceHealth,
  queueStatus,
  userActivityStats,
  alertRules,
  alertRecords,
  monitoringAggregates,
  systemEventLogs
} from '../db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

export interface SystemMetricsData {
  service: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  responseTime: number;
  errorRate: number;
  activeConnections: number;
  metadata?: Record<string, any>;
}

export interface ServiceHealthData {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  errorMessage?: string;
  consecutiveFailures: number;
  uptime: number;
  recoveryTime?: number;
}

export interface QueueStatusData {
  queueName: string;
  pendingMessages: number;
  processingMessages: number;
  failedMessages: number;
  completedMessages: number;
  deadLetterMessages: number;
  avgProcessingTime: number;
  throughput: number;
}

export interface UserActivityData {
  date: Date;
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  sessionsCount: number;
  pageViews: number;
  avgSessionDuration: number;
  topActions: Array<{ action: string; count: number }>;
}

export class MetricsCollectorService {
  private static instance: MetricsCollectorService;
  private isCollecting: boolean = false;

  static getInstance(): MetricsCollectorService {
    if (!MetricsCollectorService.instance) {
      MetricsCollectorService.instance = new MetricsCollectorService();
    }
    return MetricsCollectorService.instance;
  }

  // 收集系统指标
  async collectSystemMetrics(data: SystemMetricsData): Promise<void> {
    try {
      await db.insert(systemMetrics).values({
        ...data,
        timestamp: Date.now(),
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        createdAt: Date.now()
      });

      // 记录系统事件
      await this.logSystemEvent('metrics_collected', '系统指标收集', 'system', 'info', 
        `成功收集 ${data.service} 服务的系统指标`);
    } catch (error) {
      console.error('收集系统指标失败:', error);
      await this.logSystemEvent('metrics_collection_failed', '系统指标收集失败', 'system', 'error', 
        `收集 ${data.service} 服务指标失败: ${error}`);
    }
  }

  // 更新服务健康状态
  async updateServiceHealth(data: ServiceHealthData): Promise<void> {
    try {
      await db.insert(serviceHealth).values({
        serviceName: data.serviceName,
        status: data.status,
        lastCheck: Date.now(),
        responseTime: data.responseTime,
        errorMessage: data.errorMessage,
        consecutiveFailures: data.consecutiveFailures,
        uptime: data.uptime,
        recoveryTime: data.recoveryTime,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }).onConflictDoUpdate({
        target: serviceHealth.serviceName,
        set: {
          status: data.status,
          lastCheck: Date.now(),
          responseTime: data.responseTime,
          errorMessage: data.errorMessage,
          consecutiveFailures: data.consecutiveFailures,
          uptime: data.uptime,
          recoveryTime: data.recoveryTime,
          updatedAt: Date.now()
        }
      });

      // 记录系统事件
      await this.logSystemEvent('health_check', '服务健康检查', data.serviceName, 'info', 
        `服务健康状态: ${data.status}, 响应时间: ${data.responseTime}ms`);
    } catch (error) {
      console.error('更新服务健康状态失败:', error);
      await this.logSystemEvent('health_check_failed', '服务健康检查失败', data.serviceName, 'error', 
        `健康检查失败: ${error}`);
    }
  }

  // 更新队列状态
  async updateQueueStatus(data: QueueStatusData): Promise<void> {
    try {
      await db.insert(queueStatus).values({
        ...data,
        lastProcessed: Date.now(),
        lastUpdated: Date.now(),
        createdAt: Date.now()
      }).onConflictDoUpdate({
        target: queueStatus.queueName,
        set: {
          pendingMessages: data.pendingMessages,
          processingMessages: data.processingMessages,
          failedMessages: data.failedMessages,
          completedMessages: data.completedMessages,
          deadLetterMessages: data.deadLetterMessages,
          avgProcessingTime: data.avgProcessingTime,
          throughput: data.throughput,
          lastProcessed: Date.now(),
          lastUpdated: Date.now()
        }
      });

      // 记录系统事件
      await this.logSystemEvent('queue_status_update', '队列状态更新', 'queue', 'info', 
        `队列 ${data.queueName} 状态更新: 待处理 ${data.pendingMessages}, 处理中 ${data.processingMessages}`);
    } catch (error) {
      console.error('更新队列状态失败:', error);
      await this.logSystemEvent('queue_status_update_failed', '队列状态更新失败', 'queue', 'error', 
        `队列 ${data.queueName} 状态更新失败: ${error}`);
    }
  }

  // 更新用户活动统计
  async updateUserActivityStats(data: UserActivityData): Promise<void> {
    try {
      const date = new Date(data.date);
      date.setHours(0, 0, 0, 0);

      await db.insert(userActivityStats).values({
        date: date.getTime(),
        totalUsers: data.totalUsers,
        activeUsers: data.activeUsers,
        newUsers: data.newUsers,
        sessionsCount: data.sessionsCount,
        pageViews: data.pageViews,
        avgSessionDuration: data.avgSessionDuration,
        topActions: JSON.stringify(data.topActions),
        createdAt: Date.now()
      }).onConflictDoUpdate({
        target: userActivityStats.date,
        set: {
          totalUsers: data.totalUsers,
          activeUsers: data.activeUsers,
          newUsers: data.newUsers,
          sessionsCount: data.sessionsCount,
          pageViews: data.pageViews,
          avgSessionDuration: data.avgSessionDuration,
          topActions: JSON.stringify(data.topActions)
        }
      });
    } catch (error) {
      console.error('更新用户活动统计失败:', error);
      await this.logSystemEvent('user_stats_update_failed', '用户活动统计更新失败', 'system', 'error', 
        `用户活动统计更新失败: ${error}`);
    }
  }

  // 检查报警规则
  async checkAlertRules(): Promise<void> {
    try {
      const rules = await db
        .select()
        .from(alertRules)
        .where(eq(alertRules.enabled, true));

      for (const rule of rules) {
        await this.checkSingleAlertRule(rule);
      }
    } catch (error) {
      console.error('检查报警规则失败:', error);
      await this.logSystemEvent('alert_check_failed', '报警规则检查失败', 'system', 'error', 
        `报警规则检查失败: ${error}`);
    }
  }

  private async checkSingleAlertRule(rule: typeof alertRules.$inferSelect): Promise<void> {
    try {
      // 获取最新的指标数据
      const latestMetrics = await db
        .select()
        .from(systemMetrics)
        .where(eq(systemMetrics.service, rule.metric.split('_')[0] || 'system'))
        .orderBy(desc(systemMetrics.timestamp))
        .limit(1);

      if (latestMetrics.length === 0) return;

      const metric = latestMetrics[0];
      let currentValue: number;

      switch (rule.metric) {
        case 'cpu_usage':
          currentValue = metric.cpuUsage;
          break;
        case 'memory_usage':
          currentValue = metric.memoryUsage;
          break;
        case 'disk_usage':
          currentValue = metric.diskUsage;
          break;
        case 'response_time':
          currentValue = metric.responseTime;
          break;
        case 'error_rate':
          currentValue = metric.errorRate;
          break;
        default:
          return;
      }

      // 检查是否触发报警条件
      let shouldTrigger = false;
      switch (rule.condition) {
        case 'gt':
          shouldTrigger = currentValue > rule.threshold;
          break;
        case 'lt':
          shouldTrigger = currentValue < rule.threshold;
          break;
        case 'eq':
          shouldTrigger = currentValue === rule.threshold;
          break;
        case 'ne':
          shouldTrigger = currentValue !== rule.threshold;
          break;
      }

      if (shouldTrigger) {
        // 检查是否已有活跃的相同报警
        const existingAlert = await db
          .select()
          .from(alertRecords)
          .where(
            and(
              eq(alertRecords.ruleId, rule.id),
              eq(alertRecords.status, 'active')
            )
          )
          .limit(1);

        if (existingAlert.length === 0) {
          // 创建新的报警记录
          await this.createAlertRecord(rule, currentValue);
        }
      }
    } catch (error) {
      console.error(`检查报警规则 ${rule.name} 失败:`, error);
      await this.logSystemEvent('alert_rule_check_failed', '报警规则检查失败', 'system', 'error', 
        `检查报警规则 ${rule.name} 失败: ${error}`);
    }
  }

  private async createAlertRecord(rule: typeof alertRules.$inferSelect, value: number): Promise<void> {
    try {
      const notificationChannels = JSON.parse(rule.notificationChannels || '[]');
      
      await db.insert(alertRecords).values({
        ruleId: rule.id,
        triggeredAt: Date.now(),
        value,
        message: `报警触发: ${rule.name} - ${rule.metric} ${rule.condition} ${rule.threshold} (当前值: ${value})`,
        severity: rule.severity,
        status: 'active',
        notificationsSent: JSON.stringify([]),
        createdAt: Date.now()
      });

      // 记录系统事件
      await this.logSystemEvent('alert_triggered', '报警触发', 'system', 'warning', 
        `报警规则 ${rule.name} 触发: ${rule.metric} ${rule.condition} ${rule.threshold} (当前值: ${value})`);

      // TODO: 发送通知
      await this.sendNotifications(rule, value);
    } catch (error) {
      console.error('创建报警记录失败:', error);
      await this.logSystemEvent('alert_creation_failed', '报警记录创建失败', 'system', 'error', 
        `创建报警记录失败: ${error}`);
    }
  }

  private async sendNotifications(rule: typeof alertRules.$inferSelect, value: number): Promise<void> {
    try {
      const notificationChannels = JSON.parse(rule.notificationChannels || '[]');
      
      // 这里可以实现具体的通知逻辑，如邮件、短信等
      for (const channel of notificationChannels) {
        await this.logSystemEvent('notification_sent', '通知发送', 'system', 'info', 
          `向 ${channel} 发送报警通知: ${rule.name} (值: ${value})`);
      }
    } catch (error) {
      console.error('发送通知失败:', error);
      await this.logSystemEvent('notification_failed', '通知发送失败', 'system', 'error', 
        `发送通知失败: ${error}`);
    }
  }

  // 记录系统事件
  async logSystemEvent(
    eventType: string,
    eventName: string,
    service: string,
    level: 'info' | 'warning' | 'error' | 'debug',
    message: string,
    details?: Record<string, any>,
    userId?: number
  ): Promise<void> {
    try {
      await db.insert(systemEventLogs).values({
        eventType,
        eventName,
        service,
        level,
        message,
        details: details ? JSON.stringify(details) : null,
        userId,
        timestamp: Date.now(),
        createdAt: Date.now()
      });
    } catch (error) {
      console.error('记录系统事件失败:', error);
    }
  }

  // 聚合监控数据
  async aggregateMonitoringData(): Promise<void> {
    try {
      const now = new Date();
      
      // 聚合1小时数据
      await this.aggregateDataForPeriod('1h', 60 * 60 * 1000);
      
      // 聚合1天数据
      await this.aggregateDataForPeriod('1d', 24 * 60 * 60 * 1000);
      
      // 聚合1周数据
      await this.aggregateDataForPeriod('1w', 7 * 24 * 60 * 60 * 1000);
      
      // 聚合1月数据
      await this.aggregateDataForPeriod('1m', 30 * 24 * 60 * 60 * 1000);

      await this.logSystemEvent('data_aggregation', '监控数据聚合', 'system', 'info', 
        '监控数据聚合完成');
    } catch (error) {
      console.error('聚合监控数据失败:', error);
      await this.logSystemEvent('data_aggregation_failed', '监控数据聚合失败', 'system', 'error', 
        `监控数据聚合失败: ${error}`);
    }
  }

  private async aggregateDataForPeriod(timeRange: string, periodMs: number): Promise<void> {
    try {
      const endTime = Date.now();
      const startTime = endTime - periodMs;

      // 获取原始数据
      const rawData = await db
        .select()
        .from(systemMetrics)
        .where(
          and(
            gte(systemMetrics.timestamp, startTime),
            lte(systemMetrics.timestamp, endTime)
          )
        );

      if (rawData.length === 0) return;

      // 按服务分组聚合
      const serviceGroups = rawData.reduce((acc, metric) => {
        if (!acc[metric.service]) {
          acc[metric.service] = [];
        }
        acc[metric.service].push(metric);
        return acc;
      }, {} as Record<string, typeof rawData>);

      // 为每个服务创建聚合数据
      for (const [service, metrics] of Object.entries(serviceGroups)) {
        const cpuValues = metrics.map(m => m.cpuUsage);
        const memoryValues = metrics.map(m => m.memoryUsage);
        const responseTimeValues = metrics.map(m => m.responseTime);

        await db.insert(monitoringAggregates).values({
          metricType: 'cpu_usage',
          timeRange,
          timestamp: endTime,
          minValue: Math.min(...cpuValues),
          maxValue: Math.max(...cpuValues),
          avgValue: Math.round(cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length),
          sumValue: cpuValues.reduce((a, b) => a + b, 0),
          count: cpuValues.length,
          service,
          createdAt: Date.now()
        });

        await db.insert(monitoringAggregates).values({
          metricType: 'memory_usage',
          timeRange,
          timestamp: endTime,
          minValue: Math.min(...memoryValues),
          maxValue: Math.max(...memoryValues),
          avgValue: Math.round(memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length),
          sumValue: memoryValues.reduce((a, b) => a + b, 0),
          count: memoryValues.length,
          service,
          createdAt: Date.now()
        });

        await db.insert(monitoringAggregates).values({
          metricType: 'response_time',
          timeRange,
          timestamp: endTime,
          minValue: Math.min(...responseTimeValues),
          maxValue: Math.max(...responseTimeValues),
          avgValue: Math.round(responseTimeValues.reduce((a, b) => a + b, 0) / responseTimeValues.length),
          sumValue: responseTimeValues.reduce((a, b) => a + b, 0),
          count: responseTimeValues.length,
          service,
          createdAt: Date.now()
        });
      }
    } catch (error) {
      console.error(`聚合 ${timeRange} 数据失败:`, error);
    }
  }

  // 清理过期数据
  async cleanupOldData(): Promise<void> {
    try {
      const now = Date.now();
      
      // 删除30天前的系统指标
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      await db
        .delete(systemMetrics)
        .where(lte(systemMetrics.timestamp, thirtyDaysAgo));

      // 删除90天前的聚合数据
      const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
      await db
        .delete(monitoringAggregates)
        .where(lte(monitoringAggregates.timestamp, ninetyDaysAgo));

      // 删除已解决的报警记录（保留30天）
      await db
        .delete(alertRecords)
        .where(
          and(
            eq(alertRecords.status, 'resolved'),
            lte(alertRecords.resolvedAt, thirtyDaysAgo)
          )
        );

      await this.logSystemEvent('data_cleanup', '过期数据清理', 'system', 'info', 
        '过期监控数据清理完成');
    } catch (error) {
      console.error('清理过期数据失败:', error);
      await this.logSystemEvent('data_cleanup_failed', '过期数据清理失败', 'system', 'error', 
        `过期数据清理失败: ${error}`);
    }
  }

  // 启动指标收集
  startCollection(): void {
    if (this.isCollecting) return;
    
    this.isCollecting = true;
    console.log('监控系统指标收集已启动');

    // 每30秒收集一次系统指标
    setInterval(() => {
      this.collectSystemMetricsFromServices();
    }, 30000);

    // 每60秒检查一次服务健康状态
    setInterval(() => {
      this.checkServiceHealth();
    }, 60000);

    // 每5分钟检查一次报警规则
    setInterval(() => {
      this.checkAlertRules();
    }, 300000);

    // 每小时聚合一次数据
    setInterval(() => {
      this.aggregateMonitoringData();
    }, 3600000);

    // 每天清理一次过期数据
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000);
  }

  // 停止指标收集
  stopCollection(): void {
    this.isCollecting = false;
    console.log('监控系统指标收集已停止');
  }

  private async collectSystemMetricsFromServices(): Promise<void> {
    try {
      // 模拟收集各个服务的指标
      const services = ['api', 'worker', 'database', 'queue'];
      
      for (const service of services) {
        const metrics: SystemMetricsData = {
          service,
          cpuUsage: Math.floor(Math.random() * 100),
          memoryUsage: Math.floor(Math.random() * 1024),
          diskUsage: Math.floor(Math.random() * 512),
          networkIn: Math.floor(Math.random() * 10000),
          networkOut: Math.floor(Math.random() * 10000),
          responseTime: Math.floor(Math.random() * 1000),
          errorRate: Math.floor(Math.random() * 10),
          activeConnections: Math.floor(Math.random() * 100),
          metadata: { collected_at: new Date().toISOString() }
        };

        await this.collectSystemMetrics(metrics);
      }
    } catch (error) {
      console.error('收集服务系统指标失败:', error);
    }
  }

  private async checkServiceHealth(): Promise<void> {
    try {
      const services = ['api', 'worker', 'database', 'queue'];
      
      for (const service of services) {
        const health: ServiceHealthData = {
          serviceName: service,
          status: Math.random() > 0.1 ? 'healthy' : Math.random() > 0.05 ? 'degraded' : 'unhealthy',
          responseTime: Math.floor(Math.random() * 1000),
          consecutiveFailures: Math.random() > 0.8 ? Math.floor(Math.random() * 5) : 0,
          uptime: Math.floor(Math.random() * 86400)
        };

        await this.updateServiceHealth(health);
      }
    } catch (error) {
      console.error('检查服务健康状态失败:', error);
    }
  }
}