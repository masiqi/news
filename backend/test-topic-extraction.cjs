#!/usr/bin/env node

/**
 * 主题提取功能测试脚本
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:8787';
const TOKEN = 'development_jwt_secret_key_for_local_testing_only';

async function testTopicExtraction() {
  console.log('🧪 开始测试主题提取功能...\n');

  try {
    // 1. 测试获取模型列表
    console.log('📋 1. 测试获取可用模型列表...');
    const modelsResponse = await fetch(`${API_BASE}/api/topics/models`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!modelsResponse.ok) {
      throw new Error(`获取模型列表失败: ${modelsResponse.status}`);
    }
    
    const modelsData = await modelsResponse.json();
    console.log('✅ 可用模型列表:');
    console.log(JSON.stringify(modelsData, null, 2));
    
    // 2. 测试主题推荐配置
    if (modelsData.data.recommended) {
      console.log('\n🎯 推荐的主题提取配置:');
      console.log(JSON.stringify(modelsData.data.recommended, null, 2));
    }
    
    // 3. 测试单个条目主题提取
    console.log('\n🔍 2. 测试单个条目主题提取...');
    
    // 模拟RSS条目数据
    const testEntry = {
      id: 1,
      title: '人工智能技术在医疗领域的最新突破',
      content: `近日，多家知名研究机构在人工智能医疗领域取得重大进展。某科技公司开发的AI诊断系统在临床试验中展现出95%的准确率，能够早期发现多种癌症迹象。该系统通过分析医学影像数据，结合深度学习算法，为医生提供精准的诊断建议。

与此同时，另一研究团队推出了基于大语言模型的医疗助手，能够帮助医生快速查阅最新医学文献，并提供个性化的治疗方案建议。这些AI工具不仅提高了诊断效率，还显著降低了医疗成本。

专家表示，AI医疗技术将在未来几年内彻底改变传统医疗模式，为患者提供更加精准和高效的治疗方案。`
    };
    
    const extractResponse = await fetch(`${API_BASE}/api/topics/extract/1`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // 可以指定不同的模型配置进行测试
        // modelConfig: {
        //   model: "@cf/meta/llama-3.1-8b-instruct-fast",
        //   bindingName: "AI",
        //   temperature: 0.3,
        //   maxTokens: 500
        // }
      })
    });
    
    if (!extractResponse.ok) {
      throw new Error(`主题提取失败: ${extractResponse.status} ${extractResponse.statusText}`);
    }
    
    const extractData = await extractResponse.json();
    console.log('✅ 主题提取结果:');
    console.log(JSON.stringify(extractData, null, 2));
    
    // 4. 测试获取主题信息
    if (extractData.success) {
      console.log('\n📊 3. 测试获取主题信息...');
      const getResponse = await fetch(`${API_BASE}/api/topics/1`, {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (getResponse.ok) {
        const getData = await getResponse.json();
        console.log('✅ 主题信息获取结果:');
        console.log(JSON.stringify(getData, null, 2));
      } else {
        console.log(`❌ 获取主题信息失败: ${getResponse.status}`);
      }
    }
    
    // 5. 测试主题统计
    console.log('\n📈 4. 测试获取主题统计...');
    const statsResponse = await fetch(`${API_BASE}/api/topics/stats`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      console.log('✅ 主题统计结果:');
      console.log(JSON.stringify(statsData, null, 2));
    } else {
      console.log(`❌ 获取主题统计失败: ${statsResponse.status}`);
    }
    
    console.log('\n🎉 主题提取功能测试完成！');
    
    // 输出使用建议
    console.log('\n📖 使用建议:');
    console.log('1. 模型选择优先级：速度 > 准确性 > 成本');
    console.log('2. 主题提取推荐温度：0.3（保持一致性）');
    console.log('3. 建议最大tokens：500（避免过度生成）');
    console.log('4. 可以通过环境变量配置不同的默认模型');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testTopicExtraction().catch(console.error);
}

module.exports = { testTopicExtraction };