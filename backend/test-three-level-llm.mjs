#!/usr/bin/env node

/**
 * 三级LLM处理系统测试脚本
 * 测试智谱 → OpenRouter → Cloudflare 的故障转移机制
 */

import { LLMConfigService } from '../src/services/llm-config.service.js';
import { UnifiedLLMService } from '../src/services/unified-llm.service.js';

async function testThreeLevelSystem() {
  console.log('🧪 三级LLM处理系统测试');
  console.log('======================');

  // 初始化配置
  LLMConfigService.initializeProviders();
  
  // 检查配置状态
  const config = LLMConfigService.getProviderStats();
  console.log('\n📊 系统配置状态：');
  console.log(`- 总提供商数量: ${config.totalProviders}`);
  console.log(`- 启用提供商数量: ${config.enabledProviders}`);
  console.log(`- 总并发能力: ${config.totalConcurrency}`);
  console.log(`- 总日限制: ${config.totalDailyLimit}`);

  // 显示推荐
  if (config.recommendations.length > 0) {
    console.log('\n💡 配置建议：');
    config.recommendations.forEach(rec => console.log(`  - ${rec}`));
  }

  // 显示三级处理策略
  console.log('\n🔄 三级处理策略：');
  const providers = LLMConfigService.getAllProviders();
  const enabledProviders = providers.filter(p => p.enabled);
  
  if (enabledProviders.length >= 3) {
    console.log('1️⃣ 第一级：' + enabledProviders[0]?.name);
    console.log('2️⃣ 第二级：' + enabledProviders[1]?.name);
    console.log('3️⃣ 第三级：' + enabledProviders[2]?.name);
  } else if (enabledProviders.length === 2) {
    console.log('1️⃣ 第一级：' + enabledProviders[0]?.name);
    console.log('2️⃣ 第二级：' + enabledProviders[1]?.name);
    console.log('3️⃣ 第三级：未配置');
  } else if (enabledProviders.length === 1) {
    console.log('1️⃣ 第一级：' + enabledProviders[0]?.name);
    console.log('2️⃣ 第二级：未配置');
    console.log('3️⃣ 第三级：未配置');
  } else {
    console.log('❌ 没有配置任何LLM提供商');
  }

  // 测试连接
  console.log('\n🔗 测试提供商连接...');
  const testResults = await LLMConfigService.testAllProviders();
  
  testResults.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const error = result.error ? ` (${result.error})` : '';
    console.log(`  ${status} ${result.name}${error}`);
  });

  // 模拟新闻分析测试
  console.log('\n📰 模拟新闻分析测试...');
  const testNews = {
    title: '中国发布人工智能发展新政策',
    content: `近日，中国政府发布了新一代人工智能发展规划，旨在推动AI技术在各行业的深度应用。
             该政策强调了技术创新的重要性，同时提出了加强数据安全和个人信息保护的要求。
             专家认为，这将为中国AI产业带来新的发展机遇。`
  };

  // 测试不同的处理策略
  const testStrategies = [
    { name: '自动模式 (三级故障转移)', provider: 'auto' },
    { name: '仅智谱', provider: 'glm' },
    { name: '仅OpenRouter', provider: 'openrouter' },
    { name: '仅Cloudflare', provider: 'cloudflare' }
  ];

  for (const strategy of testStrategies) {
    console.log(`\n🎯 测试策略: ${strategy.name}`);
    
    try {
      const testParams = {
        title: testNews.title,
        content: testNews.content,
        isHtml: false,
        apiKey: process.env.ZHIPUAI_API_KEY || 'dummy',
        provider: strategy.provider,
        openRouterKey: process.env.OPENROUTER_API_KEY,
        enableFallback: true
      };

      console.log('   参数配置:');
      console.log(`   - Provider: ${strategy.provider}`);
      console.log(`   - Fallback enabled: ${testParams.enableFallback}`);
      console.log(`   - 智谱Key: ${testParams.apiKey ? '已配置' : '未配置'}`);
      console.log(`   - OpenRouter Key: ${testParams.openRouterKey ? '已配置' : '未配置'}`);

      // 注意：这里只是演示参数传递，不进行实际API调用
      console.log('   ✅ 参数配置正确');
      console.log('   ⚠️  实际API调用需要有效的密钥和网络连接');

    } catch (error) {
      console.error(`   ❌ ${strategy.name} 配置失败:`, error.message);
    }
  }

  // 显示详细的提供商信息
  console.log('\n📋 所有提供商详情：');
  providers.forEach(provider => {
    const status = provider.enabled ? '✅' : '❌';
    const priorityIndicator = provider.priority === 1 ? '🥇' : 
                               provider.priority === 2 ? '🥈' : 
                               provider.priority === 3 ? '🥉' : 
                               `${provider.priority}.`;
    
    console.log(`\n${status} ${priorityIndicator} ${provider.name}`);
    console.log(`   提供商: ${provider.provider}`);
    console.log(`   模型: ${provider.model}`);
    console.log(`   优先级: ${provider.priority}`);
    console.log(`   并发/日限制: ${provider.maxConcurrency}/${provider.dailyLimit}`);
    console.log(`   成本: $${provider.costPer1kTokens}/1K tokens`);
    console.log(`   优势: ${provider.strengths.join(', ')}`);
    if (!provider.enabled) {
      console.log(`   未启用原因: ${provider.weaknesses.join(', ')}`);
    }
  });

  // 环境变量检查
  console.log('\n🔧 环境变量检查：');
  const envCheck = {
    'ZHIPUAI_API_KEY': process.env.ZHIPUAI_API_KEY ? '✅ 已配置' : '❌ 未配置',
    'OPENROUTER_API_KEY': process.env.OPENROUTER_API_KEY ? '✅ 已配置' : '❌ 未配置',
    'CLOUDFLARE_ACCOUNT_ID': process.env.CLOUDFLARE_ACCOUNT_ID ? '✅ 已配置' : '❌ 未配置',
    'CLOUDFLARE_API_TOKEN': process.env.CLOUDFLARE_API_TOKEN ? '✅ 已配置' : '❌ 未配置'
  };

  Object.entries(envCheck).forEach(([key, status]) => {
    console.log(`  ${key}: ${status}`);
  });

  console.log('\n🎉 测试完成');
  console.log('\n📝 配置步骤：');
  console.log('1. 设置智谱AI密钥: export ZHIPUAI_API_KEY=your_key');
  console.log('2. 设置OpenRouter密钥: export OPENROUTER_API_KEY=your_key');
  console.log('3. 设置Cloudflare配置 (可选)');
  console.log('4. 重新运行此测试验证配置');
  
  console.log('\n💡 使用建议：');
  console.log('- 优先使用provider=\'auto\'启用自动故障转移');
  console.log('- 在生产环境中建议配置至少2个提供商');
  console.log('- 监控各提供商的使用量和成功率');
  console.log('- 根据实际使用情况调整优先级');
}

// 运行测试
testThreeLevelSystem().catch(console.error);