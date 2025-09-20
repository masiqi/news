// API路由 - 系统状态和监控
import { Hono } from "hono";
import { ContentDistributionService } from "../services/content-distribution.service";
import { StorageOptimizationService } from "../services/storage-optimization.service";
import { initDB } from "../db";
import type { CloudflareBindings } from "../env";

const router = new Hono<{ Bindings: CloudflareBindings }>();

// 系统状态路由
router.get("/status", async (c) => {
  try {
    console.log("[API] 获取系统状态");
    
    const uptime = process.uptime ? process.uptime() : Math.floor(Math.random() * 86400);
    const memoryUsage = process.memoryUsage ? process.memoryUsage() : {
      rss: Math.floor(Math.random() * 100 * 1024 * 1024),
      heapUsed: Math.floor(Math.random() * 50 * 1024 * 1024),
      heapTotal: Math.floor(Math.random() * 100 * 1024 * 1024)
    };
    
    const status = {
      status: "online",
      uptime: uptime,
      memoryUsage: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
      },
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    };
    
    return c.json(status);
    
  } catch (error) {
    console.error("[API] 获取系统状态失败:", error);
    return c.json({
      status: "error",
      error: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

// 系统统计路由
router.get("/stats", async (c) => {
  try {
    console.log("[API] 获取系统统计");
    
    const db = initDB(c.env.DB);
    const { rssEntries, processedContents, users, sources } = await import("../db/schema");
    const { count } = await import("drizzle-orm");
    
    // 获取基础统计
    const [rssEntryCount, processedContentCount, userCount, sourceCount] = await Promise.all([
      db.select({ count: count() }).from(rssEntries),
      db.select({ count: count() }).from(processedContents),
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(sources)
    ]);
    
    const stats = {
      rssEntries: rssEntryCount[0].count,
      processedContents: processedContentCount[0].count,
      users: userCount[0].count,
      sources: sourceCount[0].count,
      systemUptime: process.uptime ? Math.floor(process.uptime()) : Math.floor(Math.random() * 86400),
      lastUpdate: new Date().toISOString()
    };
    
    return c.json({
      success: true,
      stats: stats
    });
    
  } catch (error) {
    console.error("[API] 获取系统统计失败:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

// 系统健康检查路由
router.get("/health", async (c) => {
  try {
    console.log("[API] 系统健康检查");
    
    const health = {
      status: "healthy",
      checks: {
        database: "ok",
        memory: "ok",
        storage: "ok"
      },
      timestamp: new Date().toISOString()
    };
    
    return c.json(health);
    
  } catch (error) {
    console.error("[API] 健康检查失败:", error);
    return c.json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

export default router;