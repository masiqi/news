#!/usr/bin/env node

/**
 * 网页内容抓取和解析手工测试脚本
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:8787';
const TOKEN = 'development_jwt_secret_key_for_local_testing_only';

// 您提到的具体条目
const TEST_ENTRY = {
  id: 37,
  title: '纪念中国人民抗日战争暨世界反法西斯战争胜利80周年图片展暨电影周在比利时揭幕',
  link: 'http://www.chinanews.com/hr/2025/09-07/10477972.shtml'
};

async function testWebContentExtraction() {
  console.log('🌐 开始网页内容抓取和解析测试...\n');
  console.log(`📋 测试条目: ${TEST_ENTRY.title}`);
  console.log(`🔗 链接地址: ${TEST_ENTRY.link}\n`);

  try {
    // 1. 测试获取条目信息
    console.log('📖 1. 获取条目信息...');
    const entryResponse = await fetch(`${API_BASE}/api/sources/entries/${TEST_ENTRY.id}`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!entryResponse.ok) {
      throw new Error(`获取条目信息失败: ${entryResponse.status} ${entryResponse.statusText}`);
    }
    
    const entryData = await entryResponse.json();
    console.log('✅ 条目信息获取成功:');
    console.log(JSON.stringify(entryData.data, null, 2));
    
    // 2. 测试网页内容抓取
    console.log('\n🌐 2. 开始抓取网页内容...');
    const webContentResponse = await fetch(`${API_BASE}/api/web-content/fetch/${TEST_ENTRY.id}`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!webContentResponse.ok) {
      throw new Error(`网页内容抓取失败: ${webContentResponse.status} ${webContentResponse.statusText}`);
    }
    
    const webContentData = await webContentResponse.json();
    console.log('✅ 网页内容抓取成功:');
    console.log(`   - 标题: ${webContentData.data.webContent.title}`);
    console.log(`   - 字数: ${webContentData.data.webContent.wordCount}`);
    console.log(`   - 图片数: ${webContentData.data.webContent.images.length}`);
    console.log(`   - 链接数: ${webContentData.data.webContent.links.length}`);
    
    // 3. 显示抓取的内容
    console.log('\n📝 3. 抓取的网页正文:');
    console.log(`   ${webContentData.data.webContent.content.substring(0, 300)}...\n`);
    
    // 4. 显示提取的图片
    console.log('🖼️  4. 提取的图片:');
    webContentData.data.webContent.images.slice(0, 5).forEach((img, index) => {
      console.log(`   ${index + 1}. ${img}`);
    });
    
    // 5. 显示提取的相关链接
    console.log('\n🔗 5. 提取的相关链接:');
    webContentData.data.webContent.links.slice(0, 5).forEach((link, index) => {
      console.log(`   ${index + 1}. ${link}`);
    });
    
    // 6. 测试主题提取
    console.log('\n🎯 6. 开始主题提取...');
    const topicResponse = await fetch(`${API_BASE}/api/topics/extract/${TEST_ENTRY.id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: webContentData.data.webContent.content,
        title: webContentData.data.webContent.title
      })
    });
    
    if (!topicResponse.ok) {
      throw new Error(`主题提取失败: ${topicResponse.status} ${topicResponse.statusText}`);
    }
    
    const topicData = await topicResponse.json();
    console.log('✅ 主题提取成功:');
    console.log(`   - 提取主题: ${topicData.data.topics.join(', ')}`);
    console.log(`   - 关键词: ${topicData.data.keywords.join(', ')}`);
    console.log(`   - 使用模型: ${topicData.data.modelUsed}`);
    console.log(`   - 处理耗时: ${topicData.data.processingTime}ms`);
    
    // 7. 获取保存的主题信息
    console.log('\n📊 7. 获取保存的主题信息...');
    const savedTopicResponse = await fetch(`${API_BASE}/api/topics/${TEST_ENTRY.id}`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (savedTopicResponse.ok) {
      const savedTopicData = await savedTopicResponse.json();
      console.log('✅ 保存的主题信息:');
      console.log(JSON.stringify(savedTopicData.data, null, 2));
    } else {
      console.log('ℹ️ 主题信息尚未保存或获取失败');
    }
    
    // 8. 获取网页内容统计
    console.log('\n📈 8. 获取网页内容统计...');
    const statsResponse = await fetch(`${API_BASE}/api/web-content/stats`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      console.log('✅ 网页内容统计:');
      console.log(`   - 总条目数: ${statsData.data.stats.totalEntries}`);
      console.log(`   - 有网页内容: ${statsData.data.stats.withWebContent}`);
      console.log(`   - 无网页内容: ${statsData.data.stats.withoutWebContent}`);
      console.log(`   - 内容覆盖率: ${statsData.data.insights.contentCoverage}`);
      console.log(`   - 平均字数: ${statsData.data.insights.avgContentLength}`);
    }
    
    console.log('\n🎉 网页内容抓取和解析测试完成！');
    
    // 9. 输出分析报告
    console.log('\n📋 分析报告:');
    console.log('==========================================');
    console.log(`📰 原始信息:`);
    console.log(`   - 标题: ${TEST_ENTRY.title}`);
    console.log(`   - 链接: ${TEST_ENTRY.link}`);
    console.log(`   - 条目ID: ${TEST_ENTRY.id}`);
    console.log('');
    console.log(`🌐 内容抓取:`);
    console.log(`   - 状态: 成功`);
    console.log(`   - 字数: ${webContentData.data.webContent.wordCount}`);
    console.log(`   - 图片: ${webContentData.data.webContent.images.length}`);
    console.log(`   - 链接: ${webContentData.data.webContent.links.length}`);
    console.log('');
    console.log(`🎯 主题分析:`);
    console.log(`   - 主题: ${topicData.data.topics.join(', ')}`);
    console.log(`   - 关键词: ${topicData.data.keywords.join(', ')}`);
    console.log(`   - 模型: ${topicData.data.modelUsed}`);
    console.log(`   - 耗时: ${topicData.data.processingTime}ms`);
    console.log('==========================================');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// 使用说明
function showUsage() {
  console.log('📖 网页内容抓取和解析测试工具');
  console.log('=====================================');
  console.log('这个工具会:');
  console.log('1. 从RSS条目获取链接信息');
  console.log('2. 抓取指定网页的HTML内容');
  console.log('3. 解析HTML，提取标题、正文、图片、链接');
  console.log('4. 清理HTML标签，生成纯文本内容');
  console.log('5. 提取主题和关键词（AI分析）');
  console.log('6. 保存处理结果到数据库');
  console.log('7. 生成详细的分析报告');
  console.log('');
  console.log('🚀 开始测试:');
  console.log('node test-web-content.js');
  console.log('');
  console.log('📝 测试配置:');
  console.log(`测试条目ID: ${TEST_ENTRY.id}`);
  console.log(`测试标题: ${TEST_ENTRY.title}`);
  console.log(`测试链接: ${TEST_ENTRY.link}`);
}

// 如果直接运行此脚本
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

if (require.main === module) {
  console.log('🌐 网页内容抓取和解析测试工具');
  console.log('=====================================\n');
  console.log(`📋 当前测试条目:`);
  console.log(`   ID: ${TEST_ENTRY.id}`);
  console.log(`   标题: ${TEST_ENTRY.title}`);
  console.log(`   链接: ${TEST_ENTRY.link}\n`);
  
  testWebContentExtraction().catch(console.error);
}

module.exports = { testWebContentExtraction, TEST_ENTRY };