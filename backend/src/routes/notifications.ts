import { Hono } from 'hono';
import { userAuthMiddleware, getCurrentUser } from '../../middleware/auth.middleware';
import { StatisticsService, NotificationSettings, NotificationRecord } from '../../services/statistics.service';
import { db } from '../index';
import { sql, eq, and, or, gte, lte, desc, isNull } from 'drizzle-orm';
import type { Env } from '../../env';

const notificationRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 应用认证中间件
notificationRoutes.use('*', userAuthMiddleware);

// 获取通知设置
notificationRoutes.get('/settings', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const statsService = new StatisticsService();
    const [settings] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, user.id))
      .limit(1);

    // 如果没有设置记录，创建默认设置
    if (!settings) {
      const defaultSettings = await createDefaultSettings(user.id);
      return c.json({ 
        success: true, 
        settings: defaultSettings 
      });
    }

    return c.json({ 
      success: true, 
      settings 
    });
  } catch (error) {
    console.error('获取通知设置失败:', error);
    return c.json({ 
      success: false, 
      error: '获取通知设置失败' 
    }, 500);
  }
});

// 更新通知设置
notificationRoutes.put('/settings', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const body = await c.req.json();
    const {
      enableRealtimeNotifications,
      enableEmailNotifications,
      notifyOnCompleted,
      notifyOnFailed,
      notifyOnError,
      emailFrequency,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd
    } = body;

    // 验证输入
    const validFrequencies = ['immediate', 'daily', 'weekly'];
    if (emailFrequency && !validFrequencies.includes(emailFrequency)) {
      return c.json({ 
        success: false, 
        error: '无效的邮件频率' 
      }, 400);
    }

    // 验证时间格式（HH:mm）
    if (quietHoursEnabled && (quietHoursStart || quietHoursEnd)) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
      if ((quietHoursStart && !timeRegex.test(quietHoursStart)) || 
          (quietHoursEnd && !timeRegex.test(quietHoursEnd))) {
        return c.json({ 
          success: false, 
          error: '无效的时间格式，请使用 HH:mm 格式' 
        }, 400);
      }
    }

    const [settings] = await db
      .update(notificationSettings)
      .set({
        enableRealtimeNotifications: enableRealtimeNotifications !== undefined ? enableRealtimeNotifications : sql`${notificationSettings.enableRealtimeNotifications}`,
        enableEmailNotifications: enableEmailNotifications !== undefined ? enableEmailNotifications : sql`${notificationSettings.enableEmailNotifications}`,
        notifyOnCompleted: notifyOnCompleted !== undefined ? notifyOnCompleted : sql`${notificationSettings.notifyOnCompleted}`,
        notifyOnFailed: notifyOnFailed !== undefined ? notifyOnFailed : sql`${notificationSettings.notifyOnFailed}`,
        notifyOnError: notifyOnError !== undefined ? notifyOnError : sql`${notificationSettings.notifyOnError}`,
        emailFrequency: emailFrequency || sql`${notificationSettings.emailFrequency}`,
        quietHoursEnabled: quietHoursEnabled !== undefined ? quietHoursEnabled : sql`${notificationSettings.quietHoursEnabled}`,
        quietHoursStart: quietHoursStart,
        quietHoursEnd: quietHoursEnd,
        updatedAt: new Date(),
      })
      .where(eq(notificationSettings.userId, user.id))
      .returning();

    // 如果没有设置记录，创建一个
    if (!settings) {
      const newSettings = await createDefaultSettings(user.id, {
        enableRealtimeNotifications,
        enableEmailNotifications,
        notifyOnCompleted,
        notifyOnFailed,
        notifyOnError,
        emailFrequency,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd,
      });
      return c.json({ 
        success: true, 
        settings: newSettings 
      });
    }

    return c.json({ 
      success: true, 
      settings 
    });
  } catch (error) {
    console.error('更新通知设置失败:', error);
    return c.json({ 
      success: false, 
      error: '更新通知设置失败' 
    }, 500);
  }
});

// 获取通知列表
notificationRoutes.get('/', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const { limit = 20, offset = 0, isRead } = c.req.query();
    
    let query = db
      .select({
        id: notificationRecords.id,
        userId: notificationRecords.userId,
        type: notificationRecords.type,
        title: notificationRecords.title,
        message: notificationRecords.message,
        data: notificationRecords.data,
        isRead: notificationRecords.isRead,
        sentVia: notificationRecords.sentVia,
        scheduledFor: notificationRecords.scheduledFor,
        sentAt: notificationRecords.sentAt,
        readAt: notificationRecords.readAt,
        createdAt: notificationRecords.createdAt,
      })
      .from(notificationRecords)
      .where(eq(notificationRecords.userId, user.id));

    // 过滤已读/未读
    if (isRead !== undefined) {
      query = query.where(eq(notificationRecords.isRead, isRead === 'true'));
    }

    // 获取总数
    const [countResult] = await db
      .select({ total: sql`count(*)`.mapWith(Number) })
      .from(notificationRecords)
      .where(eq(notificationRecords.userId, user.id));

    // 获取通知列表
    const notifications = await query
      .orderBy(desc(notificationRecords.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const formattedNotifications = notifications.map(notification => ({
      ...notification,
      data: notification.data ? JSON.parse(notification.data) : undefined,
    }));

    return c.json({ 
      success: true, 
      notifications: formattedNotifications,
      total: countResult?.total || 0,
    });
  } catch (error) {
    console.error('获取通知列表失败:', error);
    return c.json({ 
      success: false, 
      error: '获取通知列表失败' 
    }, 500);
  }
});

// 标记通知为已读
notificationRoutes.post('/:id/read', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const notificationId = parseInt(c.req.param('id'));
    
    const [updated] = await db
      .update(notificationRecords)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notificationRecords.id, notificationId),
          eq(notificationRecords.userId, user.id)
        )
      )
      .returning();

    if (!updated) {
      return c.json({ 
        success: false, 
        error: '通知不存在或不属于当前用户' 
      }, 404);
    }

    return c.json({ 
      success: true, 
      message: '通知已标记为已读'
    });
  } catch (error) {
    console.error('标记通知已读失败:', error);
    return c.json({ 
      success: false, 
      error: '标记通知已读失败' 
    }, 500);
  }
});

// 批量标记通知为已读
notificationRoutes.post('/read-all', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const result = await db
      .update(notificationRecords)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notificationRecords.userId, user.id),
          eq(notificationRecords.isRead, false)
        )
      );

    return c.json({ 
      success: true, 
      message: `已标记 ${result.changes || 0} 个通知为已读`
    });
  } catch (error) {
    console.error('批量标记通知已读失败:', error);
    return c.json({ 
      success: false, 
      error: '批量标记通知已读失败' 
    }, 500);
  }
});

// 删除通知
notificationRoutes.delete('/:id', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const notificationId = parseInt(c.req.param('id'));
    
    const result = await db
      .delete(notificationRecords)
      .where(
        and(
          eq(notificationRecords.id, notificationId),
          eq(notificationRecords.userId, user.id)
        )
      );

    if (result.changes === 0) {
      return c.json({ 
        success: false, 
        error: '通知不存在或不属于当前用户' 
      }, 404);
    }

    return c.json({ 
      success: true, 
      message: '通知已删除'
    });
  } catch (error) {
    console.error('删除通知失败:', error);
    return c.json({ 
      success: false, 
      error: '删除通知失败' 
    }, 500);
  }
});

// 获取未读通知数量
notificationRoutes.get('/unread-count', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const [result] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(notificationRecords)
      .where(
        and(
          eq(notificationRecords.userId, user.id),
          eq(notificationRecords.isRead, false)
        )
      );

    return c.json({ 
      success: true, 
      unreadCount: result?.count || 0
    });
  } catch (error) {
    console.error('获取未读通知数量失败:', error);
    return c.json({ 
      success: false, 
      error: '获取未读通知数量失败' 
    }, 500);
  }
});

// 创建任务通知
notificationRoutes.post('/create/task', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json({ success: false, error: '用户未认证' }, 401);
    }

    const body = await c.req.json();
    const {
      taskId,
      title,
      message,
      type = 'task_completed',
      data
    } = body;

    // 验证输入
    if (!taskId || !title || !message) {
      return c.json({ 
        success: false, 
        error: 'taskId, title, 和 message 为必填字段' 
      }, 400);
    }

    const validTypes = ['task_completed', 'task_failed', 'task_progress', 'error', 'system'];
    if (!validTypes.includes(type)) {
      return c.json({ 
        success: false, 
        error: '无效的通知类型' 
      }, 400);
    }

    // 检查用户的通知设置
    const [settings] = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, user.id))
      .limit(1);

    const notificationSettings = settings || await createDefaultSettings(user.id);

    // 检查是否在静默时间
    if (shouldSendNotification(notificationSettings, type)) {
      await createNotification({
        userId: user.id,
        type,
        title,
        message,
        data,
        sentVia: 'realtime',
      });

      // 如果启用了邮件通知，创建邮件通知
      if (notificationSettings.enableEmailNotifications) {
        await createNotification({
          userId: user.id,
          type,
          title,
          message,
          data,
          sentVia: 'email',
          scheduledFor: calculateNextEmailTime(notificationSettings.emailFrequency),
        });
      }
    }

    return c.json({ 
      success: true, 
      message: '通知已创建'
    });
  } catch (error) {
    console.error('创建任务通知失败:', error);
    return c.json({ 
      success: false, 
      error: '创建任务通知失败' 
    }, 500);
  }
});

// 发送系统通知
notificationRoutes.post('/create/system', async (c) => {
  try {
    // 这个端点需要管理员权限
    const user = getCurrentUser(c);
    if (!user || !user.isAdmin) {
      return c.json({ success: false, error: '权限不足' }, 403);
    }

    const body = await c.req.json();
    const {
      userIds,
      title,
      message,
      type = 'system',
      data
    } = body;

    // 验证输入
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !title || !message) {
      return c.json({ 
        success: false, 
        error: 'userIds, title, 和 message 为必填字段' 
      }, 400);
    }

    // 为每个用户创建通知
    const createdNotifications = [];
    for (const userId of userIds) {
      const notification = await createNotification({
        userId: userId,
        type,
        title,
        message,
        data,
        sentVia: 'realtime',
      });
      createdNotifications.push(notification);
    }

    return c.json({ 
      success: true, 
      message: `已为 ${userIds.length} 个用户创建系统通知`,
      notifications: createdNotifications
    });
  } catch (error) {
    console.error('发送系统通知失败:', error);
    return c.json({ 
      success: false, 
      error: '发送系统通知失败' 
    }, 500);
  }
});

// 清理过期通知
notificationRoutes.post('/cleanup', async (c) => {
  try {
    // 这个端点需要管理员权限
    const user = getCurrentUser(c);
    if (!user || !user.isAdmin) {
      return c.json({ success: false, error: '权限不足' }, 403);
    }

    const body = await c.req.json();
    const { daysToKeep = 30 } = body;

    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const [result] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(notificationRecords)
      .where(
        and(
          or(
            lte(notificationRecords.createdAt, cutoffDate),
            and(
              eq(notificationRecords.sentVia, 'email'),
              isNull(notificationRecords.sentAt),
              lte(notificationRecords.scheduledFor, cutoffDate)
            )
          )
        )
      )
      .limit(1);

    const deletedCount = await db
      .delete(notificationRecords)
      .where(
        and(
          or(
            lte(notificationRecords.createdAt, cutoffDate),
            and(
              eq(notificationRecords.sentVia, 'email'),
              isNull(notificationRecords.sentAt),
              lte(notificationRecords.scheduledFor, cutoffDate)
            )
          )
        )
      );

    return c.json({ 
      success: true, 
      message: `清理了 ${deletedCount.changes || 0} 个过期通知`,
      foundExpired: result?.count || 0,
    });
  } catch (error) {
    console.error('清理过期通知失败:', error);
    return c.json({ 
      success: false, 
      error: '清理过期通知失败' 
    }, 500);
  }
});

// 辅助函数：创建默认通知设置
async function createDefaultSettings(userId: number, overrides?: Partial<NotificationSettings>): Promise<NotificationSettings> {
  const settings = {
    userId,
    enableRealtimeNotifications: true,
    enableEmailNotifications: false,
    notifyOnCompleted: true,
    notifyOnFailed: true,
    notifyOnError: true,
    emailFrequency: 'immediate',
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  const [newSettings] = await db
    .insert(notificationSettings)
    .values(settings)
    .returning();

  return newSettings;
}

// 辅助函数：判断是否应该发送通知
function shouldSendNotification(settings: NotificationSettings, type: string): boolean {
  if (!settings.enableRealtimeNotifications) {
    return false;
  }

  // 检查静默时间
  if (settings.quietHoursEnabled && settings.quietHoursStart && settings.quietHoursEnd) {
    const now = new Date();
    const [currentHour, currentMinute] = [now.getHours(), now.getMinutes()];
    const [startHour, startMinute] = settings.quietHoursStart.split(':').map(Number);
    const [endHour, endMinute] = settings.quietHoursEnd.split(':').map(Number);

    const currentTime = currentHour * 60 + currentMinute;
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    // 处理跨午夜的情况
    if (startTime < endTime) {
      if (currentTime >= startTime && currentTime < endTime) {
        return false; // 在静默时间内
      }
    } else {
      if (currentTime >= startTime || currentTime < endTime) {
        return false; // 在静默时间内
      }
    }
  }

  // 根据通知类型和设置判断
  switch (type) {
    case 'task_completed':
      return settings.notifyOnCompleted;
    case 'task_failed':
      return settings.notifyOnFailed;
    case 'error':
      return settings.notifyOnError;
    default:
      return true;
  }
}

// 辅助函数：计算下一次邮件发送时间
function calculateNextEmailTime(frequency: string): Date {
  const now = new Date();
  
  switch (frequency) {
    case 'immediate':
      return now;
    case 'daily':
      // 明天同一时间
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      // 下周同一时间
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    default:
      return now;
  }
}

// 辅助函数：创建通知
async function createNotification(notification: {
  userId: number;
  type: string;
  title: string;
  message: string;
  data?: any;
  sentVia: 'realtime' | 'email';
  scheduledFor?: Date;
}): Promise<NotificationRecord> {
  const [newNotification] = await db
    .insert(notificationRecords)
    .values({
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data ? JSON.stringify(notification.data) : undefined,
      isRead: false,
      sentVia: notification.sentVia,
      scheduledFor: notification.scheduledFor,
      sentAt: notification.sentVia === 'realtime' ? new Date() : undefined,
      createdAt: new Date(),
    })
    .returning();

  return newNotification;
}

export default notificationRoutes;