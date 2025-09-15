#!/usr/bin/env node

/**
 * 诊断自动存储功能
 * 检查数据库中的用户设置和存储状态
 */

import { execSync } from 'child_process';

console.log('🔍 诊断自动存储功能...\n');

async function diagnoseStorage() {
  try {
    // 1. 检查用户表
    console.log('1️⃣ 检查用户表...');
    execSync('wrangler d1 execute news-db --command="SELECT id, email, created_at FROM users LIMIT 5;"', { stdio: 'inherit' });

    console.log('\n' + '='.repeat(50) + '\n');

    // 2. 检查用户自动存储设置表
    console.log('2️⃣ 检查用户自动存储设置表...');
    execSync('wrangler d1 execute news-db --command="SELECT * FROM user_auto_storage_settings LIMIT 5;"', { stdio: 'inherit' });

    console.log('\n' + '='.repeat(50) + '\n');

    // 3. 检查存储日志表
    console.log('3️⃣ 检查存储日志表...');
    execSync('wrangler d1 execute news-db --command="SELECT * FROM markdown_storage_logs ORDER BY created_at DESC LIMIT 5;"', { stdio: 'inherit' });

    console.log('\n' + '='.repeat(50) + '\n');

    // 4. 检查用户存储统计表
    console.log('4️⃣ 检查用户存储统计表...');
    execSync('wrangler d1 execute news-db --command="SELECT * FROM user_storage_statistics LIMIT 5;"', { stdio: 'inherit' });

    console.log('\n' + '='.repeat(50) + '\n');

    // 5. 检查是否有处理过的内容
    console.log('5️⃣ 检查处理过的内容...');
    execSync('wrangler d1 execute news-db --command="SELECT id, title, processed_at FROM processed_contents ORDER BY processed_at DESC LIMIT 5;"', { stdio: 'inherit' });

    console.log('\n' + '='.repeat(50) + '\n');

    // 6. 检查R2存储桶内容
    console.log('6️⃣ 检查R2存储桶内容...');
    try {
      execSync('wrangler r2 object list news-storage', { stdio: 'inherit' });
    } catch (error) {
      console.log('❌ 无法列出R2存储桶内容，可能需要先创建一些文件');
    }

    console.log('\n📋 诊断完成！');
    console.log('\n💡 如果发现以下情况，说明功能正常：');
    console.log('   - user_auto_storage_settings 表中有用户记录');
    console.log('   - processed_contents 表中有处理过的内容');
    console.log('   - markdown_storage_logs 表中有存储记录');
    console.log('\n💡 如果发现以下问题，需要修复：');
    console.log('   - user_auto_storage_settings 表为空：需要创建用户设置');
    console.log('   - 没有存储日志：自动存储功能可能未触发');
    console.log('   - R2存储桶为空：文件上传可能失败');

  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error.message);
  }
}

// 检查是否在正确的目录
try {
  import('./package.json');
  diagnoseStorage();
} catch (error) {
  console.log('❌ 请在backend目录下运行此脚本');
  console.log('   cd /work/llm/news/backend');
  console.log('   node diagnose-storage.js');
}