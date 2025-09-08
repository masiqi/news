// src/routes/topics.ts
import { Hono } from "hono";
import { TopicExtractionService } from "../services/topic-extraction.service";
import { ModelConfigService, TopicExtractionModelConfig } from "../services/model-config.service";
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, processedContents } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';

const topicsRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 获取可用模型列表
topicsRoutes.get("/models", async (c) => {
  try {
    const models = ModelConfigService.getAvailableModels();
    const comparison = ModelConfigService.getModelComparison();
    
    return c.json({
      success: true,
      data: {
        models,
        comparison,
        recommended: ModelConfigService.getRecommendedModelConfig('topic-extraction')
      }
    });
  } catch (error) {
    console.error('获取模型列表失败:', error);
    return c.json({ 
      error: "获取模型列表失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 提取单个条目的主题（支持模型选择）
topicsRoutes.post("/extract/:entryId", async (c) => {
  const entryId = parseInt(c.req.param('entryId'));
  
  if (isNaN(entryId)) {
    return c.json({ error: "无效的条目ID" }, 400);
  }

  const db = drizzle(c.env.DB);
  
  try {
    // 获取RSS条目
    const entry = await db.select()
      .from(rssEntries)
      .where(eq(rssEntries.id, entryId))
      .get();
    
    if (!entry) {
      return c.json({ error: "条目不存在" }, 404);
    }

    // 获取请求体中的模型配置
    const body = await c.req.json();
    const modelConfig = body.modelConfig || ModelConfigService.getRecommendedModelConfig('topic-extraction');
    
    const topicService = new TopicExtractionService(c.env);
    const result = await topicService.extractTopics(entry.content, entry.title, modelConfig);
    
    return c.json({
      success: true,
      data: {
        entryId,
        ...result
      }
    });
  } catch (error) {
    console.error('主题提取失败:', error);
    return c.json({ 
      error: "主题提取失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 批量提取未处理主题的条目
topicsRoutes.post("/batch-extract", async (c) => {
  const db = drizzle(c.env.DB);
  
  try {
    // 获取请求体中的模型配置
    const body = await c.req.json();
    const modelConfig = body.modelConfig || ModelConfigService.getRecommendedModelConfig('topic-extraction');
    
    // 获取所有未提取主题的已处理条目
    const unprocessedEntries = await db.select()
      .from(rssEntries)
      .innerJoin(processedContents, eq(rssEntries.id, processedContents.entryId))
      .where(and(
        isNull(processedContents.topics)
      ))
      .limit(body.limit || 50) // 支持自定义批量大小
      .all();

    if (unprocessedEntries.length === 0) {
      return c.json({ 
        success: true, 
        message: "没有需要处理的主题", 
        processedCount: 0 
      });
    }

    const topicService = new TopicExtractionService(c.env);
    
    // 准备批量处理数据
    const batchData = unprocessedEntries.map(entry => ({
      id: entry.id,
      content: entry.content,
      title: entry.title
    }));

    // 执行批量主题提取
    await topicService.processBatchTopics(batchData, modelConfig);
    
    return c.json({ 
      success: true, 
      message: "批量主题提取完成", 
      processedCount: batchData.length,
      modelConfig: modelConfig.model
    });
  } catch (error) {
    console.error('批量主题提取失败:', error);
    return c.json({ 
      error: "批量主题提取失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取条目的主题信息
topicsRoutes.get("/:entryId", async (c) => {
  const entryId = parseInt(c.req.param('entryId'));
  
  if (isNaN(entryId)) {
    return c.json({ error: "无效的条目ID" }, 400);
  }

  const db = drizzle(c.env.DB);
  
  try {
    const result = await db.select({
        topics: processedContents.topics,
        keywords: processedContents.keywords,
        sentiment: processedContents.sentiment,
        modelUsed: processedContents.modelUsed,
        processingTime: processedContents.processingTime,
        createdAt: processedContents.createdAt
      })
      .from(rssEntries)
      .innerJoin(processedContents, eq(rssEntries.id, processedContents.entryId))
      .where(eq(rssEntries.id, entryId))
      .get();
    
    if (!result) {
      return c.json({ error: "主题信息不存在" }, 404);
    }

    // 解析主题JSON
    const parsedResult = {
      ...result,
      topics: result.topics ? JSON.parse(result.topics) : [],
      keywords: result.keywords ? result.keywords.split(',') : []
    };

    return c.json({
      success: true,
      data: parsedResult
    });
  } catch (error) {
    console.error('获取主题信息失败:', error);
    return c.json({ 
      error: "获取主题信息失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取主题统计信息
topicsRoutes.get("/stats", async (c) => {
  const db = drizzle(c.env.DB);
  
  try {
    // 获取主题统计
    const stats = await db.select({
        entryCount: { sql: 'COUNT(*)' },
        withTopicsCount: { sql: 'COUNT(CASE WHEN topics IS NOT NULL AND topics != \'[]\' THEN 1 END)' },
        withoutTopicsCount: { sql: 'COUNT(CASE WHEN topics IS NULL OR topics = \'[]\' THEN 1 END)' },
        avgProcessingTime: { sql: 'AVG(processing_time)' }
      })
      .from(processedContents)
      .all();

    // 获取最热门的主题
    const popularTopics = await db.select({
        topic: sql`json_extract(topics, '$[*]')`,
        count: sql`COUNT(*)`
      })
      .from(processedContents)
      .where(sql`topics IS NOT NULL AND topics != '[]'`)
      .groupBy(sql`json_extract(topics, '$[*]')`)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10)
      .all();

    // 按模型统计
    const modelStats = await db.select({
        modelUsed: processedContents.modelUsed,
        count: sql`COUNT(*)`,
        avgProcessingTime: sql`AVG(processing_time)`
      })
      .from(processedContents)
      .where(sql`modelUsed IS NOT NULL`)
      .groupBy(sql`modelUsed`)
      .orderBy(sql`COUNT(*) DESC`)
      .all();

    return c.json({
      success: true,
      data: {
        stats: stats[0] || {},
        popularTopics,
        modelStats
      }
    });
  } catch (error) {
    console.error('获取主题统计失败:', error);
    return c.json({ 
      error: "获取主题统计失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default topicsRoutes;
