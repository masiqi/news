// API路由 - RSS调度和处理
import { Hono } from "hono";
import { RssSchedulerService } from "../services/rss-scheduler.service";
import { ContentDeduplicationService } from "../services/content-deduplication.service";
import { ContentDistributionService } from "../services/content-distribution.service";
import { StorageOptimizationService } from "../services/storage-optimization.service";
import { initDB } from "../db";
import type { CloudflareBindings } from "../env";

const router = new Hono<{ Bindings: CloudflareBindings }>();

// RSS调度路由
router.post("/schedule", async (c) => {
  try {
    console.log("[API] 收到RSS调度请求");
    
    const db = initDB(c.env.DB);
    const rssScheduler = new RssSchedulerService(db, c.env);
    
    const body = await c.req.json();
    const { force = false } = body;
    
    console.log(`[RSS_SCHEDULER] 开始RSS调度，强制模式: ${force}`);
    
    const results = await rssScheduler.scheduleAllSources(force);
    
    console.log(`[RSS_SCHEDULER] RSS调度完成，处理了 ${results.length} 个源`);
    
    return c.json({
      success: true,
      message: "RSS调度已完成",
      results: results,
      processedSources: results.length,
      successfulSources: results.filter(r => r.success).length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("[RSS_SCHEDULER] RSS调度失败:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// RSS源状态路由
router.get("/sources", async (c) => {
  try {
    const db = initDB(c.env.DB);
    const { sources } = await import("../db/schema");
    const { desc } = await import("drizzle-orm");
    
    const rssSources = await db.select()
      .from(sources)
      .orderBy(desc(sources.lastFetchedAt))
      .limit(50);
    
    return c.json({
      success: true,
      sources: rssSources,
      count: rssSources.length
    });
    
  } catch (error) {
    console.error("[API] 获取RSS源失败:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

// AI处理路由
router.post("/process", async (c) => {
  try {
    console.log("[API] 收到AI处理请求");
    
    const db = initDB(c.env.DB);
    const { content, sourceId, entryId } = await c.req.json();
    
    if (!content) {
      return c.json({
        success: false,
        error: "缺少content参数"
      }, 400);
    }
    
    console.log(`[AI_PROCESSOR] 开始AI处理，源ID: ${sourceId || 'N/A'}, 条目ID: ${entryId || 'N/A'}`);
    
    // 模拟AI处理过程
    const processingResult = {
      content: content,
      processedContent: `AI处理后的内容: ${content.substring(0, 100)}...`,
      topics: ["AI", "技术", "创新"],
      keywords: ["人工智能", "机器学习", "深度学习"],
      importanceScore: 0.8,
      processingTime: Math.floor(Math.random() * 1000) + 500,
      timestamp: new Date().toISOString()
    };
    
    console.log(`[AI_PROCESSOR] AI处理完成，耗时: ${processingResult.processingTime}ms`);
    
    return c.json({
      success: true,
      result: processingResult,
      message: "AI处理完成"
    });
    
  } catch (error) {
    console.error("[AI_PROCESSOR] AI处理失败:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

// AI统计路由
router.get("/stats", async (c) => {
  try {
    // 模拟AI处理统计
    const stats = {
      totalProcessed: 156,
      successCount: 148,
      failureCount: 8,
      avgProcessingTime: 750,
      lastProcessingTime: new Date().toISOString(),
      successRate: 94.9
    };
    
    return c.json({
      success: true,
      stats: stats
    });
    
  } catch (error) {
    console.error("[API] 获取AI统计失败:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

// 内容去重路由
router.post("/deduplicate", async (c) => {
  try {
    console.log("[API] 收到内容去重请求");
    
    const db = initDB(c.env.DB);
    const contentDeduplication = new ContentDeduplicationService(db);
    
    const { url, sourceId } = await c.req.json();
    
    if (!url) {
      return c.json({
        success: false,
        error: "缺少url参数"
      }, 400);
    }
    
    console.log(`[CONTENT_DEDUPLICATION] 检查内容去重，URL: ${url}`);
    
    const isDuplicate = await contentDeduplication.isContentDuplicate(url, sourceId);
    
    console.log(`[CONTENT_DEDUPLICATION] 去重检查结果: ${isDuplicate ? '重复' : '新内容'}`);
    
    return c.json({
      success: true,
      isDuplicate: isDuplicate,
      url: url,
      message: isDuplicate ? "内容已存在，跳过处理" : "新内容，可以进行处理"
    });
    
  } catch (error) {
    console.error("[CONTENT_DEDUPLICATION] 内容去重检查失败:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

export default router;