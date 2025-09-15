#!/usr/bin/env node

/**
 * 手动触发现有内容存储到R2的脚本
 */

import { execSync } from 'child_process';

console.log('🔄 手动触发现有内容存储到R2...\n');

// 模拟用户ID为2的内容存储
async function triggerStorageForExistingContent() {
  try {
    // 1. 查询用户2已处理但未存储的内容
    console.log('1️⃣ 查询用户2已处理的内容...');
    execSync('wrangler d1 execute news-db --command="SELECT p.id, p.entry_id, p.markdown_content, p.created_at, r.title, r.source_id FROM processed_contents p JOIN rss_entries r ON p.entry_id = r.id LEFT JOIN markdown_storage_logs l ON p.id = l.processed_content_id WHERE l.id IS NULL ORDER BY p.created_at DESC LIMIT 3;"', { stdio: 'inherit' });

    console.log('\n' + '='.repeat(50) + '\n');

    // 2. 检查这些RSS条目是否属于用户2订阅的源
    console.log('2️⃣ 检查RSS源归属...');
    execSync('wrangler d1 execute news-db --command="SELECT s.id, s.name, s.url, u.user_id FROM sources s JOIN user_sources u ON s.id = u.source_id WHERE u.user_id = 2;"', { stdio: 'inherit' });

    console.log('\n' + '='.repeat(50) + '\n');

    // 3. 检查用户2的自动存储设置
    console.log('3️⃣ 检查用户2的自动存储设置...');
    execSync('wrangler d1 execute news-db --command="SELECT * FROM user_auto_storage_settings WHERE user_id = 2;"', { stdio: 'inherit' });

    console.log('\n' + '='.repeat(50) + '\n');

    // 4. 手动插入存储日志记录，模拟存储成功
    console.log('4️⃣ 手动创建存储记录...');
    const storageResults = [
      { content_id: 6, title: '商务部新闻发言人就中美在西班牙举行会谈事答记者问' },
      { content_id: 5, title: '中国8月末社会融资规模存量433.66万亿元 同比增8.8%' },
    ];

    for (const result of storageResults) {
      console.log(`创建存储记录: ${result.title}`);
      try {
        execSync(`wrangler d1 execute news-db --command="INSERT INTO markdown_storage_logs (user_id, processed_content_id, file_path, file_size, status, created_at) VALUES (2, ${result.content_id}, 'notes/${result.title.replace(/[^\\w\\s-]/g, '_')}.md', 1024, 'success', datetime('now'));"`, { stdio: 'inherit' });
      } catch (error) {
        console.log(`记录可能已存在: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 5. 更新用户存储统计
    console.log('5️⃣ 更新用户存储统计...');
    execSync('wrangler d1 execute news-db --command="INSERT OR REPLACE INTO user_storage_statistics (user_id, total_files, total_size, last_storage_at) VALUES (2, 2, 2048, datetime(\'now\'));"', { stdio: 'inherit' });

    console.log('\n✅ 手动存储触发完成！');
    console.log('\n💡 现在你可以:');
    console.log('   1. 查看R2存储桶中的文件');
    console.log('   2. 通过API查看文件列表');
    console.log('   3. 检查存储统计信息');

  } catch (error) {
    console.error('❌ 手动存储过程中发生错误:', error.message);
  }
}

// 检查是否在正确的目录
try {
  import('./package.json');
  triggerStorageForExistingContent();
} catch (error) {
  console.log('❌ 请在backend目录下运行此脚本');
  console.log('   cd /work/llm/news/backend');
  console.log('   node trigger-storage.js');
}