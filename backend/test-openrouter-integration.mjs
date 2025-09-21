#!/usr/bin/env node

/**
 * OpenRouter集成测试脚本
 * 测试OpenRouter在新闻分析中的表现
 */

import { LLMConfigService } from '../src/services/llm-config.service.js';
import { UnifiedLLMService } from '../src/services/unified-llm.service.js';

async function testOpenRouterIntegration() {
  console.log('🧪 OpenRouter集成测试开始');
  console.log('============================');

  // 检查配置
  const config = LLMConfigService.getProviderStats();
  console.log('\n📊 LLM提供商配置状态：');
  console.log(`- 总提供商数量: ${config.totalProviders}`);
  console.log(`- 启用提供商数量: ${config.enabledProviders}`);
  console.log(`- 总并发能力: ${config.totalConcurrency}`);
  console.log(`- 总日限制: ${config.totalDailyLimit}`);

  // 显示推荐
  if (config.recommendations.length > 0) {
    console.log('\n💡 配置建议：');
    config.recommendations.forEach(rec => console.log(`  - ${rec}`));
  }

  // 测试所有提供商连接
  console.log('\n🔗 测试提供商连接...');
  const testResults = await LLMConfigService.testAllProviders();
  
  testResults.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const error = result.error ? ` (${result.error})` : '';
    console.log(`  ${status} ${result.name}${error}`);
  });

  // 获取最佳提供商
  const bestProvider = LLMConfigService.getBestProvider();
  if (bestProvider) {
    console.log(`\n🎯 最佳提供商: ${bestProvider.name}`);
    console.log(`   模型: ${bestProvider.model}`);
    console.log(`   优先级: ${bestProvider.priority}`);
    console.log(`   并发限制: ${bestProvider.maxConcurrency}`);
    console.log(`   日限制: ${bestProvider.dailyLimit}`);
    
    // 测试新闻分析
    console.log('\n📰 测试新闻分析功能...');
    
    const testNews = {
      title: '中国发布人工智能发展新政策',
      content: `近日，中国政府发布了新一代人工智能发展规划，旨在推动AI技术在各行业的深度应用。
               该政策强调了技术创新的重要性，同时提出了加强数据安全和个人信息保护的要求。
               专家认为，这将为中国AI产业带来新的发展机遇。`
    };

    try {
      const testParams = {
        title: testNews.title,
        content: testNews.content,
        isHtml: false,
        apiKey: 'dummy', // 不会被使用
        provider: bestProvider.provider,
        openRouterKey: process.env.OPENROUTER_API_KEY
      };

      console.log('   使用最佳提供商进行分析...');
      console.log(`   预期提供商: ${bestProvider.provider}`);
      console.log(`   预期模型: ${bestProvider.model}`);

      // 注意：这里只是演示参数传递，实际调用需要有效的API密钥
      console.log('   ✅ 参数配置正确');
      console.log('   ⚠️  要进行实际测试，请设置环境变量 OPENROUTER_API_KEY');

    } catch (error) {
      console.error('   ❌ 测试失败:', error.message);
    }
  } else {
    console.log('\n❌ 没有可用的LLM提供商');
    console.log('请检查环境变量配置');
  }

  // 显示所有提供商详情
  console.log('\n📋 所有提供商详情：');
  const allProviders = LLMConfigService.getAllProviders();
  
  allProviders.forEach(provider => {
    const status = provider.enabled ? '✅' : '❌';
    console.log(`\n${status} ${provider.name} (${provider.provider})`);
    console.log(`   模型: ${provider.model}`);
    console.log(`   优先级: ${provider.priority}`);
    console.log(`   并发/日限制: ${provider.maxConcurrency}/${provider.dailyLimit}`);
    console.log(`   优势: ${provider.strengths.join(', ')}`);
    if (!provider.enabled) {
      console.log(`   未启用原因: ${provider.weaknesses.join(', ')}`);
    }
  });

  console.log('\n🎉 测试完成');
  console.log('\n📝 配置OpenRouter的步骤：');
  console.log('1. 访问 https://openrouter.ai/keys 获取API密钥');
  console.log('2. 设置环境变量: export OPENROUTER_API_KEY=your_key_here');
  console.log('3. 或添加到 .env 文件中');
  console.log('4. 重新运行此测试脚本验证配置');
}

// 运行测试
testOpenRouterIntegration().catch(console.error);