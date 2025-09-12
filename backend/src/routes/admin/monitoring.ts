import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { requireAuth, requireAdmin } from '../middleware/auth';
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
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { Context } from 'hono';

// 监控API路由
const monitoring = new Hono();

// 获取系统概览指标
monitoring.get('/overview', requireAuth, requireAdmin, async (c: Context) => {
  try {
    // 获取最新的系统指标
    const latestMetrics = await db
      .select({
        service: systemMetrics.service,
        cpuUsage: systemMetrics.cpuUsage,
        memoryUsage: systemMetrics.memoryUsage,
        diskUsage: systemMetrics.diskUsage,
        responseTime: systemMetrics.responseTime,
        errorRate: systemMetrics.errorRate,
        activeConnections: systemMetrics.activeConnections,
        timestamp: systemMetrics.timestamp
      })
      .from(systemMetrics)
      .orderBy(desc(systemMetrics.timestamp))
      .limit(10);

    // 获取服务健康状态
    const services = await db
      .select()
      .from(serviceHealth)
      .where(eq(serviceHealth.isActive, true));

    // 获取队列状态
    const queues = await db
      .select()
      .from(queueStatus)
      .where(eq(queueStatus.isActive, true));

    // 获取用户活动统计（今日）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const userStats = await db
      .select()
      .from(userActivityStats)
      .where(
        and(
          gte(userActivityStats.date, today.getTime()),
          lte(userActivityStats.date, tomorrow.getTime())
        )
      )
      .limit(1);

    // 获取活跃报警
    const activeAlerts = await db
      .select({
        id: alertRecords.id,
        ruleId: alertRecords.ruleId,
        message: alertRecords.message,
        severity: alertRecords.severity,
        triggeredAt: alertRecords.triggeredAt,
        status: alertRecords.status
      })
      .from(alertRecords)
      .where(eq(alertRecords.status, 'active'))
      .orderBy(desc(alertRecords.triggeredAt))
      .limit(10);

    return c.json({
      success: true,
      data: {
        system: latestMetrics[0] || null,
        services,
        queues,
        users: userStats[0] || null,
        alerts: activeAlerts
      }
    });
  } catch (error) {
    console.error('获取系统概览失败:', error);
    return c.json({
      success: false,
      error: '获取系统概览失败'
    }, 500);
  }
});

// 获取性能指标历史
const getMetricsSchema = z.object({
  service: z.string().optional(),
  start_time: z.string(),
  end_time: z.string(),
  interval: z.enum(['1m', '5m', '15m', '1h', '1d']).default('1h')
});

monitoring.get('/metrics', requireAuth, requireAdmin, zValidator('query', getMetricsSchema), async (c: Context) => {
  try {
    const { service, start_time, end_time, interval } = c.req.valid('query');
    
    const startTime = new Date(start_time).getTime();
    const endTime = new Date(end_time).getTime();

    let query = db
      .select()
      .from(systemMetrics)
      .where(
        and(
          gte(systemMetrics.timestamp, startTime),
          lte(systemMetrics.timestamp, endTime)
        )
      );

    if (service) {
      query = query.where(eq(systemMetrics.service, service));
    }

    const metrics = await query.orderBy(desc(systemMetrics.timestamp));

    return c.json({
      success: true,
      data: {
        metrics,
        interval
      }
    });
  } catch (error) {
    console.error('获取性能指标失败:', error);
    return c.json({
      success: false,
      error: '获取性能指标失败'
    }, 500);
  }
});

// 获取服务健康状态
monitoring.get('/health', requireAuth, requireAdmin, async (c: Context) => {
  try {
    const services = await db
      .select()
      .from(serviceHealth)
      .where(eq(serviceHealth.isActive, true))
      .orderBy(desc(serviceHealth.lastCheck));

    return c.json({
      success: true,
      data: {
        services
      }
    });
  } catch (error) {
    console.error('获取服务健康状态失败:', error);
    return c.json({
      success: false,
      error: '获取服务健康状态失败'
    }, 500);
  }
});

// 获取队列状态
monitoring.get('/queues', requireAuth, requireAdmin, async (c: Context) => {
  try {
    const queues = await db
      .select()
      .from(queueStatus)
      .where(eq(queueStatus.isActive, true))
      .orderBy(desc(queueStatus.lastUpdated));

    return c.json({
      success: true,
      data: {
        queues
      }
    });
  } catch (error) {
    console.error('获取队列状态失败:', error);
    return c.json({
      success: false,
      error: '获取队列状态失败'
    }, 500);
  }
});

// 获取用户活动统计
const getUserStatsSchema = z.object({
  period: z.enum(['today', 'week', 'month']).default('today')
});

monitoring.get('/users', requireAuth, requireAdmin, zValidator('query', getUserStatsSchema), async (c: Context) => {
  try {
    const { period } = c.req.valid('query');
    
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const stats = await db
      .select()
      .from(userActivityStats)
      .where(gte(userActivityStats.date, startDate.getTime()))
      .orderBy(desc(userActivityStats.date));

    return c.json({
      success: true,
      data: {
        stats,
        period
      }
    });
  } catch (error) {
    console.error('获取用户活动统计失败:', error);
    return c.json({
      success: false,
      error: '获取用户活动统计失败'
    }, 500);
  }
});

// 管理报警规则
monitoring.get('/alerts/rules', requireAuth, requireAdmin, async (c: Context) => {
  try {
    const rules = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.isActive, true))
      .orderBy(desc(alertRules.createdAt));

    return c.json({
      success: true,
      data: {
        rules
      }
    });
  } catch (error) {
    console.error('获取报警规则失败:', error);
    return c.json({
      success: false,
      error: '获取报警规则失败'
    }, 500);
  }
});

const createAlertRuleSchema = z.object({
  name: z.string(),
  metric: z.string(),
  condition: z.enum(['gt', 'lt', 'eq', 'ne']),
  threshold: z.number(),
  duration: z.number().default(0),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  enabled: z.boolean().default(true),
  notificationChannels: z.array(z.string()),
  description: z.string().optional(),
  cooldownPeriod: z.number().default(300),
  maxNotifications: z.number().default(10)
});

monitoring.post('/alerts/rules', requireAuth, requireAdmin, zValidator('json', createAlertRuleSchema), async (c: Context) => {
  try {
    const data = c.req.valid('json');
    const adminId = c.get('user').id;

    const rule = await db
      .insert(alertRules)
      .values({
        ...data,
        notificationChannels: JSON.stringify(data.notificationChannels),
        createdBy: adminId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      .returning();

    return c.json({
      success: true,
      data: {
        rule: rule[0]
      }
    });
  } catch (error) {
    console.error('创建报警规则失败:', error);
    return c.json({
      success: false,
      error: '创建报警规则失败'
    }, 500);
  }
});

const updateAlertRuleSchema = z.object({
  name: z.string().optional(),
  metric: z.string().optional(),
  condition: z.enum(['gt', 'lt', 'eq', 'ne']).optional(),
  threshold: z.number().optional(),
  duration: z.number().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  enabled: z.boolean().optional(),
  notificationChannels: z.array(z.string()).optional(),
  description: z.string().optional(),
  cooldownPeriod: z.number().optional(),
  maxNotifications: z.number().optional()
});

monitoring.put('/alerts/rules/:id', requireAuth, requireAdmin, zValidator('json', updateAlertRuleSchema), async (c: Context) => {
  try {
    const ruleId = parseInt(c.req.param('id'));
    const data = c.req.valid('json');

    const updateData: any = { ...data, updatedAt: Date.now() };
    if (data.notificationChannels) {
      updateData.notificationChannels = JSON.stringify(data.notificationChannels);
    }

    const rule = await db
      .update(alertRules)
      .set(updateData)
      .where(eq(alertRules.id, ruleId))
      .returning();

    if (rule.length === 0) {
      return c.json({
        success: false,
        error: '报警规则不存在'
      }, 404);
    }

    return c.json({
      success: true,
      data: {
        rule: rule[0]
      }
    });
  } catch (error) {
    console.error('更新报警规则失败:', error);
    return c.json({
      success: false,
      error: '更新报警规则失败'
    }, 500);
  }
});

// 获取报警记录
const getAlertsSchema = z.object({
  status: z.enum(['active', 'resolved']).optional(),
  limit: z.number().default(50)
});

monitoring.get('/alerts/history', requireAuth, requireAdmin, zValidator('query', getAlertsSchema), async (c: Context) => {
  try {
    const { status, limit } = c.req.valid('query');

    let query = db
      .select({
        id: alertRecords.id,
        ruleId: alertRecords.ruleId,
        message: alertRecords.message,
        severity: alertRecords.severity,
        triggeredAt: alertRecords.triggeredAt,
        resolvedAt: alertRecords.resolvedAt,
        status: alertRecords.status,
        value: alertRecords.value
      })
      .from(alertRecords);

    if (status) {
      query = query.where(eq(alertRecords.status, status));
    }

    const alerts = await query
      .orderBy(desc(alertRecords.triggeredAt))
      .limit(limit);

    return c.json({
      success: true,
      data: {
        alerts
      }
    });
  } catch (error) {
    console.error('获取报警记录失败:', error);
    return c.json({
      success: false,
      error: '获取报警记录失败'
    }, 500);
  }
});

// 导出监控数据
const exportSchema = z.object({
  type: z.enum(['metrics', 'health', 'queues', 'users']),
  start_time: z.string(),
  end_time: z.string(),
  format: z.enum(['csv', 'json']).default('json')
});

monitoring.get('/export', requireAuth, requireAdmin, zValidator('query', exportSchema), async (c: Context) => {
  try {
    const { type, start_time, end_time, format } = c.req.valid('query');
    
    const startTime = new Date(start_time).getTime();
    const endTime = new Date(end_time).getTime();

    let data: any[] = [];
    let filename = '';

    switch (type) {
      case 'metrics':
        data = await db
          .select()
          .from(systemMetrics)
          .where(
            and(
              gte(systemMetrics.timestamp, startTime),
              lte(systemMetrics.timestamp, endTime)
            )
          )
          .orderBy(desc(systemMetrics.timestamp));
        filename = `metrics_${start_time}_${end_time}`;
        break;
      case 'health':
        data = await db
          .select()
          .from(serviceHealth)
          .where(
            and(
              gte(serviceHealth.lastCheck, startTime),
              lte(serviceHealth.lastCheck, endTime)
            )
          )
          .orderBy(desc(serviceHealth.lastCheck));
        filename = `health_${start_time}_${end_time}`;
        break;
      case 'queues':
        data = await db
          .select()
          .from(queueStatus)
          .where(
            and(
              gte(queueStatus.lastUpdated, startTime),
              lte(queueStatus.lastUpdated, endTime)
            )
          )
          .orderBy(desc(queueStatus.lastUpdated));
        filename = `queues_${start_time}_${end_time}`;
        break;
      case 'users':
        data = await db
          .select()
          .from(userActivityStats)
          .where(
            and(
              gte(userActivityStats.date, startTime),
              lte(userActivityStats.date, endTime)
            )
          )
          .orderBy(desc(userActivityStats.date));
        filename = `users_${start_time}_${end_time}`;
        break;
    }

    if (format === 'csv') {
      // 简单的CSV转换
      const headers = Object.keys(data[0] || {}).join(',');
      const rows = data.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' ? `"${value}"` : value
        ).join(',')
      ).join('\n');
      
      const csvContent = `${headers}\n${rows}`;
      
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`
        }
      });
    } else {
      return c.json({
        success: true,
        data: {
          data,
          filename: `${filename}.json`
        }
      });
    }
  } catch (error) {
    console.error('导出监控数据失败:', error);
    return c.json({
      success: false,
      error: '导出监控数据失败'
    }, 500);
  }
});

export default monitoring;