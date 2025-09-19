import { Hono } from "hono";
import { drizzle } from 'drizzle-orm/d1';
import { eq, or, isNotNull } from 'drizzle-orm';
import { tagAggregationService } from '../services/tag-aggregation.service';
import { requireAuth } from '../middleware/auth';
import { processedContents, rssEntries, sources } from '../db/schema';

const tagsRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 测试端点
tagsRoutes.get("/test", (c) => {
  return c.json({
    success: true,
    message: "标签API工作正常",
    timestamp: new Date().toISOString()
  });
});

// 临时测试端点 - 初始化标签聚合（不需要认证）
tagsRoutes.post("/test-initialize", async (c) => {
  const db = drizzle(c.env.DB);
  const testUserId = 1; // 使用我们创建的测试用户

  try {
    console.log(`开始为用户 ${testUserId} 初始化标签聚合`);
    
    // 获取用户所有已处理的内容
    const contents = await db
      .select({
        id: processedContents.id,
        entryId: processedContents.entryId,
        topics: processedContents.topics,
        keywords: processedContents.keywords,
      })
      .from(processedContents)
      .innerJoin(rssEntries, eq(processedContents.entryId, rssEntries.id))
      .innerJoin(sources, eq(rssEntries.sourceId, sources.id))
      .where(eq(sources.userId, testUserId))
      .where(
        or(isNotNull(processedContents.topics), isNotNull(processedContents.keywords))
      );

    console.log(`找到 ${contents.length} 个需要聚合的内容`);

    let successCount = 0;
    let errorCount = 0;

    for (const content of contents) {
      try {
        await tagAggregationService.processContentTags(content.id, db);
        successCount++;
        console.log(`成功处理内容 ID: ${content.id}`);
      } catch (error) {
        errorCount++;
        console.error(`处理内容 ID: ${content.id} 失败:`, error);
      }
    }

    return c.json({
      success: true,
      message: "标签聚合初始化完成",
      stats: {
        totalContents: contents.length,
        successCount,
        errorCount
      }
    });
  } catch (error) {
    console.error('标签聚合初始化失败:', error);
    return c.json({ 
      success: false, 
      error: "标签聚合初始化失败" 
    }, 500);
  }
});

// 临时测试端点 - 获取主题列表（不需要认证）
tagsRoutes.get("/test-topics", async (c) => {
  const db = drizzle(c.env.DB);
  const testUserId = 1; // 使用我们创建的测试用户

  try {
    const topics = await tagAggregationService.getUserTopics(testUserId, 50, 0, db);
    
    return c.json({
      success: true,
      data: topics,
      userId: testUserId
    });
  } catch (error) {
    console.error('获取用户主题失败:', error);
    return c.json({ 
      success: false, 
      error: "获取主题列表失败" 
    }, 500);
  }
});

// 临时测试端点 - 重新聚合指定内容（不需要认证）
tagsRoutes.post("/test-reaggregate/:processedContentId", async (c) => {
  const processedContentId = parseInt(c.req.param('processedContentId'));
  const db = drizzle(c.env.DB);

  if (isNaN(processedContentId)) {
    return c.json({ error: "无效的内容ID" }, 400);
  }

  try {
    await tagAggregationService.processContentTags(processedContentId, db);
    
    return c.json({
      success: true,
      message: "标签重新聚合完成",
      processedContentId
    });
  } catch (error) {
    console.error(`标签重新聚合失败: ${processedContentId}`, error);
    return c.json({ 
      success: false, 
      error: "标签重新聚合失败" 
    }, 500);
  }
});

// 获取用户的主题列表
tagsRoutes.get("/topics", requireAuth, async (c) => {
  const userId = c.get('user').id;
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const db = drizzle(c.env.DB);

  try {
    console.log(`[PARSE] 获取用户主题列表: userId=${userId}, limit=${limit}, offset=${offset}`);
    const topics = await tagAggregationService.getUserTopics(userId, limit, offset, db);
    console.log(`[SUCCESS] 成功获取主题列表: ${topics.length} 个主题`);
    
    return c.json({
      success: true,
      data: topics,
      pagination: {
        limit,
        offset,
        total: topics.length
      }
    });
  } catch (error) {
    console.error('[ERROR] 获取用户主题失败:', error);
    console.error('[ERROR] 错误详情:', {
      message: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      limit,
      offset
    });
    return c.json({ 
      success: false, 
      error: "获取主题列表失败",
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取用户的关键词列表
tagsRoutes.get("/keywords", requireAuth, async (c) => {
  const userId = c.get('user').id;
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  const db = drizzle(c.env.DB);

  try {
    const keywords = await tagAggregationService.getUserKeywords(userId, limit, offset, db);
    
    return c.json({
      success: true,
      data: keywords,
      pagination: {
        limit,
        offset,
        total: keywords.length
      }
    });
  } catch (error) {
    console.error('获取用户关键词失败:', error);
    return c.json({ 
      success: false, 
      error: "获取关键词列表失败" 
    }, 500);
  }
});

// 根据主题获取相关内容
tagsRoutes.get("/topics/:topicName/entries", requireAuth, async (c) => {
  const userId = c.get('user').id;
  const topicName = decodeURIComponent(c.req.param('topicName'));
  const limit = parseInt(c.req.query('limit') || '20');
  const page = parseInt(c.req.query('page') || '1');
  const offset = (page - 1) * limit;
  const db = drizzle(c.env.DB);

  try {
    const entries = await tagAggregationService.getEntriesByTopic(userId, topicName, limit, offset, db);
    
    return c.json({
      success: true,
      data: entries,
      topicName,
      pagination: {
        page,
        pageSize: limit,
        total: entries.length,
        totalPages: Math.ceil(entries.length / limit)
      }
    });
  } catch (error) {
    console.error(`根据主题获取内容失败: ${topicName}`, error);
    return c.json({ 
      success: false, 
      error: "获取主题相关内容失败" 
    }, 500);
  }
});

// 根据关键词获取相关内容
tagsRoutes.get("/keywords/:keywordName/entries", requireAuth, async (c) => {
  const userId = c.get('user').id;
  const keywordName = decodeURIComponent(c.req.param('keywordName'));
  const limit = parseInt(c.req.query('limit') || '20');
  const page = parseInt(c.req.query('page') || '1');
  const offset = (page - 1) * limit;
  const db = drizzle(c.env.DB);

  try {
    const entries = await tagAggregationService.getEntriesByKeyword(userId, keywordName, limit, offset, db);
    
    return c.json({
      success: true,
      data: entries,
      keywordName,
      pagination: {
        page,
        pageSize: limit,
        total: entries.length,
        totalPages: Math.ceil(entries.length / limit)
      }
    });
  } catch (error) {
    console.error(`根据关键词获取内容失败: ${keywordName}`, error);
    return c.json({ 
      success: false, 
      error: "获取关键词相关内容失败" 
    }, 500);
  }
});

// 搜索标签
tagsRoutes.get("/search", requireAuth, async (c) => {
  const userId = c.get('user').id;
  const query = c.req.query('q') || '';
  const type = (c.req.query('type') || 'all') as 'topics' | 'keywords' | 'all';
  const db = drizzle(c.env.DB);

  if (!query.trim()) {
    return c.json({ 
      success: false, 
      error: "搜索查询不能为空" 
    }, 400);
  }

  try {
    const results = await tagAggregationService.searchTags(userId, query, type, db);
    
    return c.json({
      success: true,
      data: results,
      query,
      type
    });
  } catch (error) {
    console.error(`搜索标签失败: ${query}`, error);
    return c.json({ 
      success: false, 
      error: "搜索标签失败" 
    }, 500);
  }
});

// 获取标签统计信息
tagsRoutes.get("/stats", requireAuth, async (c) => {
  const userId = c.get('user').id;
  const db = drizzle(c.env.DB);

  try {
    // 这里可以扩展获取更多统计信息
    const [topicsCount] = await tagAggregationService.getUserTopics(userId, 1000, 0, db);
    const [keywordsCount] = await tagAggregationService.getUserKeywords(userId, 1000, 0, db);
    
    const totalTopics = topicsCount.length;
    const totalKeywords = keywordsCount.length;
    
    const topTopics = topicsCount.slice(0, 10);
    const topKeywords = keywordsCount.slice(0, 10);
    
    return c.json({
      success: true,
      data: {
        totalTopics,
        totalKeywords,
        topTopics,
        topKeywords,
        totalTags: totalTopics + totalKeywords
      }
    });
  } catch (error) {
    console.error('获取标签统计失败:', error);
    return c.json({ 
      success: false, 
      error: "获取标签统计失败" 
    }, 500);
  }
});

// 手动触发标签重新聚合（用于测试和修复数据）
tagsRoutes.post("/reaggregate/:processedContentId", requireAuth, async (c) => {
  const userId = c.get('user').id;
  const processedContentId = parseInt(c.req.param('processedContentId'));
  const db = drizzle(c.env.DB);

  if (isNaN(processedContentId)) {
    return c.json({ error: "无效的内容ID" }, 400);
  }

  try {
    // 验证该内容是否属于当前用户
    // 这里需要添加权限检查逻辑
    
    await tagAggregationService.processContentTags(processedContentId, db);
    
    return c.json({
      success: true,
      message: "标签重新聚合完成",
      processedContentId
    });
  } catch (error) {
    console.error(`标签重新聚合失败: ${processedContentId}`, error);
    return c.json({ 
      success: false, 
      error: "标签重新聚合失败" 
    }, 500);
  }
});

// 批量初始化标签聚合（为现有数据创建标签聚合）
tagsRoutes.post("/initialize", requireAuth, async (c) => {
  const userId = c.get('user').id;
  const db = drizzle(c.env.DB);

  try {
    console.log(`开始为用户 ${userId} 初始化标签聚合`);
    
    // 获取用户所有已处理的内容
    const contents = await db
      .select({
        id: processedContents.id,
        entryId: processedContents.entryId,
        topics: processedContents.topics,
        keywords: processedContents.keywords,
      })
      .from(processedContents)
      .innerJoin(rssEntries, eq(processedContents.entryId, rssEntries.id))
      .innerJoin(sources, eq(rssEntries.sourceId, sources.id))
      .where(eq(sources.userId, userId))
      .where(
        or(isNotNull(processedContents.topics), isNotNull(processedContents.keywords))
      );

    console.log(`找到 ${contents.length} 个需要聚合的内容`);

    let successCount = 0;
    let errorCount = 0;

    for (const content of contents) {
      try {
        await tagAggregationService.processContentTags(content.id, db);
        successCount++;
        console.log(`成功处理内容 ID: ${content.id}`);
      } catch (error) {
        errorCount++;
        console.error(`处理内容 ID: ${content.id} 失败:`, error);
      }
    }

    return c.json({
      success: true,
      message: "标签聚合初始化完成",
      stats: {
        totalContents: contents.length,
        successCount,
        errorCount
      }
    });
  } catch (error) {
    console.error('标签聚合初始化失败:', error);
    return c.json({ 
      success: false, 
      error: "标签聚合初始化失败" 
    }, 500);
  }
});

export default tagsRoutes;