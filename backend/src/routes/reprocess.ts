import { Hono } from "hono";
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, processedContents } from '../db/schema';
import { eq } from 'drizzle-orm';
import { UnifiedLLMService } from '../services/unified-llm.service';
import { tagAggregationService } from '../services/tag-aggregation.service';

const reprocessRoutes = new Hono<{ Bindings: CloudflareBindings }>();

// AI重新处理内容 - 使用统一LLM服务
reprocessRoutes.post("/", async (c) => {
  const entryId = parseInt(c.req.query('id'));
  
  if (isNaN(entryId)) {
    return c.json({ error: "无效的内容ID" }, 400);
  }

  const db = drizzle(c.env.DB);
  
  try {
    console.log(`开始AI重新处理内容，条目ID: ${entryId}`);

    // 获取RSS条目信息
    const rssEntry = await db
      .select()
      .from(rssEntries)
      .where(eq(rssEntries.id, entryId))
      .get();

    if (!rssEntry) {
      return c.json({ error: "内容条目不存在" }, 404);
    }

    console.log(`找到RSS条目: ${rssEntry.title}`);

    let contentForAnalysis = rssEntry.content;
    let webContentFetched = false;

    // 如果有链接，先尝试抓取完整的网页内容
    if (rssEntry.link) {
      try {
        console.log(`🌐 尝试抓取完整网页内容: ${rssEntry.link}`);
        
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
        console.log(`✅ 网页抓取成功，HTML长度: ${html.length} 字符`);
        console.log(`📄 原始HTML前500字符: ${html.substring(0, 500)}`);
        
        contentForAnalysis = html;
        webContentFetched = true;
        
        console.log(`✅ 使用原始HTML进行AI分析，长度: ${contentForAnalysis.length} 字符`);
        
      } catch (webError) {
        console.error(`❌ 网页内容抓取失败，将使用RSS原始内容:`, webError);
        console.log(`📄 将使用RSS原始内容，长度: ${rssEntry.content.length} 字符`);
      }
    } else {
      console.log(`⚠️  RSS条目没有链接，将使用RSS原始内容`);
    }

    // 检查API Key
    const apiKey = c.env.ZHIPUAI_API_KEY;
    if (!apiKey) {
      return c.json({ error: "智谱AI API Key未配置" }, 500);
    }

    // 使用统一LLM服务进行分析
    console.log(`=== 开始统一LLM分析，条目ID: ${entryId} ===`);
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

    console.log(`🎉 统一LLM重新处理完成，条目ID: ${entryId}`);

    // 触发标签聚合处理
    try {
      console.log(`🏷️ 开始标签聚合处理，条目ID: ${entryId}`);
      
      // 获取刚创建或更新的processed_contents记录
      const processedRecord = await db
        .select({ id: processedContents.id })
        .from(processedContents)
        .where(eq(processedContents.entryId, entryId))
        .limit(1)
        .get();
      
      if (processedRecord) {
        await tagAggregationService.processContentTags(processedRecord.id, db);
        console.log(`✅ 标签聚合处理完成，processedContentId: ${processedRecord.id}`);
      }
      
    } catch (tagError) {
      console.error('❌ 标签聚合处理失败:', tagError);
      // 标签聚合失败不影响主要功能，只记录错误
    }

    return c.json({
      success: true,
      message: "AI重新分析成功",
      data: {
        entryId,
        topics: result.topics,
        keywords: result.keywords,
        sentiment: result.sentiment,
        analysis: result.analysis,
        educationalValue: result.educationalValue,
        extractedContent: result.extractedContent,
        processingTime: result.processingTime,
        modelUsed: result.modelUsed,
        wordCounts: result.wordCounts // 新增字数统计
      }
    });

  } catch (error) {
    console.error('AI重新处理失败，条目ID:', entryId, '错误:', error);
    
    // 更新失败状态
    try {
      // 先获取当前失败次数
      const currentEntry = await db
        .select({ failureCount: rssEntries.failureCount })
        .from(rssEntries)
        .where(eq(rssEntries.id, entryId))
        .get();
      
      const newFailureCount = (currentEntry?.failureCount || 0) + 1;
      
      await db.update(rssEntries)
        .set({
          failureCount: newFailureCount,
          errorMessage: error instanceof Error ? error.message : 'AI重新处理失败',
          processedAt: new Date()
        })
        .where(eq(rssEntries.id, entryId));
    } catch (updateError) {
      console.error('更新失败状态也失败:', updateError);
    }
    
    return c.json({ 
      error: "AI重新处理失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default reprocessRoutes;
