import { db } from '../db';
import { alertRules, alertRecords, systemEventLogs, users } from '../db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

export interface AlertRule {
  id?: number;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'ne';
  threshold: number;
  duration: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  notificationChannels: string[];
  description?: string;
  cooldownPeriod: number;
  maxNotifications: number;
  createdBy?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface AlertRecord {
  id?: number;
  ruleId: number;
  triggeredAt: number;
  resolvedAt?: number;
  value: number;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved';
  notificationsSent: string[];
  metadata?: Record<string, any>;
  acknowledgedBy?: number;
  acknowledgedAt?: number;
  resolutionNote?: string;
  createdAt?: number;
}

export interface AlertNotification {
  channel: string;
  recipient: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
}

export interface AlertEngineConfig {
  checkInterval: number;
  maxConcurrentChecks: number;
  notificationRetries: number;
  notificationTimeout: number;
  enableNotification: boolean;
}

export class AlertEngineService {
  private static instance: AlertEngineService;
  private config: AlertEngineConfig;
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private activeChecks: Set<string> = new Set();

  private constructor() {
    this.config = {
      checkInterval: 60, // 1分钟
      maxConcurrentChecks: 10,
      notificationRetries: 3,
      notificationTimeout: 30000, // 30秒
      enableNotification: true
    };
  }

  static getInstance(): AlertEngineService {
    if (!AlertEngineService.instance) {
      AlertEngineService.instance = new AlertEngineService();
    }
    return AlertEngineService.instance;
  }

  // 创建报警规则
  async createAlertRule(rule: AlertRule): Promise<AlertRule> {
    try {
      const result = await db.insert(alertRules).values({
        name: rule.name,
        metric: rule.metric,
        condition: rule.condition,
        threshold: rule.threshold,
        duration: rule.duration,
        severity: rule.severity,
        enabled: rule.enabled,
        notificationChannels: JSON.stringify(rule.notificationChannels),
        description: rule.description,
        cooldownPeriod: rule.cooldownPeriod,
        maxNotifications: rule.maxNotifications,
        createdBy: rule.createdBy,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }).returning();

      const newRule = result[0];
      
      // 记录系统事件
      await this.logAlertEvent('rule_created', '报警规则创建', 'system', 'info', 
        `创建报警规则: ${rule.name} (${rule.metric} ${rule.condition} ${rule.threshold})`);

      return {
        ...newRule,
        notificationChannels: JSON.parse(newRule.notificationChannels || '[]')
      };
    } catch (error) {
      console.error('创建报警规则失败:', error);
      await this.logAlertEvent('rule_creation_failed', '报警规则创建失败', 'system', 'error', 
        `创建报警规则失败: ${error}`);
      throw error;
    }
  }

  // 更新报警规则
  async updateAlertRule(ruleId: number, updates: Partial<AlertRule>): Promise<AlertRule> {
    try {
      const updateData: any = { ...updates, updatedAt: Date.now() };
      if (updates.notificationChannels) {
        updateData.notificationChannels = JSON.stringify(updates.notificationChannels);
      }

      const result = await db
        .update(alertRules)
        .set(updateData)
        .where(eq(alertRules.id, ruleId))
        .returning();

      if (result.length === 0) {
        throw new Error('报警规则不存在');
      }

      const updatedRule = result[0];
      
      // 记录系统事件
      await this.logAlertEvent('rule_updated', '报警规则更新', 'system', 'info', 
        `更新报警规则: ${updatedRule.name}`);

      return {
        ...updatedRule,
        notificationChannels: JSON.parse(updatedRule.notificationChannels || '[]')
      };
    } catch (error) {
      console.error('更新报警规则失败:', error);
      await this.logAlertEvent('rule_update_failed', '报警规则更新失败', 'system', 'error', 
        `更新报警规则失败: ${error}`);
      throw error;
    }
  }

  // 删除报警规则
  async deleteAlertRule(ruleId: number): Promise<void> {
    try {
      // 检查是否有活跃的报警
      const activeAlerts = await db
        .select()
        .from(alertRecords)
        .where(
          and(
            eq(alertRecords.ruleId, ruleId),
            eq(alertRecords.status, 'active')
          )
        );

      if (activeAlerts.length > 0) {
        throw new Error('无法删除有活跃报警的规则');
      }

      await db
        .update(alertRules)
        .set({ 
          isActive: false, 
          updatedAt: Date.now() 
        })
        .where(eq(alertRules.id, ruleId));

      // 记录系统事件
      await this.logAlertEvent('rule_deleted', '报警规则删除', 'system', 'info', 
        `删除报警规则 ID: ${ruleId}`);
    } catch (error) {
      console.error('删除报警规则失败:', error);
      await this.logAlertEvent('rule_deletion_failed', '报警规则删除失败', 'system', 'error', 
        `删除报警规则失败: ${error}`);
      throw error;
    }
  }

  // 获取报警规则
  async getAlertRules(enabledOnly: boolean = false): Promise<AlertRule[]> {
    try {
      let query = db.select().from(alertRules);
      
      if (enabledOnly) {
        query = query.where(and(eq(alertRules.enabled, true), eq(alertRules.isActive, true)));
      }

      const rules = await query.orderBy(desc(alertRules.createdAt));
      
      return rules.map(rule => ({
        ...rule,
        notificationChannels: JSON.parse(rule.notificationChannels || '[]')
      }));
    } catch (error) {
      console.error('获取报警规则失败:', error);
      throw error;
    }
  }

  // 获取报警记录
  async getAlertRecords(filters?: {
    status?: 'active' | 'resolved';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    ruleId?: number;
    limit?: number;
    offset?: number;
  }): Promise<AlertRecord[]> {
    try {
      let query = db.select().from(alertRecords);

      if (filters) {
        if (filters.status) {
          query = query.where(eq(alertRecords.status, filters.status));
        }
        if (filters.severity) {
          query = query.where(eq(alertRecords.severity, filters.severity));
        }
        if (filters.ruleId) {
          query = query.where(eq(alertRecords.ruleId, filters.ruleId));
        }
      }

      query = query.orderBy(desc(alertRecords.triggeredAt));

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.offset(filters.offset);
      }

      const records = await query;
      
      return records.map(record => ({
        ...record,
        notificationsSent: JSON.parse(record.notificationsSent || '[]'),
        metadata: record.metadata ? JSON.parse(record.metadata) : undefined
      }));
    } catch (error) {
      console.error('获取报警记录失败:', error);
      throw error;
    }
  }

  // 确认报警
  async acknowledgeAlert(alertId: number, userId: number, note?: string): Promise<void> {
    try {
      await db
        .update(alertRecords)
        .set({
          acknowledgedBy: userId,
          acknowledgedAt: Date.now(),
          metadata: sql`json_patch(metadata, json_object('acknowledgement_note', ${note || ''}))`
        })
        .where(eq(alertRecords.id, alertId));

      // 记录系统事件
      await this.logAlertEvent('alert_acknowledged', '报警确认', 'system', 'info', 
        `报警 ID ${alertId} 已被用户 ${userId} 确认`);
    } catch (error) {
      console.error('确认报警失败:', error);
      throw error;
    }
  }

  // 解决报警
  async resolveAlert(alertId: number, userId: number, note?: string): Promise<void> {
    try {
      await db
        .update(alertRecords)
        .set({
          status: 'resolved',
          resolvedAt: Date.now(),
          resolutionNote: note,
          acknowledgedBy: userId,
          acknowledgedAt: Date.now()
        })
        .where(eq(alertRecords.id, alertId));

      // 记录系统事件
      await this.logAlertEvent('alert_resolved', '报警解决', 'system', 'info', 
        `报警 ID ${alertId} 已被用户 ${userId} 解决`);
    } catch (error) {
      console.error('解决报警失败:', error);
      throw error;
    }
  }

  // 检查所有报警规则
  async checkAllAlertRules(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    try {
      const rules = await this.getAlertRules(true);
      
      for (const rule of rules) {
        if (this.activeChecks.size >= this.config.maxConcurrentChecks) {
          break;
        }
        
        this.activeChecks.add(`rule_${rule.id}`);
        
        // 异步检查每个规则
        this.checkSingleAlertRule(rule)
          .catch(error => {
            console.error(`检查报警规则 ${rule.name} 失败:`, error);
          })
          .finally(() => {
            this.activeChecks.delete(`rule_${rule.id}`);
          });
      }
    } catch (error) {
      console.error('检查报警规则失败:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // 检查单个报警规则
  private async checkSingleAlertRule(rule: AlertRule): Promise<void> {
    try {
      const currentValue = await this.getMetricValue(rule.metric);
      
      if (currentValue === null) {
        return; // 无法获取指标值，跳过检查
      }

      const shouldTrigger = this.evaluateCondition(currentValue, rule.condition, rule.threshold);
      
      if (shouldTrigger) {
        await this.handleTriggeredAlert(rule, currentValue);
      }
    } catch (error) {
      console.error(`检查报警规则 ${rule.name} 失败:`, error);
      await this.logAlertEvent('rule_check_failed', '报警规则检查失败', 'system', 'error', 
        `检查报警规则 ${rule.name} 失败: ${error}`);
    }
  }

  // 获取指标值
  private async getMetricValue(metric: string): Promise<number | null> {
    try {
      // 这里应该从实际的监控系统获取指标值
      // 暂时返回模拟值
      switch (metric) {
        case 'cpu_usage':
          return Math.floor(Math.random() * 100);
        case 'memory_usage':
          return Math.floor(Math.random() * 1024);
        case 'disk_usage':
          return Math.floor(Math.random() * 512);
        case 'response_time':
          return Math.floor(Math.random() * 1000);
        case 'error_rate':
          return Math.floor(Math.random() * 10);
        case 'active_connections':
          return Math.floor(Math.random() * 100);
        case 'queue_backlog':
          return Math.floor(Math.random() * 1000);
        case 'failed_requests':
          return Math.floor(Math.random() * 100);
        default:
          return null;
      }
    } catch (error) {
      console.error(`获取指标 ${metric} 值失败:`, error);
      return null;
    }
  }

  // 评估条件
  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'eq':
        return value === threshold;
      case 'ne':
        return value !== threshold;
      default:
        return false;
    }
  }

  // 处理触发的报警
  private async handleTriggeredAlert(rule: AlertRule, value: number): Promise<void> {
    try {
      // 检查是否已有活跃的相同报警
      const existingAlert = await db
        .select()
        .from(alertRecords)
        .where(
          and(
            eq(alertRecords.ruleId, rule.id!),
            eq(alertRecords.status, 'active')
          )
        )
        .limit(1);

      if (existingAlert.length > 0) {
        // 检查冷却时间
        const alert = existingAlert[0];
        const cooldownElapsed = Date.now() - alert.triggeredAt;
        
        if (cooldownElapsed < rule.cooldownPeriod * 1000) {
          return; // 在冷却时间内，不重复触发
        }
      }

      // 创建新的报警记录
      const alertMessage = `报警触发: ${rule.name} - ${rule.metric} ${rule.condition} ${rule.threshold} (当前值: ${value})`;
      
      const newAlert = await db.insert(alertRecords).values({
        ruleId: rule.id!,
        triggeredAt: Date.now(),
        value,
        message: alertMessage,
        severity: rule.severity,
        status: 'active',
        notificationsSent: JSON.stringify([]),
        metadata: JSON.stringify({
          metric: rule.metric,
          condition: rule.condition,
          threshold: rule.threshold,
          triggered_value: value
        }),
        createdAt: Date.now()
      }).returning();

      // 记录系统事件
      await this.logAlertEvent('alert_triggered', '报警触发', 'system', 'warning', alertMessage);

      // 发送通知
      if (this.config.enableNotification) {
        await this.sendNotifications(rule, newAlert[0], value);
      }

    } catch (error) {
      console.error('处理触发报警失败:', error);
      await this.logAlertEvent('alert_handling_failed', '报警处理失败', 'system', 'error', 
        `处理报警失败: ${error}`);
    }
  }

  // 发送通知
  private async sendNotifications(rule: AlertRule, alert: typeof alertRecords.$inferSelect, value: number): Promise<void> {
    try {
      const notificationChannels = JSON.parse(rule.notificationChannels || '[]');
      const notifications: AlertNotification[] = [];

      for (const channel of notificationChannels) {
        const notification: AlertNotification = {
          channel,
          recipient: this.getNotificationRecipient(channel),
          message: alert.message,
          severity: alert.severity,
          timestamp: Date.now()
        };

        notifications.push(notification);
        
        // 发送通知
        await this.sendNotification(notification);
      }

      // 更新报警记录
      await db
        .update(alertRecords)
        .set({
          notificationsSent: JSON.stringify(notifications.map(n => `${n.channel}:${n.recipient}`))
        })
        .where(eq(alertRecords.id, alert.id));

    } catch (error) {
      console.error('发送通知失败:', error);
      await this.logAlertEvent('notification_failed', '通知发送失败', 'system', 'error', 
        `发送通知失败: ${error}`);
    }
  }

  // 获取通知接收者
  private getNotificationRecipient(channel: string): string {
    switch (channel) {
      case 'email':
        return 'admin@example.com';
      case 'sms':
        return '+1234567890';
      case 'webhook':
        return 'https://hooks.slack.com/services/xxx';
      default:
        return 'unknown';
    }
  }

  // 发送单个通知
  private async sendNotification(notification: AlertNotification): Promise<void> {
    try {
      // 这里应该实现具体的通知发送逻辑
      // 例如：邮件、短信、Slack、Webhook等
      
      console.log(`发送通知到 ${notification.channel}: ${notification.message}`);
      
      // 模拟发送延迟
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 记录通知发送事件
      await this.logAlertEvent('notification_sent', '通知发送', 'system', 'info', 
        `向 ${notification.channel} 发送通知: ${notification.message}`);

    } catch (error) {
      console.error('发送通知失败:', error);
      throw error;
    }
  }

  // 记录报警事件
  private async logAlertEvent(
    eventType: string,
    eventName: string,
    service: string,
    level: 'info' | 'warning' | 'error' | 'debug',
    message: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await db.insert(systemEventLogs).values({
        eventType,
        eventName,
        service,
        level,
        message,
        details: details ? JSON.stringify(details) : null,
        timestamp: Date.now(),
        createdAt: Date.now()
      });
    } catch (error) {
      console.error('记录报警事件失败:', error);
    }
  }

  // 启动报警引擎
  startAlertEngine(): void {
    console.log('启动报警引擎...');
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // 立即执行一次检查
    this.checkAllAlertRules();

    // 设置定时检查
    this.checkInterval = setInterval(() => {
      this.checkAllAlertRules();
    }, this.config.checkInterval * 1000);
  }

  // 停止报警引擎
  stopAlertEngine(): void {
    console.log('停止报警引擎...');
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // 获取报警统计信息
  async getAlertStats(timeRange: string = '24h'): Promise<{
    totalAlerts: number;
    activeAlerts: number;
    resolvedAlerts: number;
    alertsBySeverity: Record<string, number>;
    alertsByMetric: Record<string, number>;
    averageResolutionTime: number;
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
          startTime = now - 24 * 60 * 60 * 1000;
      }

      const alerts = await db
        .select()
        .from(alertRecords)
        .where(gte(alertRecords.triggeredAt, startTime));

      const totalAlerts = alerts.length;
      const activeAlerts = alerts.filter(a => a.status === 'active').length;
      const resolvedAlerts = alerts.filter(a => a.status === 'resolved').length;

      // 按严重程度统计
      const alertsBySeverity = alerts.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // 按指标统计
      const alertsByMetric = alerts.reduce((acc, alert) => {
        const metadata = JSON.parse(alert.metadata || '{}');
        const metric = metadata.metric || 'unknown';
        acc[metric] = (acc[metric] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // 计算平均解决时间
      const resolvedAlertsWithTime = alerts.filter(a => 
        a.status === 'resolved' && a.resolvedAt && a.triggeredAt
      );
      
      const averageResolutionTime = resolvedAlertsWithTime.length > 0
        ? Math.round(
            resolvedAlertsWithTime.reduce((sum, alert) => 
              sum + (alert.resolvedAt! - alert.triggeredAt), 0
            ) / resolvedAlertsWithTime.length / 1000
          )
        : 0;

      return {
        totalAlerts,
        activeAlerts,
        resolvedAlerts,
        alertsBySeverity,
        alertsByMetric,
        averageResolutionTime
      };
    } catch (error) {
      console.error('获取报警统计失败:', error);
      throw error;
    }
  }

  // 测试报警规则
  async testAlertRule(ruleId: number): Promise<{
    triggered: boolean;
    currentValue: number | null;
    message: string;
  }> {
    try {
      const rule = await this.getAlertRules(true);
      const targetRule = rule.find(r => r.id === ruleId);
      
      if (!targetRule) {
        throw new Error('报警规则不存在');
      }

      const currentValue = await this.getMetricValue(targetRule.metric);
      
      if (currentValue === null) {
        return {
          triggered: false,
          currentValue: null,
          message: '无法获取指标值'
        };
      }

      const shouldTrigger = this.evaluateCondition(currentValue, targetRule.condition, targetRule.threshold);
      
      return {
        triggered: shouldTrigger,
        currentValue,
        message: shouldTrigger 
          ? `规则 ${targetRule.name} 将被触发 (当前值: ${currentValue}, 阈值: ${targetRule.threshold})`
          : `规则 ${targetRule.name} 不会被触发 (当前值: ${currentValue}, 阈值: ${targetRule.threshold})`
      };
    } catch (error) {
      console.error('测试报警规则失败:', error);
      throw error;
    }
  }
}