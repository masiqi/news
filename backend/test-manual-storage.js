#!/usr/bin/env node

/**
 * 手动触发Markdown存储测试脚本
 * 用于测试自动存储功能是否正常工作
 */

const API_BASE = 'http://localhost:8787/api';

// 使用管理员登录获取token
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MCwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsImlhdCI6MTc1Nzg2NTM5MSwiZXhwIjoxNzU3OTUxNzkxfQ.xdKF3QHpfjxjcaiaR60Vb-Dg8KuzKWT56PW0mw5ho6E';

async function testManualStorage() {
  console.log('🧪 手动触发Markdown存储测试...\n');

  const headers = {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. 首先检查用户设置
    console.log('1️⃣ 检查用户自动存储设置...');
    const settingsResponse = await fetch(`${API_BASE}/user/auto-storage/settings`, {
      headers
    });

    let userSettings;
    if (settingsResponse.ok) {
      const settingsData = await settingsResponse.json();
      userSettings = settingsData.settings;
      console.log('✅ 当前用户设置:');
      console.log(`   启用状态: ${userSettings.enabled ? '✅ 启用' : '❌ 禁用'}`);
      console.log(`   存储路径: ${userSettings.storagePath}`);
      console.log(`   文件格式: ${userSettings.fileFormat}`);
      
      if (!userSettings.enabled) {
        console.log('\n⚠️  自动存储功能未启用，正在启用...');
        await enableAutoStorage(headers);
      }
    } else {
      console.log('❌ 获取用户设置失败:', settingsResponse.status);
      return;
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 2. 检查现有的内容条目
    console.log('2️⃣ 查找可处理的内容条目...');
    const contentResponse = await fetch(`${API_BASE}/content?limit=5`, {
      headers
    });

    if (contentResponse.ok) {
      const contentData = await contentResponse.json();
      const contents = contentData.contents || [];
      
      console.log(`✅ 找到 ${contents.length} 个内容条目:`);
      
      if (contents.length === 0) {
        console.log('   没有找到任何内容条目');
        console.log('   请先确保RSS源已抓取内容');
        return;
      }

      // 显示前几个条目
      contents.slice(0, 3).forEach((content, index) => {
        console.log(`\n${index + 1}. ID: ${content.id}`);
        console.log(`   标题: ${content.title}`);
        console.log(`   来源: ${content.sourceName}`);
        console.log(`   发布时间: ${content.publishedAt}`);
        console.log(`   有Web内容: ${content.webContent ? '是' : '否'}`);
        console.log(`   处理时间: ${content.processedAt}`);
      });

      // 选择第一个条目进行测试
      const testEntry = contents[0];
      console.log(`\n🎯 选择条目 ${testEntry.id} 进行存储测试`);

      console.log('\n' + '='.repeat(50) + '\n');

      // 3. 尝试重新生成该条目的Markdown文件
      console.log('3️⃣ 重新生成Markdown文件...');
      const regenerateResponse = await fetch(`${API_BASE}/user/auto-storage/regenerate/${testEntry.id}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ force: true })
      });

      if (regenerateResponse.ok) {
        const regenerateResult = await regenerateResponse.json();
        console.log('✅ 重新生成成功!');
        console.log(`   文件路径: ${regenerateResult.result?.filePath || '未知'}`);
        console.log(`   文件大小: ${formatBytes(regenerateResult.result?.fileSize || 0)}`);
        console.log(`   处理时间: ${regenerateResult.result?.processingTime || 0}ms`);
      } else {
        const errorText = await regenerateResponse.text();
        console.log('❌ 重新生成失败:', regenerateResponse.status);
        console.log('错误详情:', errorText);
      }

    } else {
      console.log('❌ 获取内容列表失败:', contentResponse.status);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 4. 再次检查文件列表
    console.log('4️⃣ 检查生成的Markdown文件...');
    await checkFiles(headers);

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

async function enableAutoStorage(headers) {
  const response = await fetch(`${API_BASE}/user/auto-storage/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      enabled: true,
      storagePath: 'notes',
      filenamePattern: '{title}_{id}_{date}',
      fileFormat: 'standard',
      maxFileSize: 1048576,
      maxFilesPerDay: 100,
      includeMetadata: true
    })
  });

  if (response.ok) {
    console.log('✅ 自动存储功能已启用');
  } else {
    console.log('❌ 启用自动存储失败:', response.status);
  }
}

async function checkFiles(headers) {
  const filesResponse = await fetch(`${API_BASE}/user/auto-storage/files`, {
    headers
  });

  if (filesResponse.ok) {
    const filesData = await filesResponse.json();
    const files = filesData.files || [];
    
    console.log(`当前有 ${files.length} 个Markdown文件:`);
    
    if (files.length > 0) {
      files.forEach((file, index) => {
        console.log(`\n${index + 1}. ${file.key}`);
        console.log(`   大小: ${formatBytes(file.size)}`);
        console.log(`   修改时间: ${new Date(file.lastModified).toLocaleString('zh-CN')}`);
      });
    } else {
      console.log('   暂无Markdown文件');
    }
  } else {
    console.log('❌ 获取文件列表失败:', filesResponse.status);
  }
}

// 格式化字节数
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 显示使用说明
function showUsage() {
  console.log(`
🧪 手动Markdown存储测试工具

用途:
  - 测试自动存储功能是否正常工作
  - 手动触发特定内容的Markdown生成
  - 检查和修复用户设置
  - 查看生成的文件

使用方法:
  1. 从浏览器获取JWT token
  2. 编辑脚本中的 USER_TOKEN
  3. 运行: node test-manual-storage.js

测试流程:
  1. 检查用户自动存储设置
  2. 查找可处理的内容条目
  3. 重新生成选定条目的Markdown
  4. 检查生成的文件列表
`);
}

// 检查命令行参数
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// 检查令牌是否设置
if (USER_TOKEN === 'your_jwt_token_here') {
  console.log('❌ 请先编辑脚本设置有效的USER_TOKEN');
  console.log('💡 使用 --help 查看使用说明');
  process.exit(1);
}

// 运行主函数
testManualStorage();