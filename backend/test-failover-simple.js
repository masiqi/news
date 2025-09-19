// test-failover-simple.js
// 简单测试智谱GLM失败时自动切换到Cloudflare AI的机制

// 模拟UnifiedLLMService的核心逻辑
class MockUnifiedLLMService {
  static async analyzeContent(params, env) {
    const { title, content, isHtml = false, apiKey } = params;
    
    console.log(`=== 开始统一LLM分析，标题: ${title} ===`);
    console.log(`📋 内容长度: ${content.length} 字符`);
    console.log(`🔄 内容类型: ${isHtml ? 'HTML格式' : '文本格式'}`);
    
    try {
      // 首先尝试使用智谱GLM（模拟失败）
      console.log(`🤖 首次尝试使用智谱GLM进行分析...`);
      const glmResult = await this.analyzeWithGLM(params);
      console.log(`✅ 智谱GLM分析成功`);
      return glmResult;
    } catch (glmError) {
      console.error(`❌ 智谱GLM分析失败:`, glmError.message);
      
      // 如果提供了env参数，尝试使用Cloudflare AI作为备用方案
      if (env) {
        console.log(`🔄 尝试使用Cloudflare AI作为备用方案...`);
        try {
          const cfResult = await this.analyzeWithCloudflare(params, env);
          console.log(`✅ Cloudflare AI分析成功`);
          return cfResult;
        } catch (cfError) {
          console.error(`❌ Cloudflare AI分析也失败:`, cfError.message);
          // 如果Cloudflare AI也失败，抛出原始的GLM错误
          throw glmError;
        }
      } else {
        // 没有提供env参数，无法使用备用方案，直接抛出错误
        throw glmError;
      }
    }
  }
  
  // 模拟智谱GLM分析（总是失败）
  static async analyzeWithGLM(params) {
    throw new Error('智谱GLM处理失败：包含敏感词');
  }
  
  // 模拟Cloudflare AI分析
  static async analyzeWithCloudflare(params, env) {
    const { title, content, isHtml = false } = params;
    const startTime = Date.now();
    
    // 构建分析提示
    const prompt = `你是一个专业的新闻内容分析专家，擅长从HTML页面中提取和解析新闻内容。请对以下中文新闻内容进行全面分析。

新闻标题：${title}
${isHtml ? '新闻原文（HTML格式）：' : '新闻原文（RSS摘要）：'}
${content}

请严格按照以下JSON格式返回分析结果，不要添加任何额外的文本、注释或格式：

{"topics": ["主题1", "主题2", "主题3"], "keywords": ["关键词1", "关键词2", "关键词3"], "sentiment": "positive|negative|neutral", "analysis": "深度分析内容...", "educationalValue": "教育价值评估...", "extractedContent": "提取的完整新闻内容（如果有）"}`;

    console.log(`🤖 发送AI请求，模型: @cf/openai/gpt-oss-20b`);
    console.log(`📝 Prompt长度: ${prompt.length} 字符`);
    
    // 调用Cloudflare AI
    const response = await env.AI.run('@cf/openai/gpt-oss-20b', {
      input: prompt
    });
    
    const processingTime = Date.now() - startTime;
    console.log(`🕐 AI分析完成，耗时: ${processingTime}ms`);
    
    // 获取响应文本
    const resultText = response.response || JSON.stringify(response);
    console.log(`✅ AI API调用成功`);
    console.log(`📝 AI原始响应长度: ${resultText.length} 字符`);
    
    // 解析结果
    const parsed = JSON.parse(resultText);
    
    return {
      topics: parsed.topics.slice(0, 5),
      keywords: parsed.keywords.slice(0, 10),
      sentiment: parsed.sentiment,
      analysis: parsed.analysis || '',
      educationalValue: parsed.educationalValue || '',
      extractedContent: parsed.extractedContent || '',
      processingTime,
      modelUsed: '@cf/openai/gpt-oss-20b'
    };
  }
}

// 模拟包含敏感词的内容，用于触发智谱GLM的处理失败
const sensitiveContent = `
这是一个包含敏感词的测试内容。
新闻标题：敏感事件报道
内容：这里有一些可能触发敏感词过滤的内容。
`;

// 模拟正常的API Key（无效的，会触发错误）
const mockApiKey = 'invalid-api-key';

// 模拟环境变量（包含Cloudflare AI绑定）
const mockEnv = {
  AI: {
    run: async (model, options) => {
      console.log(`[Mock] Cloudflare AI被调用，模型: ${model}`);
      console.log(`[Mock] 输入内容长度: ${options.input.length}`);
      
      // 模拟返回一个有效的JSON响应
      return {
        response: JSON.stringify({
          topics: ["测试主题1", "测试主题2"],
          keywords: ["测试", "敏感词", "failover"],
          sentiment: "neutral",
          analysis: "这是一个测试用的AI分析结果，用于验证failover机制。",
          educationalValue: "这个测试演示了如何在主AI服务失败时切换到备用服务。",
          extractedContent: "测试内容：这里是提取的内容，用于验证failover机制。"
        })
      };
    }
  }
};

async function testFailover() {
  console.log('开始测试failover机制...');
  console.log('测试内容包含敏感词，应该会导致智谱GLM处理失败...');
  
  try {
    // 调用模拟的UnifiedLLMService，传入模拟的环境变量
    const result = await MockUnifiedLLMService.analyzeContent({
      title: "敏感词测试",
      content: sensitiveContent,
      isHtml: false,
      apiKey: mockApiKey
    }, mockEnv);
    
    console.log('✅ 测试完成，结果:');
    console.log(JSON.stringify(result, null, 2));
    
    // 验证结果是否来自Cloudflare AI（通过modelUsed字段）
    if (result.modelUsed === '@cf/openai/gpt-oss-20b') {
      console.log('✅ 成功切换到Cloudflare AI');
      return true;
    } else {
      console.log('⚠️  似乎没有切换到Cloudflare AI，modelUsed:', result.modelUsed);
      return false;
    }
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
    return false;
  }
}

// 执行测试
testFailover().then(success => {
  if (success) {
    console.log('✅ Failover机制测试通过');
  } else {
    console.log('❌ Failover机制测试失败');
  }
});