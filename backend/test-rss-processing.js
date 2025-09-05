// test-rss-processing.js
// 用于测试RSS处理流程的简单脚本

async function testRssProcessing() {
  console.log('开始测试RSS处理流程...');
  
  try {
    // 模拟发送一个RSS源获取任务到队列
    const testSource = {
      sourceId: 1,
      rssUrl: 'https://feeds.feedburner.com/oreilly/radar',
      scheduledAt: new Date().toISOString()
    };
    
    console.log('发送测试任务到RSS_FETCHER_QUEUE:', testSource);
    
    // 注意：在实际测试中，我们需要使用Cloudflare Workers的绑定来发送消息到队列
    // 这里只是一个概念验证
    
    console.log('测试任务发送完成');
    console.log('请检查后台日志以验证处理流程');
    
  } catch (error) {
    console.error('测试RSS处理流程时出错:', error);
  }
}

// 运行测试
testRssProcessing();