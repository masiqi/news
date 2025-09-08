// src/routes/llm-extractor.ts
import { Hono } from "hono";

const llmExtractorRoutes = new Hono();

// LLM智能内容提取器 - 使用智谱AI
llmExtractorRoutes.post("/extract", async (c) => {
  try {
    const body = await c.req.json();
    const { url, title } = body;
    
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
  const extractionPrompt = `请从以下HTML网页中提取新闻信息：

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
7. 3-5个主题标签
8. 5-8个关键词
9. 正文字数

返回格式：
{
  "title": "新闻标题",
  "content": "新闻正文内容",
  "summary": "新闻摘要",
  "publishTime": "发布时间",
  "author": "作者",
  "source": "来源",
  "topics": ["主题1", "主题2", "主题3"],
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "wordCount": 字数
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
    stream: false
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
    // 尝试解析JSON响应
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title || title,
        content: parsed.content || '',
        summary: parsed.summary || '',
        publishTime: parsed.publishTime || '',
        author: parsed.author || '',
        source: parsed.source || '',
        topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 5) : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10) : [],
        wordCount: parsed.wordCount || 0
      };
    } else {
      console.log('未找到JSON格式响应');
      // 如果JSON解析失败，返回默认内容
      return {
        title: title,
        content: responseContent.substring(0, 2000),
        summary: '',
        publishTime: '',
        author: '',
        source: '',
        topics: ["新闻主题"],
        keywords: ["新闻", "事件"],
        wordCount: responseContent.substring(0, 2000).length
      };
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
      topics: ["新闻主题"],
      keywords: ["新闻", "事件"],
      wordCount: responseContent.substring(0, 1500).length
    };
  }
}

export default llmExtractorRoutes;