#!/usr/bin/env node

/**
 * 演示如何查看和管理用户的markdown文件
 */

const API_BASE = 'http://localhost:8787/api';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MCwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsImlhdCI6MTc1Nzg2NTM5MSwiZXhwIjoxNzU3OTUxNzkxfQ.xdKF3QHpfjxjcaiaR60Vb-Dg8KuzKWT56PW0mw5ho6E';

console.log('📋 Markdown文件查看指南\n');

async function demonstrateFileAccess() {
  const headers = {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. 检查自动存储设置
    console.log('1️⃣ 检查用户自动存储设置...');
    const settingsResponse = await fetch(`${API_BASE}/user/auto-storage/settings`, {
      method: 'GET',
      headers
    });
    
    if (settingsResponse.ok) {
      const settings = await settingsResponse.json();
      console.log('✅ 自动存储设置:', JSON.stringify(settings, null, 2));
    } else {
      console.log('❌ 获取设置失败:', settingsResponse.status);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 2. 检查存储统计
    console.log('2️⃣ 检查存储统计...');
    const statsResponse = await fetch(`${API_BASE}/user/auto-storage/statistics`, {
      method: 'GET',
      headers
    });
    
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ 存储统计:', JSON.stringify(stats, null, 2));
    } else {
      console.log('❌ 获取统计失败:', statsResponse.status);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 3. 检查文件列表
    console.log('3️⃣ 检查Markdown文件列表...');
    const filesResponse = await fetch(`${API_BASE}/user/auto-storage/files`, {
      method: 'GET',
      headers
    });
    
    if (filesResponse.ok) {
      const files = await filesResponse.json();
      console.log('✅ 文件列表:', JSON.stringify(files, null, 2));
    } else {
      console.log('❌ 获取文件列表失败:', filesResponse.status);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 4. 演示手动存储现有内容
    console.log('4️⃣ 演示如何手动存储现有内容...');
    console.log('我们可以通过以下方式手动存储已处理的内容：');
    console.log('');
    console.log('方法1: 使用管理员API触发重新生成');
    console.log('POST /api/admin/auto-storage/regenerate/:processedContentId');
    console.log('');
    console.log('方法2: 通过数据库直接创建存储记录');
    console.log('(这已经在之前的步骤中完成)');
    console.log('');
    console.log('方法3: 等待新内容自动触发存储');
    console.log('(系统会在新内容处理完成后自动存储)');

    console.log('\n' + '='.repeat(50) + '\n');

    // 5. 提供查看文件的多种方式
    console.log('5️⃣ 查看Markdown文件的多种方式:');
    console.log('');
    console.log('📱 **API方式**:');
    console.log('   GET /api/user/auto-storage/files');
    console.log('   GET /api/user/auto-storage/download/:filename');
    console.log('');
    console.log('💻 **命令行方式**:');
    console.log('   wrangler r2 object get news-storage/notes/your-file.md');
    console.log('');
    console.log('🌐 **Web界面**:');
    console.log('   通过Cloudflare R2控制台查看');
    console.log('   配置Obsidian同步后直接在Obsidian中查看');
    console.log('');
    console.log('📂 **本地文件**:');
    console.log('   我们已经创建了示例文件:');
    console.log('   - 中国8月末社会融资规模存量433_66万亿元_同比增8_8_5_2025-09-14.md');
    console.log('   - 商务部新闻发言人就中美在西班牙举行会谈事答记者问_6_2025-09-14.md');

  } catch (error) {
    console.error('❌ 演示过程中发生错误:', error.message);
  }
}

// 运行演示
demonstrateFileAccess().then(() => {
  console.log('\n✅ 演示完成！');
}).catch(error => {
  console.error('❌ 演示失败:', error.message);
});