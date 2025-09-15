// src/routes/llm-extractor.ts
import { Hono } from "hono";
import { drizzle } from 'drizzle-orm/d1';
import { processedContents, rssEntries } from '../db/schema';
import { eq } from 'drizzle-orm';
import { UnifiedLLMService } from '../services/unified-llm.service';

const llmExtractorRoutes = new Hono();

// LLM智能内容提取器 - 使用统一LLM服务
llmExtractorRoutes.post("/extract", async (c) => {
  try {
    const body = await c.req.json();
    const { url, title, entryId } = body;
    
    if (!url || !title) {
      return c.json({ error: "请提供URL和标题" }, 400);
    }

    console.log(`开始统一LLM智能内容提取: ${url}`);
    const startTime = Date.now();
    
    // 1. 抓取网页HTML
    console.log('步骤1: 抓取网页HTML...');
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 30000,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const htmlContent = await response.text();
    console.log(`网页抓取完成，内容长度: ${htmlContent.length}`);
    
    // 2. 使用统一LLM服务提取所有信息
    console.log('步骤2: 使用统一LLM服务智能提取新闻信息...');
    
    const apiKey = c.env.ZHIPUAI_API_KEY;
    if (!apiKey) {
      return c.json({ error: "智谱AI API Key未配置" }, 500);
    }
    
    const analysisResult = await UnifiedLLMService.analyzeContent({
      title,
      content: htmlContent,
      link: url,
      isHtml: true,
      apiKey: apiKey
    });
    
    // 3. 如果提供了entryId，保存到数据库
    if (entryId) {
      console.log('步骤3: 保存提取结果到数据库...');
      await saveExtractedContentToDB(c.env.DB, entryId, analysisResult, title);
    }
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    console.log(`统一LLM智能内容提取完成，总耗时: ${processingTime}ms`);
    
    return c.json({
      success: true,
      message: "统一LLM智能内容提取成功",
      data: {
        url,
        title: title,
        content: analysisResult.extractedContent || htmlContent,
        contentPreview: (analysisResult.extractedContent || htmlContent).substring(0, 300) + ((analysisResult.extractedContent || htmlContent).length > 300 ? '...' : ''),
        summary: analysisResult.analysis,
        topics: analysisResult.topics,
        keywords: analysisResult.keywords,
        sentiment: analysisResult.sentiment,
        educationalValue: analysisResult.educationalValue,
        wordCount: (analysisResult.extractedContent || htmlContent).length,
        processingTime,
        modelUsed: analysisResult.modelUsed
      }
    });
    
  } catch (error) {
    console.error('统一LLM智能内容提取失败:', error);
    return c.json({ 
      error: "统一LLM智能内容提取失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 测试指定URL的LLM内容提取
llmExtractorRoutes.post("/test-url", async (c) => {
  const testUrl = "http://www.chinanews.com/hr/2025/09-07/10477972.shtml";
  const testTitle = "纪念中国人民抗日战争暨世界反法西斯战争胜利80周年图片展暨电影周在比利时揭幕";
  
  try {
    console.log(`测试统一LLM内容提取: ${testUrl}`);
    
    return c.json({
      success: true,
      message: "统一LLM内容提取测试",
      test: {
        url: testUrl,
        title: testTitle,
        description: "请使用 /extract 端点进行实际的内容提取"
      }
    });
    
  } catch (error) {
    console.error('统一LLM内容提取测试失败:', error);
    return c.json({
      success: false,
      message: "统一LLM内容提取测试失败",
      error: error.message
    }, 500);
  }
});

// 保存提取的内容到数据库
async function saveExtractedContentToDB(db: any, entryId: number, result: any, title: string): Promise<void> {
  try {
    const drizzleDb = drizzle(db);
    const topicsJson = JSON.stringify(result.topics || []);
    const keywordsString = result.keywords ? result.keywords.join(',') : '';
    
    // 检查是否已存在 processed_content 记录
    const existingRecord = await drizzleDb.select()
      .from(processedContents)
      .where(eq(processedContents.entryId, entryId))
      .get();
    
    const finalContent = result.extractedContent || result.analysis;
    
    if (existingRecord) {
      // 更新现有记录
      await drizzleDb.update(processedContents)
        .set({
          markdownContent: finalContent,
          summary: result.analysis || '',
          topics: topicsJson,
          keywords: keywordsString,
          sentiment: result.sentiment || 'neutral',
          analysis: result.analysis || '',
          educationalValue: result.educationalValue || '',
          processingTime: result.processingTime || 0,
          modelUsed: result.modelUsed || 'glm-4.5-flash'
        })
        .where(eq(processedContents.entryId, entryId));
      console.log(`更新现有processed_content记录，条目ID: ${entryId}`);
    } else {
      // 创建新记录
      await drizzleDb.insert(processedContents)
        .values({
          entryId: entryId,
          summary: result.analysis || '',
          markdownContent: finalContent,
          topics: topicsJson,
          keywords: keywordsString,
          sentiment: result.sentiment || 'neutral',
          analysis: result.analysis || '',
          educationalValue: result.educationalValue || '',
          processingTime: result.processingTime || 0,
          modelUsed: result.modelUsed || 'glm-4.5-flash',
          createdAt: new Date()
        });
      console.log(`创建新processed_content记录，条目ID: ${entryId}`);
    }
    
    // 更新 rss_entries 表的处理状态
    await drizzleDb.update(rssEntries)
      .set({
        processed: true,
        processedAt: new Date(),
        failureCount: 0,
        errorMessage: null
      })
      .where(eq(rssEntries.id, entryId));
    
    console.log(`统一LLM提取内容已保存到数据库，条目ID: ${entryId}，主题: ${result.topics?.join(', ') || '无'}，状态已更新为已处理`);
  } catch (error) {
    console.error('保存统一LLM提取内容到数据库失败:', error);
    throw error;
  }
}

// 为已有条目进行AI内容提取（带状态更新）
llmExtractorRoutes.post("/extract-entry/:entryId", async (c) => {
  try {
    const entryId = parseInt(c.req.param('entryId'));
    
    if (isNaN(entryId)) {
      return c.json({ error: "无效的条目ID" }, 400);
    }

    const body = await c.req.json();
    const { url, title } = body;
    
    if (!url || !title) {
      return c.json({ error: "请提供URL和标题" }, 400);
    }

    console.log(`开始为条目 ${entryId} 进行统一LLM内容提取: ${url}`);
    const startTime = Date.now();
    
    // 1. 抓取网页HTML
    console.log('步骤1: 抓取网页HTML...');
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 30000,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const htmlContent = await response.text();
    console.log(`网页抓取完成，内容长度: ${htmlContent.length}`);
    
    // 2. 使用统一LLM服务提取所有信息
    console.log('步骤2: 使用统一LLM服务智能提取新闻信息...');
    
    const apiKey = c.env.ZHIPUAI_API_KEY;
    if (!apiKey) {
      return c.json({ error: "智谱AI API Key未配置" }, 500);
    }
    
    const analysisResult = await UnifiedLLMService.analyzeContent({
      title,
      content: htmlContent,
      link: url,
      isHtml: true,
      apiKey: apiKey
    });
    
    // 3. 保存到数据库并更新状态
    console.log('步骤3: 保存提取结果到数据库...');
    await saveExtractedContentToDB(c.env.DB, entryId, analysisResult, title);
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    console.log(`条目 ${entryId} 统一LLM内容提取完成，总耗时: ${processingTime}ms`);
    
    return c.json({
      success: true,
      message: `条目 ${entryId} 统一LLM内容提取成功`,
      data: {
        entryId,
        url,
        title: title,
        content: analysisResult.extractedContent || htmlContent,
        contentPreview: (analysisResult.extractedContent || htmlContent).substring(0, 300) + ((analysisResult.extractedContent || htmlContent).length > 300 ? '...' : ''),
        summary: analysisResult.analysis,
        topics: analysisResult.topics,
        keywords: analysisResult.keywords,
        sentiment: analysisResult.sentiment,
        educationalValue: analysisResult.educationalValue,
        wordCount: (analysisResult.extractedContent || htmlContent).length,
        processingTime,
        modelUsed: analysisResult.modelUsed,
        processed: true
      }
    });
    
  } catch (error) {
    console.error('条目统一LLM内容提取失败:', error);
    return c.json({ 
      error: "条目统一LLM内容提取失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default llmExtractorRoutes;