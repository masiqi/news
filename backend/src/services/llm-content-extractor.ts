// src/services/llm-content-extractor.ts
import { Hono } from "hono";
import { UnifiedLLMService } from './unified-llm.service';

const llmContentRoutes = new Hono();

// 使用LLM智能提取网页内容的路由
llmContentRoutes.post("/extract-llm", async (c) => {
  try {
    const body = await c.req.json();
    const { url, title } = body;
    
    if (!url) {
      return c.json({ error: "请提供URL" }, 400);
    }

    console.log(`开始使用统一LLM服务提取网页内容: ${url}`);
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
    
    // 2. 使用统一LLM服务进行分析
    console.log('步骤2: 使用统一LLM服务进行分析...');
    
    // 检查API Key
    const apiKey = c.env.ZHIPUAI_API_KEY;
    if (!apiKey) {
      return c.json({ error: "智谱AI API Key未配置" }, 500);
    }
    
    const analysisResult = await UnifiedLLMService.analyzeContent({
      title: title || url,
      content: htmlContent,
      link: url,
      isHtml: true,
      apiKey: apiKey
    }, c.env);
    
    const endTime = Date.now();
    console.log(`统一LLM内容提取完成，总耗时: ${endTime - startTime}ms`);
    
    return c.json({
      success: true,
      message: "统一LLM内容提取成功",
      data: {
        url,
        title: analysisResult.extractedContent ? title : "原始标题",
        content: analysisResult.extractedContent || htmlContent,
        summary: analysisResult.analysis,
        topics: analysisResult.topics,
        keywords: analysisResult.keywords,
        sentiment: analysisResult.sentiment,
        educationalValue: analysisResult.educationalValue,
        processingTime: analysisResult.processingTime,
        modelUsed: analysisResult.modelUsed,
        wordCount: (analysisResult.extractedContent || htmlContent).length
      }
    });
    
  } catch (error) {
    console.error('统一LLM内容提取失败:', error);
    return c.json({ 
      error: "统一LLM内容提取失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 简化的主题提取接口（用于兼容）
llmContentRoutes.post("/extract-topics", async (c) => {
  try {
    const body = await c.req.json();
    const { title, content } = body;
    
    if (!title || !content) {
      return c.json({ error: "请提供标题和内容" }, 400);
    }

    const apiKey = c.env.ZHIPUAI_API_KEY;
    if (!apiKey) {
      return c.json({ error: "智谱AI API Key未配置" }, 500);
    }
    
    const result = await UnifiedLLMService.extractTopics(title, content, apiKey, c.env);
    
    return c.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('主题提取失败:', error);
    return c.json({ 
      error: "主题提取失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 简化的内容提取接口（用于兼容）
llmContentRoutes.post("/extract-content", async (c) => {
  try {
    const body = await c.req.json();
    const { html, url, title } = body;
    
    if (!html || !url) {
      return c.json({ error: "请提供HTML内容和URL" }, 400);
    }

    const apiKey = c.env.ZHIPUAI_API_KEY;
    if (!apiKey) {
      return c.json({ error: "智谱AI API Key未配置" }, 500);
    }
    
    const result = await UnifiedLLMService.extractContent(html, url, title, apiKey, c.env);
    
    return c.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('内容提取失败:', error);
    return c.json({ 
      error: "内容提取失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 测试端点 - 直接测试指定URL
llmContentRoutes.post("/test-specific-url", async (c) => {
  try {
    const testUrl = "http://www.chinanews.com/hr/2025/09-07/10477972.shtml";
    const testTitle = "纪念中国人民抗日战争暨世界反法西斯战争胜利80周年图片展暨电影周在比利时揭幕";
    
    console.log(`测试指定URL的统一LLM内容提取: ${testUrl}`);
    
    const apiKey = c.env.ZHIPUAI_API_KEY;
    if (!apiKey) {
      return c.json({ error: "智谱AI API Key未配置" }, 500);
    }
    
    // 抓取网页内容
    const response = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const htmlContent = await response.text();
    
    // 使用统一LLM服务进行分析
    const analysisResult = await UnifiedLLMService.analyzeContent({
      title: testTitle,
      content: htmlContent,
      link: testUrl,
      isHtml: true,
      apiKey: apiKey
    }, c.env);
    
    return c.json({
      success: true,
      message: "指定URL统一LLM内容提取测试成功",
      data: {
        url: testUrl,
        title: testTitle,
        content: (analysisResult.extractedContent || htmlContent).substring(0, 500) + '...',
        summary: analysisResult.analysis,
        topics: analysisResult.topics,
        keywords: analysisResult.keywords,
        sentiment: analysisResult.sentiment,
        educationalValue: analysisResult.educationalValue,
        processingTime: analysisResult.processingTime,
        modelUsed: analysisResult.modelUsed,
        wordCount: (analysisResult.extractedContent || htmlContent).length
      }
    });
    
  } catch (error) {
    console.error('指定URL统一LLM内容提取测试失败:', error);
    return c.json({ 
      error: "指定URL统一LLM内容提取测试失败", 
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

export default llmContentRoutes;
