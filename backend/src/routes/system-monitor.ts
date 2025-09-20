// 系统状态和队列监控API路由
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, gt, lt, isNull, sql, desc, or } from 'drizzle-orm';
import { 
  rssEntries, 
  sources, 
  processedContents 
} from '../db/schema';
import { QueueMonitorService } from '../services/queue/monitor';
import { RssSchedulerService } from '../services/rss-scheduler.service';
import { ContentDistributionService } from '../services/content-distribution.service';
import { StorageOptimizationService } from '../services/storage-optimization.service';

const systemRoutes = new Hono();

/**
 * 获取系统总体状态
 */
systemRoutes.get('/system/status', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const startTime = Date.now();
    
    // 获取系统基本状态
    const [
      totalSources,
      activeSources,
      totalEntries,
      processedEntries,
      failedEntries,
      recentProcessing
    ] = await Promise.all([
      // 总RSS源数
      db.select({ count: sql`count(*)` }).from(sources),
      
      // 活跃RSS源数 - 失败次数少于3次的视为活跃
      db.select({ count: sql`count(*)` }).from(sources).where(lt(sources.fetchFailureCount, 3)),
      
      // 总RSS条目数
      db.select({ count: sql`count(*)` }).from(rssEntries),
      
      // 已处理条目数
      db.select({ count: sql`count(*)` }).from(rssEntries).where(eq(rssEntries.processed, true)),
      
      // 失败条目数
      db.select({ count: sql`count(*)` }).from(rssEntries).where(gt(rssEntries.failureCount, 0)),
      
      // 最近1小时内的处理记录
      db.select({ count: sql`count(*)` })
        .from(processedContents)
        .where(gt(processedContents.createdAt, new Date(Date.now() - 60 * 60 * 1000)))
    ]);

    // 检查各组件健康状态
    const isHealthy = (
      activeSources[0]?.count > 0 &&
      (failedEntries[0]?.count / totalEntries[0]?.count || 0) < 0.1 && // 失败率 < 10%
      recentProcessing[0]?.count > 0 // 最近有处理活动
    );

    const status = {
      status: isHealthy ? 'healthy' : 'warning',
      checkTime: new Date().toISOString(),
      uptime: process.uptime ? `${Math.floor(process.uptime())}s` : 'N/A',
      components: {
        rssSources: {
          total: totalSources[0]?.count || 0,
          active: activeSources[0]?.count || 0,
          health: activeSources[0]?.count > 0 ? 'healthy' : 'warning'
        },
        contentProcessing: {
          total: totalEntries[0]?.count || 0,
          processed: processedEntries[0]?.count || 0,
          failed: failedEntries[0]?.count || 0,
          successRate: totalEntries[0]?.count > 0 
            ? ((processedEntries[0]?.count / totalEntries[0]?.count) * 100).toFixed(1) + '%'
            : '0%',
          health: failedEntries[0]?.count / totalEntries[0]?.count < 0.1 ? 'healthy' : 'warning'
        },
        recentActivity: {
          lastHourProcessing: recentProcessing[0]?.count || 0,
          health: recentProcessing[0]?.count > 0 ? 'healthy' : 'idle'
        }
      },
      performance: {
        responseTime: Date.now() - startTime,
        memoryUsage: process.memoryUsage ? {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
        } : 'N/A'
      }
    };

    return c.json(status);
  } catch (error) {
    console.error('获取系统状态失败:', error);
    return c.json({
      status: 'error',
      error: error.message,
      checkTime: new Date().toISOString()
    }, 500);
  }
});

/**
 * 获取队列统计信息
 */
systemRoutes.get('/system/queue/stats', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    
    // 获取各队列的统计信息
    const [
      rssQueueStats,
      aiQueueStats
    ] = await Promise.all([
      // RSS处理队列统计 - 基于rssEntries表
      db.select({
        pending: sql`COUNT(CASE WHEN processed = false AND failure_count = 0 THEN 1 END)`,
        processing: sql`COUNT(CASE WHEN processed = false AND failure_count > 0 AND failure_count < 3 THEN 1 END)`,
        failed: sql`COUNT(CASE WHEN failure_count >= 3 THEN 1 END)`,
        total: sql`count(*)`
      }).from(rssEntries),
      
      // AI处理队列统计 - 统计已处理的内容
      db.select({
        pending: sql`COUNT(CASE WHEN processed = false AND failure_count = 0 THEN 1 END)`,
        processing: sql`COUNT(CASE WHEN processed = false AND failure_count > 0 AND failure_count < 3 THEN 1 END)`,
        failed: sql`COUNT(CASE WHEN failure_count >= 3 THEN 1 END)`,
        total: sql`count(*)`
      }).from(rssEntries)
    ]);

    const stats = {
      rssQueue: rssQueueStats[0] || { pending: 0, processing: 0, failed: 0, total: 0 },
      aiQueue: aiQueueStats[0] || { pending: 0, processing: 0, failed: 0, total: 0 },
      distributionQueue: { pending: 0, processing: 0, failed: 0, total: 0 }, // 暂时没有专门的表
      storageQueue: { pending: 0, processing: 0, failed: 0, total: 0 }, // 暂时没有专门的表
      summary: {
        totalPending: (rssQueueStats[0]?.pending || 0) + (aiQueueStats[0]?.pending || 0),
        totalProcessing: (rssQueueStats[0]?.processing || 0) + (aiQueueStats[0]?.processing || 0),
        totalFailed: (rssQueueStats[0]?.failed || 0) + (aiQueueStats[0]?.failed || 0)
      },
      updateTime: new Date().toISOString()
    };

    return c.json(stats);
  } catch (error) {
    console.error('获取队列统计失败:', error);
    return c.json({
      error: error.message,
      updateTime: new Date().toISOString()
    }, 500);
  }
});

/**
 * 获取特定队列的详细信息
 */
systemRoutes.get('/system/queue/:queueType/details', async (c) => {
  const queueType = c.req.param('queueType');
  try {
    const db = drizzle(c.env.DB);
    
    let items = [];
    
    switch (queueType) {
      case 'rss':
        items = await db.select({
          id: rssEntries.id,
          title: rssEntries.title,
          status: sql`CASE 
            WHEN ${rssEntries.failureCount} >= 3 THEN 'failed'
            WHEN ${rssEntries.processed} = true THEN 'completed'
            WHEN ${rssEntries.failureCount} > 0 THEN 'processing'
            ELSE 'pending'
          END`,
          createdAt: rssEntries.createdAt,
          updatedAt: rssEntries.createdAt, // 使用createdAt作为updatedAt
          processingTime: sql`0`, // 暂时设为0，因为没有处理时间字段
          retryCount: rssEntries.failureCount,
          errorMessage: rssEntries.errorMessage
        })
        .from(rssEntries)
        .where(or(gt(rssEntries.failureCount, 0), eq(rssEntries.processed, false)))
        .orderBy(desc(rssEntries.createdAt))
        .limit(50);
        break;
        
      case 'ai':
        // AI队列显示已处理的内容记录，通过关联rssEntries获取状态信息
        items = await db.select({
          id: processedContents.id,
          title: processedContents.summary,
          status: sql`'completed'`, // processedContents表中的记录都是已完成的
          createdAt: processedContents.createdAt,
          updatedAt: processedContents.createdAt, // 使用createdAt作为updatedAt
          processingTime: processedContents.processingTime,
          retryCount: sql`0`, // processedContents表没有重试次数
          errorMessage: sql`NULL` // processedContents表没有错误信息
        })
        .from(processedContents)
        .orderBy(desc(processedContents.createdAt))
        .limit(50);
        break;
        
      case 'distribution':
      case 'storage':
        // 暂时返回空数据，因为没有专门的队列处理表
        items = [];
        break;
        
      default:
        return c.json({ error: '无效的队列类型' }, 400);
    }
    
    return c.json({
      queueType,
      items,
      totalCount: items.length,
      updateTime: new Date().toISOString()
    });
  } catch (error) {
    console.error(`获取${queueType}队列详情失败:`, error);
    return c.json({
      error: error.message,
      updateTime: new Date().toISOString()
    }, 500);
  }
});

/**
 * 手动触发RSS抓取
 */
systemRoutes.post('/system/rss/trigger-fetch', async (c) => {
  try {
    const schedulerService = new RssSchedulerService(c.env.DB);
    const results = await schedulerService.scheduleAllSources(true); // 强制模式
    
    return c.json({
      success: true,
      message: 'RSS抓取已手动触发',
      triggeredAt: new Date().toISOString(),
      results: {
        totalSources: results.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        details: results
      }
    });
  } catch (error) {
    console.error('手动触发RSS抓取失败:', error);
    return c.json({
      success: false,
      error: error.message,
      triggeredAt: new Date().toISOString()
    }, 500);
  }
});

/**
 * 重试队列中的失败任务
 */
systemRoutes.post('/system/queue/:queueType/retry/:id', async (c) => {
  const queueType = c.req.param('queueType');
  try {
    const id = parseInt(c.req.param('id'));
    const db = drizzle(c.env.DB);
    
    switch (queueType) {
      case 'rss':
        await db.update(rssEntries)
          .set({ 
            failureCount: 0, 
            fetchErrorMessage: null,
            processed: false 
          })
          .where(eq(rssEntries.id, id));
        break;
        
      case 'ai':
        // AI队列的重试实际上是通过重置对应的rssEntries记录
        await db.update(rssEntries)
          .set({ 
            failureCount: 0, 
            errorMessage: null,
            processed: false 
          })
          .where(eq(rssEntries.id, id));
        break;
        
      case 'distribution':
      case 'storage':
        // 暂时不支持这些队列的重试
        return c.json({ 
          success: false, 
          message: `${queueType}队列暂不支持重试功能` 
        }, 400);
        
      default:
        return c.json({ error: '无效的队列类型' }, 400);
    }
    
    return c.json({
      success: true,
      message: `${queueType}队列中的任务 ${id} 已标记为重试`,
      retriedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(`重试${queueType}队列任务失败:`, error);
    return c.json({
      success: false,
      error: error.message,
      retriedAt: new Date().toISOString()
    }, 500);
  }
});

/**
 * 删除队列任务
 */
systemRoutes.delete('/system/queue/:queueType/item/:id', async (c) => {
  const queueType = c.req.param('queueType');
  try {
    const id = parseInt(c.req.param('id'));
    const db = drizzle(c.env.DB);
    
    switch (queueType) {
      case 'rss':
        await db.delete(rssEntries).where(eq(rssEntries.id, id));
        break;
        
      case 'ai':
        // AI队列的删除实际上是通过删除对应的rssEntries记录
        await db.delete(rssEntries).where(eq(rssEntries.id, id));
        break;
        
      case 'distribution':
      case 'storage':
        // 暂时不支持这些队列的删除
        return c.json({ 
          success: false, 
          message: `${queueType}队列暂不支持删除功能` 
        }, 400);
        
      default:
        return c.json({ error: '无效的队列类型' }, 400);
    }
    
    return c.json({
      success: true,
      message: `${queueType}队列中的任务 ${id} 已删除`,
      deletedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(`删除${queueType}队列任务失败:`, error);
    return c.json({
      success: false,
      error: error.message,
      deletedAt: new Date().toISOString()
    }, 500);
  }
});

/**
 * 清理失败的任务
 */
systemRoutes.post('/system/queue/cleanup', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    
    // RSS和AI队列都使用rssEntries表，清理失败次数过多的记录
    const rssCleanup = await db.delete(rssEntries).where(gt(rssEntries.failureCount, 3));
    const aiCleanup = { changes: 0 }; // AI队列与RSS队列共享同一个表
    
    return c.json({
      success: true,
      message: '失败任务清理完成',
      cleanedAt: new Date().toISOString(),
      results: {
        rss: rssCleanup.changes || 0,
        ai: aiCleanup.changes || 0,
        distribution: 0, // 暂时没有专门的表
        storage: 0, // 暂时没有专门的表
        total: (rssCleanup.changes || 0) + (aiCleanup.changes || 0)
      }
    });
  } catch (error) {
    console.error('清理失败任务失败:', error);
    return c.json({
      success: false,
      error: error.message,
      cleanedAt: new Date().toISOString()
    }, 500);
  }
});

/**
 * 获取系统日志
 */
systemRoutes.get('/system/logs', async (c) => {
  try {
    // 这里可以从数据库或文件中获取系统日志
    // 由于没有专门的日志表，返回一些模拟数据
    const logs = [
      {
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        level: 'INFO',
        message: 'RSS调度器执行完成，共调度 3 个任务',
        source: 'RSS_SCHEDULER'
      },
      {
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        level: 'INFO',
        message: 'AI处理成功: 条目 ID 90',
        source: 'AI_PROCESSOR'
      },
      {
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        level: 'WARN',
        message: 'GLM处理失败，切换到Cloudflare AI',
        source: 'AI_PROCESSOR'
      }
    ];
    
    return c.json({
      logs,
      totalCount: logs.length,
      updateTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取系统日志失败:', error);
    return c.json({
      error: error.message,
      updateTime: new Date().toISOString()
    }, 500);
  }
});

export default systemRoutes;