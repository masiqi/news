#!/usr/bin/env node

/**
 * 查看用户Markdown文件脚本
 * 帮助用户找到和查看自动生成的markdown文件
 */

const API_BASE = 'http://localhost:8787/api';

// 需要替换为你的实际JWT token
// 可以从浏览器开发者工具的Application > Cookies > token 中获取
const USER_TOKEN = 'your_jwt_token_here';

async function viewMarkdownFiles() {
  console.log('🔍 查看用户Markdown文件...\n');

  const headers = {
    'Authorization': `Bearer ${USER_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. 获取用户存储统计
    console.log('1️⃣ 获取存储统计信息...');
    const statsResponse = await fetch(`${API_BASE}/user/auto-storage/statistics`, {
      headers
    });

    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ 存储统计:');
      console.log(`   总文件数: ${stats.statistics?.totalFiles || 0}`);
      console.log(`   总大小: ${formatBytes(stats.statistics?.totalSize || 0)}`);
      console.log(`   今日文件: ${stats.statistics?.todayFiles || 0}`);
      console.log(`   今日大小: ${formatBytes(stats.statistics?.todaySize || 0)}`);
      console.log(`   最后存储: ${stats.statistics?.lastStorageAt || '无'}`);
      console.log(`   自动存储: ${stats.statistics?.config?.enabled ? '启用' : '禁用'}`);
      console.log(`   存储路径: ${stats.statistics?.config?.storagePath || 'notes'}`);
    } else {
      console.log('❌ 获取存储统计失败:', statsResponse.status);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 2. 获取文件列表
    console.log('2️⃣ 获取Markdown文件列表...');
    const filesResponse = await fetch(`${API_BASE}/user/auto-storage/files`, {
      headers
    });

    if (filesResponse.ok) {
      const filesData = await filesResponse.json();
      const files = filesData.files || [];
      
      console.log(`✅ 找到 ${files.length} 个Markdown文件:\n`);
      
      if (files.length === 0) {
        console.log('   暂无Markdown文件');
        console.log('   可能的原因:');
        console.log('   1. 自动存储功能未启用');
        console.log('   2. 刚刚处理的内容还未生成文件');
        console.log('   3. 配置问题导致存储失败');
      } else {
        files.forEach((file, index) => {
          console.log(`${index + 1}. ${file.key}`);
          console.log(`   大小: ${formatBytes(file.size)}`);
          console.log(`   修改时间: ${new Date(file.lastModified).toLocaleString('zh-CN')}`);
          console.log('');
        });
      }
    } else {
      console.log('❌ 获取文件列表失败:', filesResponse.status);
      const errorText = await filesResponse.text();
      console.log('错误详情:', errorText);
    }

    console.log('='.repeat(50) + '\n');

    // 3. 获取用户设置
    console.log('3️⃣ 检查用户自动存储设置...');
    const settingsResponse = await fetch(`${API_BASE}/user/auto-storage/settings`, {
      headers
    });

    if (settingsResponse.ok) {
      const settings = await settingsResponse.json();
      console.log('✅ 当前设置:');
      console.log(`   启用状态: ${settings.settings?.enabled ? '✅ 启用' : '❌ 禁用'}`);
      console.log(`   存储路径: ${settings.settings?.storagePath}`);
      console.log(`   文件格式: ${settings.settings?.fileFormat}`);
      console.log(`   文件名模式: ${settings.settings?.filenamePattern}`);
      console.log(`   最大文件大小: ${formatBytes(settings.settings?.maxFileSize || 0)}`);
      console.log(`   每日限制: ${settings.settings?.maxFilesPerDay} 文件/天`);
      console.log(`   包含元数据: ${settings.settings?.includeMetadata ? '是' : '否'}`);
    } else {
      console.log('❌ 获取用户设置失败:', settingsResponse.status);
    }

  } catch (error) {
    console.error('❌ 查询过程中发生错误:', error);
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
🔍 Markdown文件查看工具

使用方法:
  1. 从浏览器获取JWT token:
     - 打开前端应用 (http://localhost:3000)
     - 登录你的账号
     - 按F12打开开发者工具
     - 切换到 Application 标签
     - 在左侧找到 Storage > Cookies > http://localhost:3000
     - 找到 token 字段，复制其值
  2. 编辑此脚本，替换 USER_TOKEN 的值
  3. 运行脚本: node view-markdown-files.js

功能:
  - 查看存储统计信息
  - 列出所有Markdown文件
  - 检查自动存储设置
  - 诊断常见问题

其他查看方式:
  1. 直接访问R2存储桶
  2. 使用Cloudflare控制台
  3. 通过Obsidian等工具同步
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
  console.log('💡 使用 --help 查看详细使用说明');
  process.exit(1);
}

// 运行主函数
viewMarkdownFiles();