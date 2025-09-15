#!/usr/bin/env node

/**
 * 快速API测试脚本
 * 测试自动存储API是否正常响应（不需要认证）
 */

const API_BASE = 'http://localhost:8787/api';

console.log('🚀 快速API测试开始...\n');

async function testAPIEndpoints() {
  const tests = [
    {
      name: '用户设置API (GET)',
      method: 'GET',
      url: `${API_BASE}/user/auto-storage/settings`,
      headers: { 'Authorization': 'Bearer test_token' }
    },
    {
      name: '存储统计API (GET)', 
      method: 'GET',
      url: `${API_BASE}/user/auto-storage/statistics`,
      headers: { 'Authorization': 'Bearer test_token' }
    },
    {
      name: '文件列表API (GET)',
      method: 'GET', 
      url: `${API_BASE}/user/auto-storage/files`,
      headers: { 'Authorization': 'Bearer test_token' }
    },
    {
      name: '文件名测试API (POST)',
      method: 'POST',
      url: `${API_BASE}/user/auto-storage/test-filename`,
      headers: { 
        'Authorization': 'Bearer test_token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pattern: '{title}_{id}_{date}',
        title: '测试文章标题'
      })
    },
    {
      name: '格式预览API (POST)',
      method: 'POST',
      url: `${API_BASE}/user/auto-storage/preview-formats`,
      headers: {
        'Authorization': 'Bearer test_token', 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'AI技术发展',
        content: '人工智能正在改变世界...',
        summary: '本文探讨了AI技术的发展趋势'
      })
    }
  ];

  const results = [];

  for (const test of tests) {
    try {
      console.log(`📍 测试: ${test.name}`);
      
      const options = {
        method: test.method,
        headers: test.headers
      };

      if (test.body) {
        options.body = test.body;
      }

      const response = await fetch(test.url, options);
      
      const result = {
        name: test.name,
        status: response.status,
        ok: response.ok,
        hasAuthHeader: test.headers['Authorization'] !== undefined
      };

      // 尝试解析响应
      try {
        const data = await response.json();
        result.data = data;
        
        if (response.ok) {
          console.log(`  ✅ 成功 (${response.status})`);
          if (data.success !== undefined) {
            console.log(`     响应: ${data.success ? '成功' : '失败'}`);
          }
        } else {
          console.log(`  ⚠️  HTTP ${response.status}`);
          console.log(`     错误: ${data.message || data.error || '未知错误'}`);
        }
        
      } catch (parseError) {
        // 如果不是JSON，获取文本响应
        const text = await response.text();
        result.text = text;
        console.log(`  ⚠️  HTTP ${response.status} (非JSON响应)`);
        console.log(`     响应: ${text.substring(0, 100)}...`);
      }

      results.push(result);
      
    } catch (error) {
      console.log(`  ❌ 网络错误: ${error.message}`);
      results.push({
        name: test.name,
        status: 'NETWORK_ERROR',
        error: error.message
      });
    }
    
    console.log(''); // 空行分隔
  }

  // 汇总结果
  console.log('📊 测试结果汇总:');
  console.log('='.repeat(50));
  
  const successCount = results.filter(r => r.ok).length;
  const authErrorCount = results.filter(r => r.status === 401).length;
  const networkErrorCount = results.filter(r => r.status === 'NETWORK_ERROR').length;
  const otherErrorCount = results.length - successCount - authErrorCount - networkErrorCount;
  
  console.log(`✅ 成功响应: ${successCount}/${results.length}`);
  console.log(`🔐 认证错误: ${authErrorCount} (预期内，需要有效token)`);
  console.log(`🌐 网络错误: ${networkErrorCount}`);
  console.log(`⚠️  其他错误: ${otherErrorCount}`);
  
  console.log('\n🎯 结论:');
  if (authErrorCount > 0 && networkErrorCount === 0) {
    console.log('✅ API服务正常运行');
    console.log('💡 401错误是正常的，需要有效的用户JWT令牌');
    console.log('🔧 获取有效token后可以测试完整功能');
  } else if (networkErrorCount > 0) {
    console.log('❌ 网络连接问题，请确保后端服务正在运行');
    console.log('💡 运行命令: npm run dev');
  } else {
    console.log('⚠️  存在意外错误，需要检查服务配置');
  }
  
  console.log('\n📋 下一步:');
  console.log('1. 确保后端服务运行: npm run dev');
  console.log('2. 登录前端获取有效JWT token');
  console.log('3. 运行完整测试: node test-auto-storage.js');
}

// 检查服务是否运行
async function checkServiceStatus() {
  console.log('🔍 检查服务状态...\n');
  
  try {
    const response = await fetch('http://localhost:8787/', {
      method: 'GET',
      timeout: 5000
    });
    
    if (response.ok) {
      console.log('✅ 后端服务运行正常 (http://localhost:8787)');
      return true;
    } else {
      console.log(`⚠️  后端服务响应异常: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('❌ 后端服务未运行或无法访问');
    console.log('💡 请先启动后端服务: cd backend && npm run dev');
    return false;
  }
}

// 主函数
async function main() {
  const serviceRunning = await checkServiceStatus();
  
  if (serviceRunning) {
    console.log('');
    await testAPIEndpoints();
  }
}

main().catch(console.error);