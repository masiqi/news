// src/routes/web-content.ts
import { Hono } from "hono";
import { WebContentService, ParsedNewsContent } from "../services/web-content.service";
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries } from '../db/schema';
import { eq } from 'drizzle-orm';

const webContentRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// 获取单个条目的网页内容
webContentRoutes.get("/fetch/:entryId", async (c) => {
  const entryId = parseInt(c.req.param('entryId'));
  
  if (isNaN(entryId)) {
    return c.json({ error: "无效的条目ID" }, 400);
  }

  const db = drizzle(c.env.DB);
  
  try {
    // 获取RSS条目信息
    const entry = await db.select()
      .from(rssEntries)
      .where(eq(rssEntries.id, entryId))
      .get();
    
    if (!entry) {
      return c.json({ error: "条目不存在" }, 404);
    }

    if (!entry.link) {
      return c.json({ error: "该条目没有链接地址" }, 400);
    }

    console.log(`开始抓取条目 ${entryId} 的网页内容: ${entry.link}`);

    // 创建网页内容服务
    const webContentService = new WebContentService(c.env.DB);
    
    // 抓取并解析网页内容
    const parsedContent = await webContentService.fetchAndParseWebContent(entryId, entry.link);
    
    return c.json({
      success: true,
      data: {
        entryId,
        title: entry.title,
        url: entry.link,
        webContent: parsedContent
      }
    });
  } catch (error) {
    console.error('网页内容抓取失败:', error);
    return c.json({ 
      error: "网页内容抓取失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 批量获取条目的网页内容
webContentRoutes.post("/batch-fetch", async (c) => {
  const body = await c.req.json();
  const { entryIds, limit = 10 } = body;
  
  if (!Array.isArray(entryIds) || entryIds.length === 0) {
    return c.json({ error: "请提供有效的条目ID数组" }, 400);
  }

  if (entryIds.length > limit) {
    return c.json({ error: `条目数量不能超过 ${limit}` }, 400);
  }

  const db = drizzle(c.env.DB);
  
  try {
    // 获取RSS条目信息
    const entries = await db.select()
      .from(rssEntries)
      .where(eq(rssEntries.id, entryIds))
      .all();
    
    if (entries.length === 0) {
      return c.json({ 
        success: true, 
        message: "没有找到指定的条目", 
        results: [] 
      });
    }

    // 过滤掉没有链接的条目
    const validEntries = entries.filter(entry => entry.link);
    
    if (validEntries.length === 0) {
      return c.json({ 
        success: true, 
        message: "指定的条目都没有有效的链接地址", 
        results: [] 
      });
    }

    console.log(`开始批量抓取 ${validEntries.length} 个条目的网页内容`);

    // 创建网页内容服务
    const webContentService = new WebContentService(c.env.DB);
    
    const results: Array<{
      entryId: number;
      title: string;
      url: string;
      success: boolean;
      webContent?: ParsedNewsContent;
      error?: string;
    }> = [];
    
    // 逐个处理条目
    for (const entry of validEntries) {
      try {
        console.log(`正在处理条目 ${entry.id}: ${entry.link}`);
        
        const webContent = await webContentService.fetchAndParseWebContent(entry.id, entry.link);
        
        results.push({
          entryId: entry.id,
          title: entry.title,
          url: entry.link,
          success: true,
          webContent
        });
        
        // 添加小延迟避免过于频繁的请求
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`条目 ${entry.id} 网页抓取失败:`, error);
        
        results.push({
          entryId: entry.id,
          title: entry.title,
          url: entry.link,
          success: false,
          error: error instanceof Error ? error.message : '抓取失败'
        });
      }
    }
    
    // 统计结果
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    return c.json({
      success: true,
      message: `批量网页内容抓取完成`,
      stats: {
        total: results.length,
        success: successCount,
        failure: failureCount,
        successRate: (successCount / results.length * 100).toFixed(2) + '%'
      },
      results
    });
  } catch (error) {
    console.error('批量网页内容抓取失败:', error);
    return c.json({ 
      error: "批量网页内容抓取失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取已保存的网页内容
webContentRoutes.get("/:entryId", async (c) => {
  const entryId = parseInt(c.req.param('entryId'));
  
  if (isNaN(entryId)) {
    return c.json({ error: "无效的条目ID" }, 400);
  }

  const webContentService = new WebContentService(c.env.DB);
  
  try {
    const webContent = await webContentService.getWebContent(entryId);
    
    if (!webContent) {
      return c.json({ error: "网页内容不存在" }, 404);
    }
    
    return c.json({
      success: true,
      data: {
        entryId,
        ...webContent
      }
    });
  } catch (error) {
    console.error('获取网页内容失败:', error);
    return c.json({ 
      error: "获取网页内容失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取网页内容统计
webContentRoutes.get("/stats", async (c) => {
  const db = drizzle(c.env.DB);
  
  try {
    // 获取基本的网页内容统计
    const stats = await db.select({
        totalEntries: { sql: 'COUNT(*)' },
        withWebContent: { sql: 'COUNT(CASE WHEN markdown_content IS NOT NULL AND markdown_content != "" THEN 1 END)' },
        withoutWebContent: { sql: 'COUNT(CASE WHEN markdown_content IS NULL OR markdown_content = "" THEN 1 END)' },
        avgWordCount: { sql: 'AVG(CASE WHEN word_count > 0 THEN word_count ELSE NULL END)' },
        maxWordCount: { sql: 'MAX(word_count)' },
        minWordCount: { sql: 'MIN(word_count)' }
      })
      .from(rssEntries)
      .innerJoin(processedContents, eq(rssEntries.id, processedContents.entryId))
      .all();

    return c.json({
      success: true,
      data: {
        stats: stats[0] || {},
        insights: {
          contentCoverage: stats[0] ? ((stats[0].withWebContent / stats[0].totalEntries * 100)).toFixed(2) + '%' : '0%',
          avgContentLength: stats[0] && stats[0].avgWordCount ? Math.round(stats[0].avgWordCount) : 0,
          contentLengthDistribution: {
            short: stats[0] && stats[0].totalEntries ? Math.round(stats[0].totalEntries * 0.2) : 0, // 20%
            medium: stats[0] && stats[0].totalEntries ? Math.round(stats[0].totalEntries * 0.6) : 0, // 60%
            long: stats[0] && stats[0].totalEntries ? Math.round(stats[0].totalEntries * 0.2) : 0 // 20%
          }
        }
      }
    });
  } catch (error) {
    console.error('获取网页内容统计失败:', error);
    return c.json({ 
      error: "获取网页内容统计失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default webContentRoutes;