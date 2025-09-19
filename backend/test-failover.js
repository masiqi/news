// test-failover.js
// 测试智谱GLM失败时自动切换到Cloudflare AI的机制

// 创建一个简单的测试来验证failover机制
const testFailover = async () => {
  console.log('开始测试failover机制...');
  
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
  
  try {
    // 动态导入UnifiedLLMService
    const { UnifiedLLMService } = await import('./src/services/unified-llm.service.ts');
    
    // 模拟包含敏感词的内容，应该会导致智谱GLM处理失败
    const sensitiveContent = `
这是一个包含敏感词的测试内容。
新闻标题：敏感事件报道
内容：这里有一些可能触发敏感词过滤的内容。
`;
    
    // 模拟无效的API Key（会触发错误）
    const mockApiKey = 'invalid-api-key';
    
    console.log('测试内容包含敏感词，应该会导致智谱GLM处理失败...');
    
    // 调用UnifiedLLMService，传入模拟的环境变量
    const result = await UnifiedLLMService.analyzeContent({
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
};

// 执行测试
testFailover().then(success => {
  if (success) {
    console.log('✅ Failover机制测试通过');
  } else {
    console.log('❌ Failover机制测试失败');
  }
});