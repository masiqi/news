#!/usr/bin/env node

/**
 * 测试OpenRouter API密钥加载和连接
 */

console.log('🧪 测试OpenRouter API密钥加载');
console.log('==============================');

// 检查环境变量
console.log('\n📋 环境变量检查：');

const envVars = [
  'ZHIPUAI_API_KEY',
  'OPENROUTER_API_KEY',
  'JWT_SECRET',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'DEFAULT_LLM_PROVIDER',
  'ENABLE_LLM_FALLBACK'
];

envVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    const displayValue = varName.includes('API_KEY') || varName.includes('SECRET') || varName.includes('PASSWORD') 
      ? value.substring(0, 8) + '...' + value.substring(value.length - 4)
      : value;
    console.log(`✅ ${varName}: ${displayValue}`);
  } else {
    console.log(`❌ ${varName}: 未设置`);
  }
});

// 测试OpenRouter连接
console.log('\n🔗 测试OpenRouter API连接...');

const openRouterKey = process.env.OPENROUTER_API_KEY;

if (!openRouterKey) {
  console.log('❌ OPENROUTER_API_KEY 未设置');
  console.log('\n💡 解决方案：');
  console.log('1. 检查 .env 文件中是否有 OPENROUTER_API_KEY');
  console.log('2. 检查 .dev.vars 文件中是否有 OPENROUTER_API_KEY');
  console.log('3. 重新启动开发服务器：npm run dev');
  process.exit(1);
}

console.log('✅ OPENROUTER_API_KEY 已设置');

// 测试API连接
async function testOpenRouterConnection() {
  try {
    console.log('📡 测试API连接...');
    
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ OpenRouter API 连接成功');
      console.log(`📊 可用模型数量: ${data.data?.length || 0}`);
      
      // 查找GLM模型
      const glmModels = data.data?.filter(model => 
        model.id.includes('glm') || model.id.includes('z-ai')
      );
      
      if (glmModels && glmModels.length > 0) {
        console.log('🎯 找到GLM模型：');
        glmModels.forEach(model => {
          console.log(`   - ${model.id} (${model.context_length || '未知'} context)`);
        });
      } else {
        console.log('⚠️  未找到GLM模型，但可以使用其他模型');
      }
      
    } else {
      const errorText = await response.text();
      console.log(`❌ API连接失败: ${response.status} ${response.statusText}`);
      console.log(`错误详情: ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ 连接测试失败: ${error.message}`);
  }
}

// 运行测试
testOpenRouterConnection().then(() => {
  console.log('\n🎉 测试完成');
  
  console.log('\n💡 下一步：');
  console.log('1. 如果API连接成功，可以开始使用三级LLM处理系统');
  console.log('2. 在代码中使用：');
  console.log('   ```javascript');
  console.log('   const result = await UnifiedLLMService.analyzeContent({');
  console.log('     title: "新闻标题",');
  console.log('     content: "新闻内容",');
  console.log('     provider: "auto", // 启用三级故障转移');
  console.log('     apiKey: process.env.ZHIPUAI_API_KEY,');
  console.log('     openRouterKey: process.env.OPENROUTER_API_KEY');
  console.log('   });');
  console.log('   ```');
  
}).catch(console.error);