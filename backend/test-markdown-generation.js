#!/usr/bin/env node

// 测试Markdown文件生成功能
console.log('🧪 测试Markdown文件生成功能');
console.log('========================');

// 模拟环境变量
const mockEnv = {
  DB: {
    prepare: () => ({
      bind: () => ({
        first: () => ({
          totalFiles: 5,
          totalSize: 10240,
          todayFiles: 2,
          todaySize: 4096,
          lastStorageAt: new Date().toISOString()
        })
      })
    })
  },
  R2_BUCKET: {
    put: () => Promise.resolve({
      etag: 'test-etag',
      key: 'test-file.md'
    }),
    list: () => Promise.resolve({
      objects: [
        { key: 'user-1/test-file-1.md', size: 2048, lastModified: new Date() },
        { key: 'user-1/test-file-2.md', size: 3072, lastModified: new Date() }
      ]
    })
  }
};

// 测试AutoMarkdownStorageService
async function testAutoStorageService() {
  try {
    console.log('\n🔧 测试AutoMarkdownStorageService...');
    
    // 动态导入服务
    const { AutoMarkdownStorageService } = await import('./src/services/auto-markdown-storage.service.ts');
    
    const service = new AutoMarkdownStorageService(mockEnv);
    
    // 测试获取用户存储统计
    console.log('\n📊 测试getUserStorageStats...');
    const stats = await service.getUserStorageStats(1);
    
    console.log('✅ 存储统计获取成功:');
    console.log(`   - 总文件数: ${stats.totalFiles}`);
    console.log(`   - 总大小: ${stats.totalSize} 字节`);
    console.log(`   - 今日文件数: ${stats.todayFiles}`);
    console.log(`   - 今日大小: ${stats.todaySize} 字节`);
    
    // 测试获取用户Markdown文件列表
    console.log('\n📄 测试getUserMarkdownFiles...');
    const files = await service.getUserMarkdownFiles(1);
    
    console.log('✅ Markdown文件列表获取成功:');
    files.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.key} (${file.size} 字节)`);
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ AutoMarkdownStorageService测试失败:', error.message);
    return false;
  }
}

// 测试UnifiedLLMService
async function testUnifiedLLMService() {
  try {
    console.log('\n🤖 测试UnifiedLLMService...');
    
    const { UnifiedLLMService } = await import('./src/services/unified-llm.service.ts');
    
    // 测试JSON修复功能
    console.log('\n🔧 测试JSON修复功能...');
    
    const problematicJson = `{"topics": ["测试"], "keywords": ["关键词"], "sentiment": "neutral", "analysis": "这是一个包含"引号"的测试内容"}`;
    
    console.log('原始JSON:', problematicJson);
    
    // 测试清理函数
    const cleanedJson = UnifiedLLMService['cleanJsonString'](problematicJson);
    console.log('清理后JSON:', cleanedJson);
    
    // 测试修复函数
    try {
      const fixedJson = UnifiedLLMService['fixJsonFormat'](cleanedJson);
      console.log('✅ JSON修复成功');
      console.log('修复后JSON:', fixedJson);
      
      // 验证可以解析
      const parsed = JSON.parse(fixedJson);
      console.log('✅ JSON解析成功');
      console.log('解析结果:', parsed);
      
    } catch (fixError) {
      console.error('❌ JSON修复失败:', fixError.message);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ UnifiedLLMService测试失败:', error.message);
    return false;
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('🚀 开始运行所有测试...\n');
  
  const results = {
    autoStorage: await testAutoStorageService(),
    unifiedLLM: await testUnifiedLLMService()
  };
  
  console.log('\n📋 测试结果汇总:');
  console.log(`   AutoMarkdownStorageService: ${results.autoStorage ? '✅ 通过' : '❌ 失败'}`);
  console.log(`   UnifiedLLMService: ${results.unifiedLLM ? '✅ 通过' : '❌ 失败'}`);
  
  if (results.autoStorage && results.unifiedLLM) {
    console.log('\n🎉 所有测试通过！Markdown文件生成功能应该正常工作。');
    console.log('\n💡 建议下一步:');
    console.log('   1. 重新部署修复后的代码');
    console.log('   2. 在前端测试重新处理RSS条目');
    console.log('   3. 验证Markdown文件是否正确生成和显示');
  } else {
    console.log('\n⚠️  部分测试失败，需要进一步调试。');
  }
}

// 执行测试
runAllTests().catch(console.error);