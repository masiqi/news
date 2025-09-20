// API路由 - 监控和管理
import { Hono } from "hono";
import { initDB } from "../db";
import type { CloudflareBindings } from "../env";

const router = new Hono<{ Bindings: CloudflareBindings }>();

// 队列状态路由
router.get("/queue/status", async (c) => {
  try {
    console.log("[API] 获取队列状态");
    
    // 模拟队列状态
    const queueStatus = {
      queue: "rss-queue",
      pendingMessages: Math.floor(Math.random() * 10),
      acknowledgedMessages: Math.floor(Math.random() * 100),
      deadLetterMessages: Math.floor(Math.random() * 5),
      timestamp: new Date().toISOString()
    };
    
    return c.json({
      success: true,
      queue: queueStatus
    });
    
  } catch (error) {
    console.error("[API] 获取队列状态失败:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

// 队列测试路由
router.post("/queue/test", async (c) => {
  try {
    console.log("[API] 发送队列测试消息");
    
    const testMessage = {
      type: "ai_process",
      sourceId: 1,
      userId: "test-user",
      content: "测试内容",
      metadata: { entryId: 123 }
    };
    
    // 模拟发送到队列
    console.log("[API] 测试消息已发送:", testMessage);
    
    return c.json({
      success: true,
      message: "测试消息已发送",
      messageId: `msg-${Date.now()}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("[API] 发送测试消息失败:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

// 监控数据路由
router.get("/metrics", async (c) => {
  try {
    console.log("[API] 获取监控指标");
    
    // 模拟监控指标
    const metrics = {
      system: {
        uptime: process.uptime ? Math.floor(process.uptime()) : Math.floor(Math.random() * 86400),
        memoryUsage: process.memoryUsage ? {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        } : {
          rss: Math.floor(Math.random() * 100),
          heapUsed: Math.floor(Math.random() * 50)
        }
      },
      processing: {
        rssFetches: Math.floor(Math.random() * 100),
        aiProcesses: Math.floor(Math.random() * 50),
        contentDistributions: Math.floor(Math.random() * 200),
        storageOptimizations: Math.floor(Math.random() * 10)
      },
      performance: {
        avgRssFetchTime: Math.floor(Math.random() * 1000) + 500,
        avgAiProcessingTime: Math.floor(Math.random() * 2000) + 1000,
        avgDistributionTime: Math.floor(Math.random() * 500) + 100
      },
      timestamp: new Date().toISOString()
    };
    
    return c.json({
      success: true,
      metrics: metrics
    });
    
  } catch (error) {
    console.error("[API] 获取监控指标失败:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "未知错误"
    }, 500);
  }
});

export default router;