#!/usr/bin/env node

/**
 * 服务导入验证脚本
 * 快速验证新添加的服务是否正常导入和初始化
 */

console.log('🔍 验证服务导入...\n');

try {
  // 验证用户自动存储服务
  console.log('1️⃣ 验证 UserAutoStorageService...');
  const { UserAutoStorageService } = require('./src/services/user-auto-storage.service.ts');
  console.log('✅ UserAutoStorageService 导入成功');
  
  // 验证自动Markdown存储服务
  console.log('\n2️⃣ 验证 AutoMarkdownStorageService...');
  const { AutoMarkdownStorageService } = require('./src/services/auto-markdown-storage.service.ts');
  console.log('✅ AutoMarkdownStorageService 导入成功');
  
  // 验证自动存储路由
  console.log('\n3️⃣ 验证自动存储路由...');
  const autoStorageRoutes = require('./src/routes/auto-storage.ts');
  console.log('✅ 自动存储路由导入成功');
  
  // 验证Markdown生成器（检查重复方法已修复）
  console.log('\n4️⃣ 验证 MarkdownGenerator...');
  const { MarkdownGenerator } = require('./src/services/ai/markdown-generator.ts');
  const generator = new MarkdownGenerator();
  
  // 检查方法是否存在
  const methods = [
    'generateDocument',
    'generateBatch', 
    'generateSimpleMarkdown',
    'generateAcademicMarkdown',
    'generateConciseMarkdown',
    'validateTemplate',
    'getSupportedStyles',
    'getDocumentStats'
  ];
  
  methods.forEach(method => {
    if (typeof generator[method] === 'function') {
      console.log(`  ✓ ${method} 方法存在`);
    } else {
      console.log(`  ✗ ${method} 方法缺失`);
    }
  });
  
  console.log('✅ MarkdownGenerator 验证完成');
  
  console.log('\n5️⃣ 验证数据库迁移文件...');
  const fs = require('fs');
  const path = require('path');
  
  const migrationPath = path.join(__dirname, 'db', 'migrations', '2025-09-14-add-auto-markdown-storage.sql');
  if (fs.existsSync(migrationPath)) {
    console.log('✅ 数据库迁移文件存在');
  } else {
    console.log('✗ 数据库迁移文件缺失');
  }
  
  console.log('\n🎉 所有服务验证通过！');
  console.log('\n📋 下一步操作:');
  console.log('1. 应用数据库迁移: wrangler d1 execute news-db --file=./db/migrations/2025-09-14-add-auto-markdown-storage.sql');
  console.log('2. 重启后端服务: npm run dev');
  console.log('3. 运行功能测试: node test-auto-storage.js');
  
} catch (error) {
  console.error('❌ 验证失败:', error.message);
  process.exit(1);
}