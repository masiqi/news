// src/routes/llm-extractor.ts
import { Hono } from "hono";
import { drizzle } from 'drizzle-orm/d1';
import { processedContents, rssEntries } from '../db/schema';
import { eq, insert } from 'drizzle-orm';

const llmExtractorRoutes = new Hono();

// LLM智能内容提取器 - 使用智谱AI
llmExtractorRoutes.post("/extract", async (c) => {
  try {
    const body = await c.req.json();
    const { url, title, entryId } = body;
    
    if (!url || !title) {
      return c.json({ error: "请提供URL和标题" }, 400);
    }

    console.log(`开始LLM智能内容提取: ${url}`);
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
    
    // 2. 使用LLM提取所有信息
    console.log('步骤2: 使用智谱GLM-4.5-Flash智能提取新闻信息...');
    const extractedContent = await extractContentWithLLM(htmlContent, title);
    
    // 3. 如果提供了entryId，保存到数据库
    if (entryId) {
      console.log('步骤3: 保存提取结果到数据库...');
      await saveExtractedContentToDB(c.env.DB, entryId, extractedContent);
    }
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    console.log(`LLM智能内容提取完成，总耗时: ${processingTime}ms`);
    
    return c.json({
      success: true,
      message: "LLM智能内容提取成功",
      data: {
        url,
        title: extractedContent.title,
        content: extractedContent.content,
        contentPreview: extractedContent.content.substring(0, 300) + (extractedContent.content.length > 300 ? '...' : ''),
        summary: extractedContent.summary,
        topics: extractedContent.topics,
        keywords: extractedContent.keywords,
        publishTime: extractedContent.publishTime,
        author: extractedContent.author,
        source: extractedContent.source,
        wordCount: extractedContent.wordCount,
        processingTime,
        modelUsed: "glm-4.5-flash"
      }
    });
    
  } catch (error) {
    console.error('LLM智能内容提取失败:', error);
    return c.json({ 
      error: "LLM智能内容提取失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 测试指定URL的LLM内容提取
llmExtractorRoutes.post("/test-url", async (c) => {
  const testUrl = "http://www.chinanews.com/hr/2025/09-07/10477972.shtml";
  const testTitle = "纪念中国人民抗日战争暨世界反法西斯战争胜利80周年图片展暨电影周在比利时揭幕";
  
  try {
    console.log(`测试LLM内容提取: ${testUrl}`);
    
    return c.json({
      success: true,
      message: "LLM内容提取测试",
      test: {
        url: testUrl,
        title: testTitle,
        description: "请使用 /extract 端点进行实际的内容提取"
      }
    });
    
  } catch (error) {
    console.error('LLM内容提取测试失败:', error);
    return c.json({
      success: false,
      message: "LLM内容提取测试失败",
      error: error.message
    }, 500);
  }
});

// 使用LLM从HTML中提取新闻内容（智谱AI版本）
async function extractContentWithLLM(html: string, title: string) {
  const extractionPrompt = `请从以下HTML网页中提取新闻信息并进行智能分析：

网页标题：${title}

HTML内容：
${html}

请提取以下信息并以JSON格式返回：
1. 新闻标题
2. 新闻正文内容（纯文本，去除HTML标签）
3. 新闻摘要（1-2句话）
4. 新闻发布时间（如果存在）
5. 作者（如果存在）
6. 新闻来源（如果存在）
7. 图片URL列表（从HTML中提取）
8. 相关链接列表（从HTML中提取）
9. 3-5个主题标签
10. 5-8个关键词
11. 正文字数
12. 新闻分析解读（包括事件背景、影响、意义等）
13. 教育价值（对高中生的学习价值，如知识点、思维能力培养、社会认知等）

返回格式：
{
  "title": "新闻标题",
  "content": "新闻正文内容",
  "summary": "新闻摘要",
  "publishTime": "发布时间",
  "author": "作者",
  "source": "来源",
  "images": ["图片URL1", "图片URL2"],
  "links": ["相关链接1", "相关链接2"],
  "topics": ["主题1", "主题2", "主题3"],
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "wordCount": 字数,
  "analysis": "新闻分析解读内容",
  "educationalValue": "教育价值说明"
}`;

  console.log('调用智谱GLM-4.5-Flash进行内容提取...');
  
  const chatCompletionRequest = {
    model: "glm-4.5-flash",
    messages: [
      {
        role: "system",
        content: "你是一个专业的新闻内容分析师，擅长从网页HTML中提取新闻信息。请严格按照JSON格式返回提取的信息。"
      },
      {
        role: "user",
        content: extractionPrompt
      }
    ],
    temperature: 0.6,
    max_tokens: 12000,
    stream: false,
    response_format: { "type": "json_object" }
  };

  console.log('智谱AI请求:', JSON.stringify(chatCompletionRequest, null, 2));
  
  const apiKey = process.env.ZHIPUAI_API_KEY || 'bcf6e4bffd884f189a367a079d32cf18.IZyzJGFB6f66qjK9';
  console.log('智谱AI API Key:', apiKey ? '已配置' : '未配置，使用默认值');
  
  if (!apiKey) {
    throw new Error('智谱AI API Key未配置');
  }
  
  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(chatCompletionRequest)
  });

  if (!response.ok) {
    throw new Error(`智谱AI调用失败: HTTP ${response.status} - ${response.statusText}`);
  }

  const result = await response.json();
  console.log('智谱AI响应:', JSON.stringify(result, null, 2));
  
  if (!result.choices || !result.choices[0] || !result.choices[0].message) {
    throw new Error('智谱AI响应格式不正确');
  }
  
  const responseContent = result.choices[0].message.content;
  console.log(`智谱AI响应内容长度: ${responseContent.length}`);
  
  try {
    console.log('智谱AI原始响应内容:');
    console.log(responseContent);
    
    // 使用response_format: {"type": "json_object"}后，响应应该是纯JSON
    try {
      const parsed = JSON.parse(responseContent);
      console.log('JSON解析成功:', parsed);
      
      return {
        title: parsed.title || title,
        content: parsed.content || '',
        summary: parsed.summary || '',
        publishTime: parsed.publishTime || '',
        author: parsed.author || '',
        source: parsed.source || '',
        images: Array.isArray(parsed.images) ? parsed.images.slice(0, 10) : [],
        links: Array.isArray(parsed.links) ? parsed.links.slice(0, 10) : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 5) : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10) : [],
        wordCount: parsed.wordCount || 0,
        analysis: parsed.analysis || '',
        educationalValue: parsed.educationalValue || ''
      };
    } catch (parseError) {
      console.error('JSON解析失败:', parseError);
      console.log('尝试解析的响应内容:', responseContent);
      throw parseError;
    }
  } catch (error) {
    console.error('解析智谱AI响应失败:', error);
    // 如果解析失败，返回默认内容
    return {
      title: title,
      content: responseContent.substring(0, 1500),
      summary: '',
      publishTime: '',
      author: '',
      source: '',
      images: [],
      links: [],
      topics: ["新闻主题"],
      keywords: ["新闻", "事件"],
      wordCount: responseContent.substring(0, 1500).length,
      analysis: '',
      educationalValue: ''
    };
  }
}

// 保存提取的内容到数据库
async function saveExtractedContentToDB(db: any, entryId: number, content: any): Promise<void> {
  try {
    const drizzleDb = drizzle(db);
    const topicsJson = JSON.stringify(content.topics || []);
    const keywordsString = content.keywords ? content.keywords.join(',') : '';
    const imagesJson = JSON.stringify(content.images || []);
    const linksJson = JSON.stringify(content.links || []);
    
    // 检查是否已存在 processed_content 记录
    const existingRecord = await drizzleDb.select()
      .from(processedContents)
      .where(eq(processedContents.entryId, entryId))
      .get();
    
    if (existingRecord) {
      // 更新现有记录
      await drizzleDb.update(processedContents)
        .set({
          markdownContent: content.content,
          summary: content.summary || '',
          topics: topicsJson,
          keywords: keywordsString,
          images: imagesJson,
          links: linksJson,
          author: content.author || '',
          source: content.source || '',
          publishTime: content.publishTime || '',
          analysis: content.analysis || '',
          educationalValue: content.educationalValue || '',
          wordCount: content.wordCount || 0,
          modelUsed: 'glm-4.5-flash',
          processingTime: content.processingTime || 0
        })
        .where(eq(processedContents.entryId, entryId));
      console.log(`更新现有processed_content记录，条目ID: ${entryId}`);
    } else {
      // 创建新记录
      await drizzleDb.insert(processedContents)
        .values({
          entryId: entryId,
          summary: content.summary || '',
          markdownContent: content.content,
          topics: topicsJson,
          keywords: keywordsString,
          images: imagesJson,
          links: linksJson,
          author: content.author || '',
          source: content.source || '',
          publishTime: content.publishTime || '',
          analysis: content.analysis || '',
          educationalValue: content.educationalValue || '',
          wordCount: content.wordCount || 0,
          modelUsed: 'glm-4.5-flash',
          processingTime: content.processingTime || 0,
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
    
    console.log(`LLM提取内容已保存到数据库，条目ID: ${entryId}，主题: ${content.topics?.join(', ') || '无'}，状态已更新为已处理`);
  } catch (error) {
    console.error('保存LLM提取内容到数据库失败:', error);
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

    console.log(`开始为条目 ${entryId} 进行AI内容提取: ${url}`);
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
    
    // 2. 使用LLM提取所有信息
    console.log('步骤2: 使用智谱GLM-4.5-Flash智能提取新闻信息...');
    const extractedContent = await extractContentWithLLM(htmlContent, title);
    
    // 3. 保存到数据库并更新状态
    console.log('步骤3: 保存提取结果到数据库...');
    extractedContent.processingTime = Date.now() - startTime;
    await saveExtractedContentToDB(c.env.DB, entryId, extractedContent);
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    console.log(`条目 ${entryId} AI内容提取完成，总耗时: ${processingTime}ms`);
    
    return c.json({
      success: true,
      message: `条目 ${entryId} AI内容提取成功`,
      data: {
        entryId,
        url,
        title: extractedContent.title,
        content: extractedContent.content,
        contentPreview: extractedContent.content.substring(0, 300) + (extractedContent.content.length > 300 ? '...' : ''),
        summary: extractedContent.summary,
        topics: extractedContent.topics,
        keywords: extractedContent.keywords,
        publishTime: extractedContent.publishTime,
        author: extractedContent.author,
        source: extractedContent.source,
        wordCount: extractedContent.wordCount,
        processingTime,
        modelUsed: "glm-4.5-flash",
        processed: true
      }
    });
    
  } catch (error) {
    console.error('条目AI内容提取失败:', error);
    return c.json({ 
      error: "条目AI内容提取失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default llmExtractorRoutes;