import { Hono } from 'hono';
import { adminAuthMiddleware, getCurrentUser } from '../../middleware/admin-auth.middleware';
import { userAuthMiddleware } from '../../middleware/auth.middleware';
import { StatusService, ProcessingTask } from '../../services/status.service';
import { StatisticsService, NotificationSettings, NotificationRecord } from '../../services/statistics.service';
import { db } from '../index';
import { sql, eq, and, or, inArray, desc, gte, lte } from 'drizzle-orm';
import type { Env } from '../../env';

const statusRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 应用认证中间件
statusRoutes.use('*', userAuthMiddleware);

// 获取用户当前状态
statusRoutes.get('/current', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const statusService = new StatusService();
    const statsService = new StatisticsService();
    
    const { tasks, statistics } = await statusService.getCurrentStatus(user.id);
    
    // 获取未读通知数量
    const [unreadCount] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(notificationRecords)
      .where(
        and(
          eq(notificationRecords.userId, user.id),
          eq(notificationRecords.isRead, false)
        )
      )
      .limit(1);

    return c.json({ 
      success: true, 
      tasks, 
      statistics,
      unreadNotifications: unreadCount?.count || 0
    });
  } catch (error) {
    console.error('获取用户当前状态失败:', error);
    return c.json({ 
      success: false, 
      error: '获取用户当前状态失败' 
    }, 500);
  }
});

// 获取状态历史
statusRoutes.get('/history', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const statusService = new StatusService();
    const { taskId, limit, offset } = c.req.query();
    
    const result = await statusService.getStatusHistory(user.id, {
      taskId: taskId ? parseInt(taskId) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
    
    return c.json({ 
      success: true, 
      ...result 
    });
  } catch (error) {
    console.error('获取状态历史失败:', error);
    return c.json({ 
      success: false, 
      error: '获取状态历史失败' 
    }, 500);
  }
});

// 获取任务统计汇总
statusRoutes.get('/summary', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const statusService = new StatusService();
    const summary = await statusService.getTaskSummary(user.id);
    
    return c.json({ 
      success: true, 
      summary 
    });
  } catch (error) {
    console.error('获取任务统计汇总失败:', error);
    return c.json({ 
      success: false, 
      error: '获取任务统计汇总失败' 
    }, 500);
  }
});

// 创建新任务
statusRoutes.post('/tasks', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const body = await c.req.json();
    const {
      sourceId,
      type,
      title,
      description,
      estimatedDuration,
      maxRetries
    } = body;

    // 验证输入
    if (!sourceId || !type || !title) {
      return c.json({ 
        success: false, 
        error: 'sourceId, type, 和 title 为必填字段' 
      }, 400);
    }

    const validTypes = ['rss_fetch', 'ai_process', 'content_storage', 'error_retry'];
    if (!validTypes.includes(type)) {
      return c.json({ 
        success: false, 
        error: '无效的任务类型' 
      }, 400);
    }

    const statusService = new StatusService();
    const task = await statusService.createTask({
      userId: user.id,
      sourceId: parseInt(sourceId),
      type,
      title,
      description,
      estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : undefined,
      maxRetries: maxRetries ? parseInt(maxRetries) : undefined,
    });
    
    return c.json({ 
      success: true, 
      task 
    });
  } catch (error) {
    console.error('创建任务失败:', error);
    return c.json({ 
      success: false, 
      error: '创建任务失败' 
    }, 500);
  }
});

// 开始任务处理
statusRoutes.post('/tasks/:id/start', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const taskId = parseInt(c.req.param('id'));
    
    const statusService = new StatusService();
    const task = await statusService.startTask(taskId);
    
    return c.json({ 
      success: true, 
      task 
    });
  } catch (error) {
    console.error('开始任务失败:', error);
    return c.json({ 
      success: false, 
      error: error.message || '开始任务失败' 
    }, 500);
  }
});

// 更新任务进度
statusRoutes.put('/tasks/:id/progress', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const taskId = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { progress, message } = body;

    // 验证输入
    if (progress === undefined) {
      return c.json({ 
        success: false, 
        error: 'progress 为必填字段' 
      }, 400);
    }

    if (progress < 0 || progress > 100) {
      return c.json({ 
        success: false, 
        error: 'progress 必须在 0-100 之间' 
      }, 400);
    }

    const statusService = new StatusService();
    const task = await statusService.updateTaskProgress(taskId, progress, message);
    
    return c.json({ 
      success: true, 
      task 
    });
  } catch (error) {
    console.error('更新任务进度失败:', error);
    return c.json({ 
      success: false, 
      error: '更新任务进度失败' 
    }, 500);
  }
});

// 完成任务
statusRoutes.post('/tasks/:id/complete', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const taskId = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { resultData } = body;

    const statusService = new StatusService();
    const task = await statusService.completeTask(taskId, resultData);
    
    return c.json({ 
      success: true, 
      task 
    });
  } catch (error) {
    console.error('完成任务失败:', error);
    return c.json({ 
      success: false, 
      error: '完成任务失败' 
    }, 500);
  }
});

// 失败任务
statusRoutes.post('/tasks/:id/fail', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const taskId = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { errorMessage } = body;

    // 验证输入
    if (!errorMessage) {
      return c.json({ 
        success: false, 
        error: 'errorMessage 为必填字段' 
      }, 400);
    }

    const statusService = new StatusService();
    const task = await statusService.failTask(taskId, errorMessage);
    
    return c.json({ 
      success: true, 
      task 
    });
  } catch (error) {
    console.error('失败任务失败:', error);
    return c.json({ 
      success: false, 
      error: '失败任务失败' 
    }, 500);
  }
});

// 获取待处理任务（系统内部使用）
statusRoutes.get('/tasks/pending', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const statusService = new StatusService();
    const { limit } = c.req.query();
    
    const tasks = await statusService.getPendingTasks(limit ? parseInt(limit) : 20);
    
    return c.json({ 
      success: true, 
      tasks 
    });
  } catch (error) {
    console.error('获取待处理任务失败:', error);
    return c.json({ 
      success: false, 
      error: '获取待处理任务失败' 
    }, 500);
  }
});

// 获取进行中的任务（系统内部使用）
statusRoutes.get('/tasks/processing', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const statusService = new StatusService();
    const { limit } = c.req.query();
    
    const tasks = await statusService.getProcessingTasks(limit ? parseInt(limit) : 10);
    
    return c.json({ 
      success: true, 
      tasks 
    });
  } catch (error) {
    console.error('获取进行中任务失败:', error);
    return c.json({ 
      success: false, 
      error: '获取进行中任务失败' 
    }, 500);
  }
});

// 清理过期任务（系统内部使用）
statusRoutes.post('/cleanup', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const body = await c.req.json();
    const { daysToKeep } = body;

    const statusService = new StatusService();
    const cleanedCount = await statusService.cleanupOldTasks(daysToKeep ? parseInt(daysToKeep) : 30);
    
    return c.json({ 
      success: true, 
      cleanedCount,
      message: `清理了 ${cleanedCount} 个过期任务` 
    });
  } catch (error) {
    console.error('清理过期任务失败:', error);
    return c.json({ 
      success: false, 
      error: '清理过期任务失败' 
    }, 500);
  }
});

// 获取统计数据
statusRoutes.get('/statistics/extended', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const { period } = c.req.query();
    const statsService = new StatisticsService();
    const statistics = await statsService.getExtendedStatistics(user.id);
    
    return c.json({ 
      success: true, 
      statistics 
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return c.json({ 
      success: false, 
      error: '获取统计数据失败' 
    }, 500);
  }
});

// 获取详细任务统计
statusRoutes.get('/statistics/detailed', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const statsService = new StatisticsService();
    const detailedStats = await statsService.getDetailedTaskStatistics(user.id);
    
    return c.json({ 
      success: true, 
      detailedStats 
    });
  } catch (error) {
    console.error('获取详细任务统计失败:', error);
    return c.json({ 
      success: false, 
      error: '获取详细任务统计失败' 
    }, 500);
  }
});

// 获取性能指标
statusRoutes.get('/statistics/performance', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const { period } = c.req.query();
    const statsService = new StatisticsService();
    const metrics = await statsService.getPerformanceMetrics(user.id, period as 'day' | 'week' | 'month' || 'day');
    
    return c.json({ 
      success: true, 
      metrics 
    });
  } catch (error) {
    console.error('获取性能指标失败:', error);
    return c.json({ 
      success: false, 
      error: '获取性能指标失败' 
    }, 500);
  }
});

// 获取RSS源性能统计
statusRoutes.get('/statistics/sources', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const statsService = new StatisticsService();
    const sourceStats = await statsService.getSourcePerformanceStatistics(user.id);
    
    return c.json({ 
      success: true, 
      sourceStats 
    });
  } catch (error) {
    console.error('获取RSS源性能统计失败:', error);
    return c.json({ 
      success: false, 
      error: '获取RSS源性能统计失败' 
    }, 500);
  }
});

// 生成系统健康报告
statusRoutes.get('/health/report', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const statsService = new StatisticsService();
    const healthReport = await statsService.generateSystemHealthReport(user.id);
    
    return c.json({ 
      success: true, 
      healthReport 
    });
  } catch (error) {
    console.error('生成系统健康报告失败:', error);
    return c.json({ 
      success: false, 
      error: '生成系统健康报告失败' 
    }, 500);
  }
});

export default statusRoutes;