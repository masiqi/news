// src/routes/llm-content-extractor.ts
import { Hono } from "hono";

const llmContentRoutes = new Hono();

// 使用LLM智能提取网页内容的路由
llmContentRoutes.post("/extract-llm", async (c) => {
  try {
    const body = await c.req.json();
    const { url, title } = body;
    
    if (!url) {
      return c.json({ error: "请提供URL" }, 400);
    }

    console.log(`开始使用LLM提取网页内容: ${url}`);
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
    
    // 2. 使用LLM提取新闻正文
    console.log('步骤2: 使用LLM提取新闻正文...');
    const extractedContent = await extractContentWithLLM(htmlContent, url, title, c.env.AI);
    
    // 3. 提取主题和关键词
    console.log('步骤3: 提取主题和关键词...');
    const topicsAndKeywords = await extractTopicsWithLLM(extractedContent.content, c.env.AI);
    
    const endTime = Date.now();
    console.log(`LLM内容提取完成，总耗时: ${endTime - startTime}ms`);
    
    return c.json({
      success: true,
      message: "LLM内容提取成功",
      data: {
        url,
        title: extractedContent.title,
        content: extractedContent.content,
        summary: extractedContent.summary,
        topics: topicsAndKeywords.topics,
        keywords: topicsAndKeywords.keywords,
        publishTime: extractedContent.publishTime,
        author: extractedContent.author,
        source: extractedContent.source,
        wordCount: extractedContent.wordCount,
        processingTime: endTime - startTime
      }
    });
    
  } catch (error) {
    console.error('LLM内容提取失败:', error);
    return c.json({ 
      error: "LLM内容提取失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 使用LLM从HTML中提取新闻内容
async function extractContentWithLLM(html: string, url: string, title: string, ai: any) {
  const contentExtractionPrompt = `
你是一个专业的新闻内容分析师。你的任务是从网页HTML中提取出纯净的新闻正文内容，去除所有导航、广告、页眉、页脚等无关信息。

网页标题：${title}
网页URL：${url}

HTML内容（简化版本）：
${html.substring(0, 8000)}${html.length > 8000 ? '...' : ''}

请完成以下任务：
1. 仔细分析HTML内容，识别出真正的新闻正文部分
2. 忽略以下无关内容：
   - 导航菜单和链接
   - 广告和促销内容
   - 页眉和页脚信息
   - 分享按钮和社交媒体链接
   - 评论区和相关推荐
   - 脚本和样式代码
3. 提取并整理出纯净的新闻正文内容
4. 尝试识别以下结构化信息（如果存在）：
   - 新闻发布时间
   - 作者姓名
   - 新闻来源
5. 统计新闻正文的字数

请以JSON格式返回，结构如下：
{
  "title": "新闻标题",
  "content": "纯净的新闻正文内容",
  "summary": "新闻内容简要摘要（1-2句话）",
  "publishTime": "发布时间",
  "author": "作者姓名",
  "source": "新闻来源",
  "wordCount": 正文字数
}

要求：
1. 内容必须是纯净的中文新闻正文，不要包含任何HTML标签
2. 摘除所有导航、广告、页眉页脚等无关信息
3. 保持新闻内容的完整性和可读性
4. 如果识别不到某些信息，对应字段可以为空字符串
5. 只返回JSON，不要包含其他解释`;

  const response = await ai.run({
    model: "@cf/meta/llama-3.1-8b-instruct-fast",
    messages: [
      {
        role: "system",
        content: "你是一个专业的新闻内容分析师，擅长从复杂的HTML网页中提取纯净的新闻正文。"
      },
      {
        role: "user",
        content: contentExtractionPrompt
      }
    ],
    temperature: 0.3,
    max_tokens: 4000
  });

  const contentText = response.response;
  
  try {
    // 尝试解析JSON响应
    const jsonMatch = contentText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title || title,
        content: parsed.content || '',
        summary: parsed.summary || '',
        publishTime: parsed.publishTime || '',
        author: parsed.author || '',
        source: parsed.source || '',
        wordCount: parsed.wordCount || 0
      };
    }
  } catch (error) {
    console.error('解析LLM内容响应失败:', error);
  }
  
  // 如果JSON解析失败，尝试简单文本提取
  return {
    title: title,
    content: contentText.substring(0, 2000), // 截取前2000字符
    summary: '',
    publishTime: '',
    author: '',
    source: '',
    wordCount: contentText.substring(0, 2000).length
  };
}

// 使用LLM提取主题和关键词
async function extractTopicsWithLLM(content: string, ai: any) {
  const topicExtractionPrompt = `
你是一个专业的新闻主题分析专家。你的任务是从新闻内容中提取关键主题和关键词。

新闻内容：
${content.substring(0, 3000)}${content.length > 3000 ? '...' : ''}

请完成以下任务：
1. 提取3-5个最主要的新闻主题，每个主题应该简洁明了（2-6个字）
2. 提取5-10个重要关键词，关键词应该是文章中的名词、术语或概念
3. 主题要覆盖新闻的核心内容
4. 关键词要具有代表性和相关性

请以JSON格式返回，结构如下：
{
  "topics": ["主题1", "主题2", "主题3"],
  "keywords": ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5"]
}

要求：
1. 主题应该简洁、准确，覆盖新闻的核心内容
2. 关键词应该是文章中的重要名词、术语或概念
3. 只返回JSON，不要包含其他解释
4. 如果内容不足，请返回空的数组和关键词列表`;

  const response = await ai.run({
    model: "@cf/meta/llama-3.1-8b-instruct-fast",
    messages: [
      {
        role: "system",
        content: "你是一个专业的新闻主题分析专家，擅长从中文新闻内容中提取关键主题和关键词。"
      },
      {
        role: "user",
        content: topicExtractionPrompt
      }
    ],
    temperature: 0.3,
    max_tokens: 800
  });

  const topicText = response.response;
  
  try {
    // 尝试解析JSON响应
    const jsonMatch = topicText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 5) : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10) : []
      };
    }
  } catch (error) {
    console.error('解析LLM主题响应失败:', error);
  }
  
  // 如果JSON解析失败，返回默认主题和关键词
  return {
    topics: ["新闻", "事件", "主题"],
    keywords: ["关键词1", "关键词2", "关键词3"]
  };
}

// 测试端点 - 直接测试指定URL
llmContentRoutes.post("/test-specific-url", async (c) => {
  try {
    const testUrl = "http://www.chinanews.com/hr/2025/09-07/10477972.shtml";
    const testTitle = "纪念中国人民抗日战争暨世界反法西斯战争胜利80周年图片展暨电影周在比利时揭幕";
    
    console.log(`测试指定URL的内容提取: ${testUrl}`);
    
    const extractedContent = await extractContentWithLLM('', testUrl, testTitle, c.env.AI);
    const topicsAndKeywords = await extractTopicsWithLLM(extractedContent.content, c.env.AI);
    
    return c.json({
      success: true,
      message: "指定URL内容提取测试成功",
      data: {
        url: testUrl,
        title: extractedContent.title,
        content: extractedContent.content.substring(0, 500) + '...',
        summary: extractedContent.summary,
        topics: topicsAndKeywords.topics,
        keywords: topicsAndKeywords.keywords,
        wordCount: extractedContent.wordCount
      }
    });
    
  } catch (error) {
    console.error('指定URL内容提取测试失败:', error);
    return c.json({ 
      error: "指定URL内容提取测试失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default llmContentRoutes;