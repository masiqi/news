import { db } from '../index';
import { 
  userStatistics,
  processingTasks,
  notificationRecords,
  rssEntries,
  sources 
} from '../../db/schema';
import { eq, and, or, gte, lte, desc, asc, sql, count, sum, avg } from 'drizzle-orm';

export interface NotificationSettings {
  id: number;
  userId: number;
  enableRealtimeNotifications: boolean;
  enableEmailNotifications: boolean;
  notifyOnCompleted: boolean;
  notifyOnFailed: boolean;
  notifyOnError: boolean;
  emailFrequency: 'immediate' | 'daily' | 'weekly';
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationRecord {
  id: number;
  userId: number;
  type: 'task_completed' | 'task_failed' | 'task_progress' | 'error' | 'system';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  sentVia: 'realtime' | 'email';
  scheduledFor?: Date;
  sentAt?: Date;
  readAt?: Date;
  createdAt: Date;
}

export interface ExtendedUserStatistics {
  id: number;
  userId: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  processingTasks: number;
  averageProcessingTime: number;
  tasksToday: number;
  tasksThisWeek: number;
  tasksThisMonth: number;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class StatisticsService {
  /**
   * 获取用户统计数据（扩展版）
   */
  async getExtendedStatistics(userId: number): Promise<ExtendedUserStatistics> {
    try {
      const [stats] = await db
        .select()
        .from(userStatistics)
        .where(eq(userStatistics.userId, userId))
        .limit(1);

      if (!stats) {
        return await this.initializeStatistics(userId);
      }

      return stats;
    } catch (error) {
      console.error('获取扩展统计数据失败:', error);
      throw new Error('获取扩展统计数据失败');
    }
  }

  /**
   * 获取详细的任务统计
   */
  async getDetailedTaskStatistics(userId: number): Promise<{
    byType: Record<string, {
      total: number;
      completed: number;
      failed: number;
      averageTime: number;
    }>;
    byStatus: Record<string, number>;
    timeDistribution: {
      under1Min: number;
      under5Min: number;
      under10Min: number;
      over10Min: number;
    };
    failureRate: number;
    completionRate: number;
    averageTime: number;
  }> {
    try {
      // 按类型统计
      const typeStats = await db
        .select({
          type: processingTasks.type,
          total: count(processingTasks.id).as('total'),
          completed: count(processingTasks.id)
            .filter(and(
              eq(processingTasks.status, 'completed'),
              eq(processingTasks.userId, userId)
            )).as('completed'),
          failed: count(processingTasks.id)
            .filter(and(
              eq(processingTasks.status, 'failed'),
              eq(processingTasks.userId, userId)
            )).as('failed'),
          averageTime: avg(
            sql`(CAST(strftime('%s', ${processingTasks.completedAt}) AS INTEGER) - CAST(strftime('%s', ${processingTasks.startedAt}) AS INTEGER))`
              .filter(and(
                eq(processingTasks.status, 'completed'),
                eq(processingTasks.userId, userId),
                sql`${processingTasks.startedAt} IS NOT NULL`,
                sql`${processingTasks.completedAt} IS NOT NULL`
              )).as('averageTime'),
        })
        .from(processingTasks)
        .where(eq(processingTasks.userId, userId))
        .groupBy(processingTasks.type);

      // 按状态统计
      const statusStats = await db
        .select({
          status: processingTasks.status,
          count: count(processingTasks.id).as('count'),
        })
        .from(processingTasks)
        .where(eq(processingTasks.userId, userId))
        .groupBy(processingTasks.status);

      // 时间分布
      const timeDistribution = await db
        .select({
          under1Min: count(processingTasks.id)
            .filter(and(
              eq(processingTasks.userId, userId),
              eq(processingTasks.status, 'completed'),
              sql`(CAST(strftime('%s', ${processingTasks.completedAt}) AS INTEGER) - CAST(strftime('%s', ${processingTasks.startedAt}) AS INTEGER)) < 60`
            )).as('under1Min'),
          under5Min: count(processingTasks.id)
            .filter(and(
              eq(processingTasks.userId, userId),
              eq(processingTasks.status, 'completed'),
              sql`((CAST(strftime('%s', ${processingTasks.completedAt}) AS INTEGER) - CAST(strftime('%s', ${processingTasks.startedAt}) AS INTEGER)) >= 60 AND ((CAST(strftime('%s', ${processingTasks.completedAt}) AS INTEGER) - CAST(strftime('%s', ${processingTasks.startedAt}) AS INTEGER)) < 300)`
            )).as('under5Min'),
          under10Min: count(processingTasks.id)
            .filter(and(
              eq(processingTasks.userId, userId),
              eq(processingTasks.status, 'completed'),
              sql`((CAST(strftime('%s', ${processingTasks.completedAt}) AS INTEGER) - CAST(strftime('%s', ${processingTasks.startedAt}) AS INTEGER)) >= 300 AND ((CAST(strftime('%s', ${processingTasks.completedAt}) AS INTEGER) - CAST(strftime('%s', ${processingTasks.startedAt}) AS INTEGER)) < 600)`
            )).as('under10Min'),
          over10Min: count(processingTasks.id)
            .filter(and(
              eq(processingTasks.userId, userId),
              eq(processingTasks.status, 'completed'),
              sql`((CAST(strftime('%s', ${processingTasks.completedAt}) AS INTEGER) - CAST(strftime('%s', ${processingTasks.startedAt}) AS INTEGER)) >= 600`
            )).as('over10Min'),
        })
        .from(processingTasks)
        .where(eq(processingTasks.userId, userId));

      // 总体统计
      const overallStats = await db
        .select({
          total: count(processingTasks.id)
            .filter(eq(processingTasks.userId, userId)).as('total'),
          completed: count(processingTasks.id)
            .filter(and(
              eq(processingTasks.userId, userId),
              eq(processingTasks.status, 'completed')
            )).as('completed'),
          failed: count(processingTasks.id)
            .filter(and(
              eq(processingTasks.userId, userId),
              eq(processingTasks.status, 'failed')
            )).as('failed'),
          averageTime: avg(
            sql`(CAST(strftime('%s', ${processingTasks.completedAt}) AS INTEGER) - CAST(strftime('%s', ${processingTasks.startedAt}) AS INTEGER))`
              .filter(and(
                eq(processingTasks.userId, userId),
                eq(processingTasks.status, 'completed'),
                sql`${processingTasks.startedAt} IS NOT NULL`,
                sql`${processingTasks.completedAt} IS NOT NULL`
              )).as('averageTime'),
        })
        .from(processingTasks)
        .where(eq(processingTasks.userId, userId))
        .limit(1);

      // 格式化结果
      const byType = typeStats.reduce((acc, stat) => {
        acc[stat.type] = {
          total: Number(stat.total || 0),
          completed: Number(stat.completed || 0),
          failed: Number(stat.failed || 0),
          averageTime: Math.round(Number(stat.averageTime || 0)),
        };
        return acc;
      }, {} as Record<string, any>);

      const byStatus = statusStats.reduce((acc, stat) => {
        acc[stat.status] = Number(stat.count || 0);
        return acc;
      }, {} as Record<string, number>);

      const distribution = timeDistribution[0] || {};
      const overall = overallStats[0] || {};

      const failureRate = overall.total > 0 
        ? ((overall.failed || 0) / overall.total * 100).toFixed(1) 
        : '0';
      
      const completionRate = overall.total > 0 
        ? ((overall.completed || 0) / overall.total * 100).toFixed(1) 
        : '0';

      return {
        byType,
        byStatus,
        timeDistribution: {
          under1Min: Number(distribution.under1Min || 0),
          under5Min: Number(distribution.under5Min || 0),
          under10Min: Number(distribution.under10Min || 0),
          over10Min: Number(distribution.over10Min || 0),
        },
        failureRate: parseFloat(failureRate),
        completionRate: parseFloat(completionRate),
        averageTime: Math.round(Number(overall.averageTime || 0)),
      };
    } catch (error) {
      console.error('获取详细任务统计失败:', error);
      throw new Error('获取详细任务统计失败');
    }
  }

  /**
   * 获取性能指标
   */
  async getPerformanceMetrics(userId: number, period: 'day' | 'week' | 'month' = 'day'): Promise<{
    throughput: number;
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
    uptime: number;
  }> {
    try {
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }

      const [metrics] = await db
        .select({
          throughput: count(processingTasks.id)
            .filter(and(
              eq(processingTasks.userId, userId),
              gte(processingTasks.createdAt, startDate)
            )).as('throughput'),
          averageResponseTime: avg(
            sql`ABS(CAST(strftime('%s', ${processingTasks.completedAt}) AS INTEGER) - CAST(strftime('%s', ${processingTasks.startedAt}) AS INTEGER))`
              .filter(and(
                eq(processingTasks.userId, userId),
                gte(processingTasks.createdAt, startDate),
                eq(processingTasks.status, 'completed')
              )).as('averageResponseTime'),
          completed: count(processingTasks.id)
            .filter(and(
              eq(processingTasks.userId, userId),
              gte(processingTasks.createdAt, startDate),
              eq(processingTasks.status, 'completed')
            )).as('completed'),
          failed: count(processingTasks.id)
            .filter(and(
              eq(processingTasks.userId, userId),
              gte(processingTasks.createdAt, startDate),
              eq(processingTasks.status, 'failed')
            )).as('failed'),
        })
        .from(processingTasks)
        .where(eq(processingTasks.userId, userId))
        .and(gte(processingTasks.createdAt, startDate))
        .limit(1);

      const throughput = Number(metrics?.throughput || 0);
      const completed = Number(metrics?.completed || 0);
      const failed = Number(metrics?.failed || 0);
      const total = completed + failed;
      
      return {
        throughput,
        averageResponseTime: Math.round(Number(metrics?.averageResponseTime || 0)),
        successRate: total > 0 ? (completed / total * 100).toFixed(1) : '0',
        errorRate: total > 0 ? (failed / total * 100).toFixed(1) : '0',
        uptime: throughput > 0 ? (completed / throughput * 100).toFixed(1) : '0',
      };
    } catch (error) {
      console.error('获取性能指标失败:', error);
      throw new Error('获取性能指标失败');
    }
  }

  /**
   * 获取RSS源性能统计
   */
  async getSourcePerformanceStatistics(userId: number): Promise<{
    totalSources: number;
    activeSources: number;
    inactiveSources: number;
    averageFetchTime: number;
    totalEntries: number;
    averageEntriesPerSource: number;
    errorSources: number;
  }> {
    try {
      const [stats] = await db
        .select({
          totalSources: count(sources.id)
            .filter(eq(sources.userId, userId)).as('totalSources'),
          activeSources: count(sources.id)
            .filter(and(
              eq(sources.userId, userId),
              eq(sources.isActive, true)
            )).as('activeSources'),
          totalEntries: count(rssEntries.id)
            .innerJoin(sources, eq(rssEntries.sourceId, sources.id))
            .filter(eq(sources.userId, userId)).as('totalEntries'),
          averageFetchTime: avg(
            sql`(CAST(strftime('%s', ${sources.lastFetchedAt}) AS INTEGER) - CAST(strftime('%s', ${sources.lastFetchStartedAt}) AS INTEGER))`
              .filter(and(
                eq(sources.userId, userId),
                sql`${sources.lastFetchStartedAt} IS NOT NULL`,
                sql`${sources.lastFetchedAt} IS NOT NULL`
              )).as('averageFetchTime'),
          errorSources: count(sources.id)
            .filter(and(
              eq(sources.userId, userId),
              sql`${sources.lastErrorMessage} IS NOT NULL`
            )).as('errorSources'),
        })
        .from(sources)
        .where(eq(sources.userId, userId))
        .limit(1);

      const total = Number(stats?.totalSources || 0);
      const active = Number(stats?.activeSources || 0);
      const totalEntries = Number(stats?.totalEntries || 0);
      
      return {
        totalSources: total,
        activeSources: active,
        inactiveSources: total - active,
        averageFetchTime: Math.round(Number(stats?.averageFetchTime || 0)),
        totalEntries: totalEntries,
        averageEntriesPerSource: total > 0 ? Math.round(totalEntries / total) : 0,
        errorSources: Number(stats?.errorSources || 0),
      };
    } catch (error) {
      console.error('获取RSS源性能统计失败:', error);
      throw new Error('获取RSS源性能统计失败');
    }
  }

  /**
   * 生成系统健康报告
   */
  async generateSystemHealthReport(userId: number): Promise<{
    userHealth: {
      totalTasks: number;
      completionRate: number;
      averageResponseTime: number;
      activeSources: number;
      errorSources: number;
    };
    systemMetrics: {
      totalUsers: number;
      activeTasks: number;
      failedTasks: number;
      systemUptime: number;
    };
    recommendations: string[];
    generatedAt: string;
  }> {
    try {
      // 用户健康指标
      const userStats = await this.getExtendedStatistics(userId);
      const detailedStats = await this.getDetailedTaskStatistics(userId);
      const sourceStats = await this.getSourcePerformanceStatistics(userId);

      const userHealth = {
        totalTasks: userStats.totalTasks,
        completionRate: detailedStats.completionRate,
        averageResponseTime: detailedStats.averageTime,
        activeSources: sourceStats.activeSources,
        errorSources: sourceStats.errorSources,
      };

      // 系统指标（简化版本，实际中可能需要管理员权限）
      const systemMetrics = {
        totalUsers: 1, // 简化处理
        activeTasks: userStats.processingTasks,
        failedTasks: userStats.failedTasks,
        systemUptime: 100, // 简化处理
      };

      // 生成推荐建议
      const recommendations: string[] = [];

      if (detailedStats.completionRate < 80) {
        recommendations.push('任务完成率偏低，建议检查RSS源配置和网络连接');
      }

      if (detailedStats.averageTime > 600) {
        recommendations.push('平均响应时间过长，建议优化RSS源选择和服务器配置');
      }

      if (sourceStats.errorSources > 0) {
        recommendations.push(`发现 ${sourceStats.errorSources} 个RSS源存在错误，建议检查源配置`);
      }

      if (userStats.failedTasks > 10) {
        recommendations.push('失败任务数量较多，建议检查错误日志并调整重试策略');
      }

      if (sourceStats.averageFetchTime > 30) {
        recommendations.push('RSS源平均获取时间较长，建议优化源列表或服务器配置');
      }

      if (recommendations.length === 0) {
        recommendations.push('系统运行良好，所有指标均在正常范围内');
      }

      return {
        userHealth,
        systemMetrics,
        recommendations,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('生成系统健康报告失败:', error);
      throw new Error('生成系统健康报告失败');
    }
  }

  /**
   * 初始化用户统计数据
   */
  private async initializeStatistics(userId: number): Promise<ExtendedUserStatistics> {
    try {
      const [stats] = await db
        .insert(userStatistics)
        .values({
          userId,
          totalTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          processingTasks: 0,
          averageProcessingTime: 0,
          tasksToday: 0,
          tasksThisWeek: 0,
          tasksThisMonth: 0,
          lastUpdated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return stats;
    } catch (error) {
      console.error('初始化扩展统计数据失败:', error);
      throw new Error('初始化扩展统计数据失败');
    }
  }
}