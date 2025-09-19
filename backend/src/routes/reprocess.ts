import { Hono } from "hono";
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, processedContents } from '../db/schema';
import { eq } from 'drizzle-orm';
import { UnifiedLLMService } from '../services/unified-llm.service';
import { tagAggregationService } from '../services/tag-aggregation.service';

const reprocessRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// AI重新处理内容 - 使用统一LLM服务
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

    console.log(`[SUCCESS] Unified LLM reprocessing completed, entry ID: ${finalEntryId}`);

    // 触发标签聚合处理
    try {
      console.log(`[TAG] Starting tag aggregation processing, entry ID: ${finalEntryId}`);
      
      // 获取刚创建或更新的processed_contents记录
      const processedRecord = await db
        .select({ id: processedContents.id })
        .from(processedContents)
        .where(eq(processedContents.entryId, finalEntryId))
        .limit(1)
        .get();
      
      if (processedRecord) {
        await tagAggregationService.processContentTags(processedRecord.id, db);
        console.log(`[SUCCESS] Tag aggregation processing completed, processedContentId: ${processedRecord.id}`);
      }
      
    } catch (tagError) {
      console.error('[ERROR] tag aggregation processing failed:', tagError);
      // 标签聚合失败不影响主要功能, 只记录错误
    }

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
        wordCounts: result.wordCounts // new word count stats
      }
    });

  } catch (error) {
    console.error('AI reprocessing failed, entry ID:', finalEntryId, 'error:', error);
    
    // 更新失败状态
    try {
      // 先获取当前失败次数
      const currentEntry = await db
        .select({ failureCount: rssEntries.failureCount })
        .from(rssEntries)
        .where(eq(rssEntries.id, finalEntryId))
        .get();
      
      const newFailureCount = (currentEntry?.failureCount || 0) + 1;
      
      await db.update(rssEntries)
        .set({
          failureCount: newFailureCount,
          errorMessage: error instanceof Error ? error.message : 'AI reprocessing failed',
          processedAt: new Date()
        })
        .where(eq(rssEntries.id, finalEntryId));
    } catch (updateError) {
      console.error('Failed to update failure status:', updateError);
    }
    
    return c.json({ 
      error: "AI reprocessing failed", 
      details: error instanceof Error ? error.message : 'unknown error'
    }, 500);
  }
});

export default reprocessRoutes;
