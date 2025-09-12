import { Hono } from 'hono';
import { Context } from 'hono';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { initDB } from '../../db';
import { systemMetrics, serviceHealth, queueStatus } from '../../db/schema';
import { desc } from 'drizzle-orm';

const monitoring = new Hono<{ Bindings: CloudflareBindings }>();

// 获取系统概览
monitoring.get('/overview', requireAuth, requireAdmin, async (c) => {
  try {
    const db = initDB(c.env.DB);
    
    // 获取最新的系统指标
    const [system] = await db
      .select()
      .from(systemMetrics)
      .orderBy(desc(systemMetrics.timestamp))
      .limit(1);

    // 获取服务健康状态
    const services = await db
      .select()
      .from(serviceHealth)
      .orderBy(desc(serviceHealth.lastCheck));

    // 获取队列状态
    const queues = await db
      .select()
      .from(queueStatus)
      .orderBy(desc(queueStatus.lastUpdated));

    return c.json({
      success: true,
      data: {
        system: system || null,
        services,
        queues,
        users: null,
        alerts: []
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

export default monitoring;