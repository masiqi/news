// src/routes/distribution.ts
// 内容分发管理API路由

import { Hono } from "hono";
import { drizzle } from 'drizzle-orm/d1';
import { 
  users, 
  sources, 
  rssEntries, 
  processedContents, 
  userNotes,
  userStorageRefs,
  userTopics,
  userKeywords,
  userAutoStorageConfigs,
  syncCredentials,
  storageStats
} from '../db/schema';
import { and, eq, desc, gte, lt, sql, inArray } from 'drizzle-orm';
import { ContentDistributionService } from '../services/content-distribution.service';
import { SharedContentPoolService } from '../services/shared-content-pool.service';
import { R2Service } from '../services/r2.service';

const distributionRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 获取分发统计信息
distributionRoutes.get("/stats", async (c) => {
  try {
    const userId = c.req.query('userId');
    
    const db = drizzle(c.env.DB);
    const r2Service = new R2Service(c.env);
    const sharedContentPool = new SharedContentPoolService(db, r2Service);
    const distributionService = new ContentDistributionService(sharedContentPool, r2Service);
    
    const stats = await distributionService.getDistributionStats(userId);
    
    return c.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('获取分发统计失败:', error);
    return c.json({ 
      error: "获取分发统计失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

// 获取用户分发历史
distributionRoutes.get("/history", async (c) => {
  try {
    const userId = c.req.query('userId');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;
    
    if (!userId) {
      return c.json({ error: "缺少用户ID参数" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    
    // 获取用户的分发历史
    const history = await db.select({
      id: userStorageRefs.id,
      entryId: userStorageRefs.entryId,
      contentHash: userStorageRefs.contentHash,
      userPath: userStorageRefs.userPath,
      isModified: userStorageRefs.isModified,
      fileSize: userStorageRefs.fileSize,
      createdAt: userStorageRefs.createdAt,
      lastAccessedAt: userStorageRefs.lastAccessedAt,
      accessCount: userStorageRefs.accessCount,
      title: rssEntries.title,
      sourceName: sources.name,
      publishedAt: rssEntries.publishedAt
    })
    .from(userStorageRefs)
    .leftJoin(rssEntries, eq(userStorageRefs.entryId, rssEntries.id))
    .leftJoin(sources, eq(rssEntries.sourceId, sources.id))
    .where(eq(userStorageRefs.userId, userId))
    .orderBy(desc(userStorageRefs.createdAt))
    .limit(limit)
    .offset(offset);
    
    // 获取总数
    const totalCount = await db.select({ count: sql<number>`COUNT(*)` })
      .from(userStorageRefs)
      .where(eq(userStorageRefs.userId, userId));
    
    return c.json({
      success: true,
      data: {
        history,
        pagination: {
          page,
          limit,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('获取分发历史失败:', error);
    return c.json({ 
      error: "获取分发历史失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

// 触发内容分发
distributionRoutes.post("/distribute", async (c) => {
  try {
    const body = await c.req.json();
    const { contentHash, entryId, processedContentId, contentFeatures } = body;
    
    console.log(`[CONTENT_DISTRIBUTION] 开始内容分发: 内容哈希 ${contentHash}, 条目ID ${entryId}`);
    
    const db = drizzle(c.env.DB);
    const r2Service = new R2Service(c.env);
    const sharedContentPool = new SharedContentPoolService(db, r2Service);
    const distributionService = new ContentDistributionService(sharedContentPool, r2Service);
    
    if (!contentHash || !entryId || !contentFeatures) {
      return c.json({
        success: false,
        error: "缺少必要参数: contentHash, entryId, contentFeatures"
      }, 400);
    }
    
    const results = await distributionService.distributeContent(
      contentHash,
      processedContentId || 1,
      entryId,
      contentFeatures
    );
    
    console.log(`[CONTENT_DISTRIBUTION] 内容分发完成: 成功 ${results.filter(r => r.success).length}/${results.length}`);
    
    return c.json({
      success: true,
      message: "内容分发已完成",
      results: results,
      totalTargets: results.length,
      successfulTargets: results.filter(r => r.success).length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("[CONTENT_DISTRIBUTION] 内容分发失败:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

// 获取用户内容偏好
distributionRoutes.get("/preferences/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    
    const db = drizzle(c.env.DB);
    
    // 获取用户主题偏好
    const topics = await db.select({
      topicName: userTopics.topicName,
      entryCount: userTopics.entryCount,
      lastUsedAt: userTopics.lastUsedAt
    })
    .from(userTopics)
    .where(eq(userTopics.userId, userId))
    .orderBy(desc(userTopics.entryCount));
    
    // 获取用户关键词偏好
    const keywords = await db.select({
      keywordName: userKeywords.keywordName,
      entryCount: userKeywords.entryCount,
      lastUsedAt: userKeywords.lastUsedAt
    })
    .from(userKeywords)
    .where(eq(userKeywords.userId, userId))
    .orderBy(desc(userKeywords.entryCount));
    
    // 获取用户自动存储配置
    const autoStorageConfig = await db.select()
      .from(userAutoStorageConfigs)
      .where(eq(userAutoStorageConfigs.userId, userId))
      .limit(1);
    
    return c.json({
      success: true,
      data: {
        topics,
        keywords,
        autoStorageConfig: autoStorageConfig[0] || null
      }
    });
    
  } catch (error) {
    console.error('获取用户偏好失败:', error);
    return c.json({ 
      error: "获取用户偏好失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

// 手动触发内容重新分发
distributionRoutes.post("/redistribute", async (c) => {
  try {
    const body = await c.req.json();
    const { contentHash, targetUserIds } = body;
    
    if (!contentHash) {
      return c.json({ error: "缺少contentHash参数" }, 400);
    }
    
    const db = drizzle(c.env.DB);
    const r2Service = new R2Service(c.env);
    const sharedContentPool = new SharedContentPoolService(db, r2Service);
    const distributionService = new ContentDistributionService(sharedContentPool, r2Service);
    
    const results = await distributionService.redistributeContent(contentHash, targetUserIds);
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    return c.json({
      success: true,
      message: "内容重新分发完成",
      data: {
        results,
        summary: {
          total: totalCount,
          success: successCount,
          failed: totalCount - successCount,
          successRate: totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : 0
        }
      }
    });
    
  } catch (error) {
    console.error('内容重新分发失败:', error);
    return c.json({ 
      error: "内容重新分发失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

// 清理无效分发记录
distributionRoutes.post("/cleanup", async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const r2Service = new R2Service(c.env);
    const sharedContentPool = new SharedContentPoolService(db, r2Service);
    const distributionService = new ContentDistributionService(sharedContentPool, r2Service);
    
    const cleanedCount = await distributionService.cleanupInvalidDistributions();
    
    return c.json({
      success: true,
      message: "清理完成",
      data: {
        cleanedCount
      }
    });
    
  } catch (error) {
    console.error('清理无效分发记录失败:', error);
    return c.json({ 
      error: "清理无效分发记录失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

// 获取热门分发内容
distributionRoutes.get("/popular", async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10');
    const days = parseInt(c.req.query('days') || '7');
    
    const db = drizzle(c.env.DB);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // 获取最受欢迎的分发内容（基于访问次数）
    const popularContent = await db.select({
      contentHash: userStorageRefs.contentHash,
      distributionCount: sql<number>`COUNT(DISTINCT ${userStorageRefs.userId})`,
      totalAccessCount: sql<number>`SUM(${userStorageRefs.accessCount})`,
      avgFileSize: sql<number>`AVG(${userStorageRefs.fileSize})`,
      title: rssEntries.title,
      sourceName: sources.name
    })
    .from(userStorageRefs)
    .leftJoin(rssEntries, eq(userStorageRefs.entryId, rssEntries.id))
    .leftJoin(sources, eq(rssEntries.sourceId, sources.id))
    .where(gte(userStorageRefs.createdAt, startDate))
    .groupBy(userStorageRefs.contentHash, rssEntries.title, sources.name)
    .orderBy(desc(sql<number>`COUNT(DISTINCT ${userStorageRefs.userId})`))
    .limit(limit);
    
    return c.json({
      success: true,
      data: {
        popularContent,
        period: {
          days,
          startDate,
          endDate: new Date()
        }
      }
    });
    
  } catch (error) {
    console.error('获取热门分发内容失败:', error);
    return c.json({ 
      error: "获取热门分发内容失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

// 获取用户今日分发统计
distributionRoutes.get("/today-stats/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    
    const db = drizzle(c.env.DB);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 获取今日分发统计
    const todayStats = await db.select({
      totalFiles: sql<number>`COUNT(*)`,
      totalSize: sql<number>`SUM(${userStorageRefs.fileSize})`,
      avgProcessingTime: sql<number>`AVG(${userStorageRefs.accessCount})`
    })
    .from(userStorageRefs)
    .where(
      and(
        eq(userStorageRefs.userId, userId),
        gte(userStorageRefs.createdAt, today),
        lt(userStorageRefs.createdAt, tomorrow)
      )
    );
    
    // 获取今日修改的文件数
    const modifiedCount = await db.select({ count: sql<number>`COUNT(*)` })
      .from(userStorageRefs)
      .where(
        and(
          eq(userStorageRefs.userId, userId),
          eq(userStorageRefs.isModified, true),
          gte(userStorageRefs.modifiedAt, today),
          lt(userStorageRefs.modifiedAt, tomorrow)
        )
      );
    
    return c.json({
      success: true,
      data: {
        todayStats: todayStats[0] || { totalFiles: 0, totalSize: 0, avgProcessingTime: 0 },
        modifiedFiles: modifiedCount[0]?.count || 0,
        date: today
      }
    });
    
  } catch (error) {
    console.error('获取用户今日统计失败:', error);
    return c.json({ 
      error: "获取用户今日统计失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

// 更新用户内容偏好
distributionRoutes.put("/preferences/:userId", async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    const { topics, keywords, minImportanceScore, maxDailyContent, deliverySchedule } = body;
    
    const db = drizzle(c.env.DB);
    
    // 更新用户主题（先删除旧的，再添加新的）
    if (topics && topics.length > 0) {
      await db.delete(userTopics).where(eq(userTopics.userId, userId));
      
      for (const topic of topics) {
        await db.insert(userTopics).values({
          userId,
          topicName: topic,
          entryCount: 0, // 初始为0，会随着内容分发自动更新
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
    
    // 更新用户关键词（先删除旧的，再添加新的）
    if (keywords && keywords.length > 0) {
      await db.delete(userKeywords).where(eq(userKeywords.userId, userId));
      
      for (const keyword of keywords) {
        await db.insert(userKeywords).values({
          userId,
          keywordName: keyword,
          entryCount: 0, // 初始为0，会随着内容分发自动更新
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
    
    // 更新自动存储配置
    if (maxDailyContent !== undefined) {
      await db.update(userAutoStorageConfigs)
        .set({ maxFilesPerDay: maxDailyContent })
        .where(eq(userAutoStorageConfigs.userId, userId));
    }
    
    return c.json({
      success: true,
      message: "用户内容偏好更新成功"
    });
    
  } catch (error) {
    console.error('更新用户内容偏好失败:', error);
    return c.json({ 
      error: "更新用户内容偏好失败", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

export default distributionRoutes;