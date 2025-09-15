#!/usr/bin/env node

/**
 * 自动Markdown存储功能测试脚本
 * 验证用户设置管理、文件生成和存储功能
 */

const API_BASE = 'http://localhost:8787/api';

// 测试用户令牌（需要替换为实际令牌）
const TEST_TOKEN = 'your_test_token_here';

async function testAutoStorageAPIs() {
  console.log('🧪 开始测试自动Markdown存储功能...\n');

  const headers = {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. 测试获取用户设置
    console.log('1️⃣ 测试获取用户设置...');
    const settingsResponse = await fetch(`${API_BASE}/user/auto-storage/settings`, {
      headers
    });
    
    if (settingsResponse.ok) {
      const settings = await settingsResponse.json();
      console.log('✅ 获取用户设置成功:');
      console.log(JSON.stringify(settings, null, 2));
    } else {
      console.log('❌ 获取用户设置失败:', settingsResponse.status);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');

    // 2. 测试更新用户设置
    console.log('2️⃣ 测试更新用户设置...');
    const updateResponse = await fetch(`${API_BASE}/user/auto-storage/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        enabled: true,
        storagePath: 'notes',
        filenamePattern: '{title}_{id}_{date}',
        fileFormat: 'academic',
        maxFileSize: 2048576, // 2MB
        maxFilesPerDay: 50,
        includeMetadata: true
      })
    });

    if (updateResponse.ok) {
      const updateResult = await updateResponse.json();
      console.log('✅ 更新用户设置成功:');
      console.log(JSON.stringify(updateResult, null, 2));
    } else {
      console.log('❌ 更新用户设置失败:', updateResponse.status);
      const errorText = await updateResponse.text();
      console.log('错误详情:', errorText);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');

    // 3. 测试获取存储统计
    console.log('3️⃣ 测试获取存储统计...');
    const statsResponse = await fetch(`${API_BASE}/user/auto-storage/statistics`, {
      headers
    });

    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ 获取存储统计成功:');
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log('❌ 获取存储统计失败:', statsResponse.status);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');

    // 4. 测试获取文件列表
    console.log('4️⃣ 测试获取文件列表...');
    const filesResponse = await fetch(`${API_BASE}/user/auto-storage/files`, {
      headers
    });

    if (filesResponse.ok) {
      const files = await filesResponse.json();
      console.log('✅ 获取文件列表成功:');
      console.log(`找到 ${files.files?.length || 0} 个文件`);
      if (files.files && files.files.length > 0) {
        console.log('前5个文件:');
        files.files.slice(0, 5).forEach((file, index) => {
          console.log(`${index + 1}. ${file.key} (${file.size} bytes)`);
        });
      }
    } else {
      console.log('❌ 获取文件列表失败:', filesResponse.status);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');

    // 5. 测试文件名生成
    console.log('5️⃣ 测试文件名生成...');
    const filenameTestResponse = await fetch(`${API_BASE}/user/auto-storage/test-filename`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pattern: '{title}_{id}_{date}',
        title: 'AI技术发展报告：2025年趋势分析'
      })
    });

    if (filenameTestResponse.ok) {
      const filenameResult = await filenameTestResponse.json();
      console.log('✅ 文件名生成测试成功:');
      console.log(JSON.stringify(filenameResult, null, 2));
    } else {
      console.log('❌ 文件名生成测试失败:', filenameTestResponse.status);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');

    // 6. 测试格式预览
    console.log('6️⃣ 测试格式预览...');
    const previewResponse = await fetch(`${API_BASE}/user/auto-storage/preview-formats`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: '人工智能在医疗领域的应用',
        content: '人工智能技术正在革命性地改变医疗健康行业...',
        summary: '本文探讨了AI在医疗诊断、药物研发和个性化治疗中的应用前景。'
      })
    });

    if (previewResponse.ok) {
      const previewResult = await previewResponse.json();
      console.log('✅ 格式预览成功:');
      console.log('支持的格式:', Object.keys(previewResult.formats || {}));
      console.log('\n标准格式预览 (前100字符):');
      console.log((previewResult.formats?.standard || '').substring(0, 100) + '...');
    } else {
      console.log('❌ 格式预览失败:', previewResponse.status);
    }

    console.log('\n🎉 测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 使用说明
function showUsage() {
  console.log(`
🔧 自动Markdown存储功能测试脚本

使用方法:
  1. 确保后端服务运行在 http://localhost:8787
  2. 获取有效的用户JWT令牌
  3. 编辑脚本中的 TEST_TOKEN 变量
  4. 运行脚本: node test-auto-storage.js

测试项目:
  1. 获取用户设置
  2. 更新用户设置  
  3. 获取存储统计
  4. 获取文件列表
  5. 文件名生成测试
  6. 格式预览测试

注意事项:
  - 需要先登录获取有效的JWT令牌
  - 确保数据库迁移已应用
  - 检查R2存储服务是否正常
`);
}

// 检查命令行参数
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// 检查令牌是否设置
if (TEST_TOKEN === 'your_test_token_here') {
  console.log('❌ 请先编辑脚本设置有效的TEST_TOKEN');
  console.log('💡 使用 --help 查看使用说明');
  process.exit(1);
}

// 运行测试
testAutoStorageAPIs();