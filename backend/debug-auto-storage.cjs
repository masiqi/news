// 调试自动存储系统的脚本
const { drizzle } = require('drizzle-orm/d1');
const { eq } = require('drizzle-orm');
const { users, rssEntries, sources, processedContents } = require('./src/db/schema');

// 模拟D1数据库
class MockD1 {
  constructor() {
    this.data = {
      users: [
        { id: 1, email: 'test@example.com', password: '$2b$10$rOZXp7mGXmHWK7vJtxB7uO5D3Q7J8Y.k9W2mQ7J8Y.k9W2mQ7J8Y.k9W2', createdAt: new Date(), updatedAt: new Date() }
      ],
      rssEntries: [
        { id: 1, sourceId: 1, guid: 'test-1', title: '测试文章1', link: 'https://example.com/1', content: '测试内容1', publishedAt: new Date(), createdAt: new Date() },
        { id: 2, sourceId: 1, guid: 'test-2', title: '测试文章2', link: 'https://example.com/2', content: '测试内容2', publishedAt: new Date(), createdAt: new Date() }
      ],
      processedContents: [
        { id: 1, entryId: 1, title: '测试文章1', summary: '测试摘要1', content: '测试处理后的内容1', keywords: '["测试", "文章"]', categories: '["技术"]', sentiment: 'positive', importance: 3, readability: 4, processingTime: 1000, aiTokensUsed: 500, aiModel: 'glm-4.5-flash', aiProvider: 'ZhipuAI', status: 'completed', createdAt: new Date() }
      ]
    };
  }

  async prepare(query) {
    return this;
  }

  async all() {
    return [];
  }

  async get() {
    return null;
  }

  async run() {
    return { success: true };
  }

  async values() {
    return [];
  }
}

async function debugAutoStorage() {
  console.log('🔍 开始调试自动存储系统...');
  
  // 模拟环境变量
  const env = {
    DB: new MockD1(),
    R2_BUCKET: {
      put: async (key, value) => {
        console.log(`📁 模拟R2存储: ${key}, 大小: ${typeof value === 'string' ? value.length : value.byteLength} 字节`);
        return { key, size: typeof value === 'string' ? value.length : value.byteLength };
      },
      get: async (key) => {
        console.log(`📖 模拟R2读取: ${key}`);
        return null;
      },
      list: async (options = {}) => {
        console.log(`📋 模拟R2列表:`, options);
        return { objects: [] };
      },
      delete: async (key) => {
        console.log(`🗑️ 模拟R2删除: ${key}`);
        return {};
      }
    }
  };

  // 导入服务
  const { UserAutoStorageService } = require('./src/services/user-auto-storage.service');
  const { AutoMarkdownStorageService } = require('./src/services/auto-markdown-storage.service');

  // 初始化服务
  const storageConfigService = new UserAutoStorageService(env.DB);
  const autoStorageService = new AutoMarkdownStorageService(env);

  try {
    // 1. 检查用户配置
    console.log('\n📋 1. 检查用户自动存储配置...');
    const userConfig = await storageConfigService.getUserConfig(1);
    console.log('用户配置:', userConfig);

    // 2. 检查是否启用自动存储
    console.log('\n🔧 2. 检查自动存储状态...');
    const isEnabled = await storageConfigService.isAutoStorageEnabled(1);
    console.log('自动存储启用状态:', isEnabled);

    // 3. 检查每日配额
    console.log('\n📊 3. 检查每日配额...');
    const quotaCheck = await storageConfigService.checkDailyQuota(1);
    console.log('配额检查:', quotaCheck);

    // 4. 尝试处理和存储markdown
    console.log('\n📝 4. 尝试生成和存储markdown文件...');
    
    // 模拟分析结果
    const mockAnalysisResult = {
      id: 'test-1',
      title: '测试文章1：AI技术发展趋势',
      content: '这是关于AI技术发展趋势的详细内容...',
      summary: '本文详细分析了当前AI技术的发展趋势和未来展望。',
      keywords: ['AI', '技术', '趋势', '发展'],
      categories: ['技术', '人工智能'],
      sentiment: 'positive',
      importance: 4,
      readability: 5,
      processingTime: 1500,
      aiTokensUsed: 800,
      aiModel: 'glm-4.5-flash',
      aiProvider: 'ZhipuAI',
      status: 'completed'
    };

    const mockOriginalContent = '这是原始的RSS内容，包含关于AI技术发展趋势的详细信息...';

    const storageResult = await autoStorageService.processAndStoreMarkdown({
      userId: 1,
      sourceId: 1,
      entryId: 1,
      analysisResult: mockAnalysisResult,
      originalContent: mockOriginalContent,
      metadata: {
        userId: 1,
        sourceId: 1,
        entryId: 1,
        title: '测试文章1：AI技术发展趋势',
        sourceName: '测试源',
        processedAt: new Date()
      }
    });

    console.log('存储结果:', storageResult);

    // 5. 检查文件列表
    console.log('\n📂 5. 检查存储的文件列表...');
    const files = await autoStorageService.getUserMarkdownFiles(1);
    console.log('用户文件列表:', files);

    // 6. 检查统计信息
    console.log('\n📈 6. 检查存储统计...');
    const stats = await autoStorageService.getUserStorageStats(1);
    console.log('存储统计:', stats);

  } catch (error) {
    console.error('❌ 调试过程中发生错误:', error);
  }
}

// 运行调试
debugAutoStorage().then(() => {
  console.log('\n✅ 调试完成');
}).catch(error => {
  console.error('❌ 调试失败:', error);
});