import { Hono } from "hono";
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, processedContents } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { UnifiedLLMService } from '../services/unified-llm.service';
import { tagAggregationService } from '../services/tag-aggregation.service';

const reprocessRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// AI重新处理内容 - 使用统一LLM服务 (RESTful风格)
reprocessRoutes.post("/:id/reprocess", async (c) => {
  const entryId = parseInt(c.req.param('id'));
  
  if (isNaN(entryId)) {
    return c.json({ error: "Invalid content ID" }, 400);
  }

  const db = drizzle(c.env.DB);
  
  try {
    console.log('[PROCESS] Starting AI reprocessing, entry ID: ' + entryId);

    // 获取RSS条目信息
    const rssEntry = await db
      .select()
      .from(rssEntries)
      .where(eq(rssEntries.id, entryId))
      .get();

    if (!rssEntry) {
      return c.json({ error: "Content entry not found" }, 404);
    }

    console.log(`Found RSS entry: ${rssEntry.title}`);

    let contentForAnalysis = rssEntry.content;
    let webContentFetched = false;

    // 如果有链接, 先尝试抓取完整的网页内容
    if (rssEntry.link) {
      try {
        console.log(`[WEB] Attempting to fetch full web content: ${rssEntry.link}`);
        
        const response = await fetch(rssEntry.link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        console.log(`[SUCCESS] Web fetch successful, HTML length: ${html.length} chars`);
        console.log(`[CONTENT] Original HTML first 500 chars: ${html.substring(0, 500)}`);
        
        contentForAnalysis = html;
        webContentFetched = true;
        
        console.log(`[SUCCESS] Using original HTML for AI analysis, length: ${contentForAnalysis.length} chars`);
        
      } catch (webError) {
        console.error(`[ERROR] Web content fetch failed, using RSS original content:`, webError);
        console.log(`[CONTENT] will use RSS original content, length: ${rssEntry.content.length} chars`);
      }
    } else {
      console.log(`[WARN]  RSS entry has no link, will use RSS original content`);
    }

    // 检查API Key
    const apiKey = c.env.ZHIPUAI_API_KEY;
    if (!apiKey) {
      return c.json({ error: "ZhipuAI API Key not configured" }, 500);
    }

    // 使用统一LLM服务进行分析
    console.log(`=== Starting unified LLM analysis, entry ID: ${entryId} ===`);
    const result = await UnifiedLLMService.analyzeAndSave({
      entryId: entryId,
      title: rssEntry.title,
      content: contentForAnalysis,
      link: rssEntry.link,
      isHtml: webContentFetched,
      apiKey: apiKey,
      db: db,
      env: c.env
    });

    console.log(`[SUCCESS] AI reanalysis completed for entry ${entryId}`);

    // 更新条目状态为已处理
    await db
      .update(rssEntries)
      .set({
        processed: true,
        processedAt: new Date()
      })
      .where(eq(rssEntries.id, entryId));

    console.log(`[SUCCESS] Entry ${entryId} status updated to processed`);

    return c.json({
      success: true,
      message: "AI reanalysis successful",
      data: {
        entryId: entryId,
        topics: result.topics,
        keywords: result.keywords,
        sentiment: result.sentiment,
        analysis: result.analysis,
        educationalValue: result.educationalValue,
        extractedContent: result.extractedContent,
        processingTime: result.processingTime,
        modelUsed: result.modelUsed,
        wordCounts: result.wordCounts
      }
    });

  } catch (error) {
    console.error('AI reprocessing failed:', error);
    
    // 更新失败状态
    await db
      .update(rssEntries)
      .set({
        processed: false,
        failureCount: sql`failure_count + 1`,
        errorMessage: error instanceof Error ? error.message : '未知错误'
      })
      .where(eq(rssEntries.id, entryId));

    return c.json({
      success: false,
      error: 'AI reprocessing failed', 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// AI重新处理内容 - 使用统一LLM服务 (向后兼容)
reprocessRoutes.post("/", async (c) => {
  // 尝试从查询参数获取ID
  const entryId = parseInt(c.req.query('id') || '');
  
  // 如果查询参数没有ID, 尝试从请求体获取
  let bodyEntryId;
  try {
    const body = await c.req.json();
    bodyEntryId = body.id;
  } catch (e) {
    // 如果解析JSON失败, 忽略错误
  }
  
  const finalEntryId = entryId || bodyEntryId;
  
  if (isNaN(finalEntryId)) {
    return c.json({ error: "Invalid content ID" }, 400);
  }

  const db = drizzle(c.env.DB);
  
  try {
    console.log('[PROCESS] Starting AI reprocessing, entry ID: ' + finalEntryId);

    // 获取RSS条目信息
    const rssEntry = await db
      .select()
      .from(rssEntries)
      .where(eq(rssEntries.id, finalEntryId))
      .get();

    if (!rssEntry) {
      return c.json({ error: "Content entry not found" }, 404);
    }

    console.log(`Found RSS entry: ${rssEntry.title}`);

    let contentForAnalysis = rssEntry.content;
    let webContentFetched = false;

    // 如果有链接, 先尝试抓取完整的网页内容
    if (rssEntry.link) {
      try {
        console.log(`[WEB] Attempting to fetch full web content: ${rssEntry.link}`);
        
        const response = await fetch(rssEntry.link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        console.log(`[SUCCESS] Web fetch successful, HTML length: ${html.length} chars`);
        console.log(`[CONTENT] Original HTML first 500 chars: ${html.substring(0, 500)}`);
        
        contentForAnalysis = html;
        webContentFetched = true;
        
        console.log(`[SUCCESS] Using original HTML for AI analysis, length: ${contentForAnalysis.length} chars`);
        
      } catch (webError) {
        console.error(`[ERROR] Web content fetch failed, using RSS original content:`, webError);
        console.log(`[CONTENT] will use RSS original content, length: ${rssEntry.content.length} chars`);
      }
    } else {
      console.log(`[WARN]  RSS entry has no link, will use RSS original content`);
    }

    // 检查API Key
    const apiKey = c.env.ZHIPUAI_API_KEY;
    if (!apiKey) {
      return c.json({ error: "ZhipuAI API Key not configured" }, 500);
    }

    // 使用统一LLM服务进行分析
    console.log(`=== Starting unified LLM analysis, entry ID: ${finalEntryId} ===`);
    const result = await UnifiedLLMService.analyzeAndSave({
      entryId: finalEntryId,
      title: rssEntry.title,
      content: contentForAnalysis,
      link: rssEntry.link,
      isHtml: webContentFetched,
      apiKey: apiKey,
      db: db,
      env: c.env
    });

    console.log(`[SUCCESS] AI reanalysis completed for entry ${finalEntryId}`);

    // 更新条目状态为已处理
    await db
      .update(rssEntries)
      .set({
        processed: true,
        processedAt: new Date()
      })
      .where(eq(rssEntries.id, finalEntryId));

    console.log(`[SUCCESS] Entry ${finalEntryId} status updated to processed`);

    return c.json({
      success: true,
      message: "AI reanalysis successful",
      data: {
        entryId: finalEntryId,
        topics: result.topics,
        keywords: result.keywords,
        sentiment: result.sentiment,
        analysis: result.analysis,
        educationalValue: result.educationalValue,
        extractedContent: result.extractedContent,
        processingTime: result.processingTime,
        modelUsed: result.modelUsed,
        wordCounts: result.wordCounts
      }
    });

  } catch (error) {
    console.error('AI reprocessing failed:', error);
    
    // 更新失败状态
    await db
      .update(rssEntries)
      .set({
        processed: false,
        failureCount: sql`failure_count + 1`,
        errorMessage: error instanceof Error ? error.message : '未知错误'
      })
      .where(eq(rssEntries.id, finalEntryId));

    return c.json({
      success: false,
      error: 'AI reprocessing failed',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default reprocessRoutes;