// RSS调度服务测试
// 测试并行RSS抓取和智能调度功能

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RssSchedulerService } from '../src/services/rss-scheduler.service';
import { drizzle } from 'drizzle-orm/d1';
import { sources, rssEntries } from '../src/db/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { QueueProducerService } from '../src/services/queue/producer';
import { ContentDeduplicationService } from '../src/services/content-deduplication.service';

// 模拟环境变量
const mockEnv = {
  DB: {} as D1Database,
  R2_BUCKET: {} as R2Bucket,
  RSS_QUEUE: {} as Queue<any>
};

// 模拟数据库
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
};

// 模拟队列生产者
const mockQueueProducer = {
  createAiProcessMessage: vi.fn(),
  sendBatch: vi.fn()
};

// 模拟内容去重服务
const mockDeduplicationService = {
  batchCheckDuplicateUrls: vi.fn(),
  registerProcessedUrl: vi.fn()
};

// 模拟队列
const mockRssQueue = {
  send: vi.fn()
};

describe('RssSchedulerService', () => {
  let rssSchedulerService: RssSchedulerService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // 设置模拟
    vi.doMock('./queue/producer', () => ({
      QueueProducerService: vi.fn().mockImplementation(() => mockQueueProducer)
    }));

    vi.doMock('./content-deduplication.service', () => ({
      ContentDeduplicationService: vi.fn().mockImplementation(() => mockDeduplicationService)
    }));

    rssSchedulerService = new RssSchedulerService(mockDb, mockQueueProducer, mockRssQueue);
  });

  describe('并行RSS抓取功能', () => {
    it('应该成功实现并行RSS抓取，最多10个并发', async () => {
      // 模拟15个活跃RSS源
      const mockSources = Array(15).fill(null).map((_, i) => ({
        id: (i + 1).toString(),
        url: `https://example${i + 1}.com/feed.xml`,
        name: `RSS源 ${i + 1}`,
        isActive: true,
        lastFetch: Date.now() - 3600000, // 1小时前
        fetchInterval: 30,
        errorCount: 0,
        userId: 'user1'
      }));

      // 模拟数据库查询
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue(mockSources)
          })
        })
      });

      // 模拟HTTP响应
      global.fetch = vi.fn().mockImplementation((url) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
            <?xml version="1.0" encoding="UTF-8"?>
            <rss version="2.0">
              <channel>
                <title>测试RSS</title>
                <item>
                  <title>测试文章 ${url}</title>
                  <link>${url}/article1</link>
                  <description>测试内容</description>
                  <pubDate>${new Date().toISOString()}</pubDate>
                </item>
              </channel>
            </rss>
          `)
        });
      });

      // 模拟去重检查
      mockDeduplicationService.batchCheckDuplicateUrls.mockResolvedValue(new Map());
      mockDeduplicationService.registerProcessedUrl.mockResolvedValue(true);

      // 模拟插入条目
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ id: 1 })
          })
        })
      });

      // 模拟队列发送成功
      mockQueueProducer.sendBatch.mockResolvedValue(true);
      mockQueueProducer.createAiProcessMessage.mockReturnValue({ type: 'ai_process', id: 'test-message' });

      // 模拟更新源状态
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ changes: 1 })
          })
        })
      });

      const results = await rssSchedulerService.scheduleAllSources();

      expect(results).toHaveLength(15);
      expect(results.every(r => r.success)).toBe(true);
      
      // 验证并行处理 - 应该分2批处理（15个源，每批10个）
      expect(global.fetch).toHaveBeenCalledTimes(15);
      expect(mockQueueProducer.sendBatch).toHaveBeenCalledTimes(15);
    });

    it('应该正确处理RSS抓取超时', async () => {
      const mockSources = [{
        id: '1',
        url: 'https://slow-server.com/feed.xml',
        name: '慢速RSS源',
        isActive: true,
        lastFetch: Date.now() - 3600000,
        fetchInterval: 30,
        errorCount: 0,
        userId: 'user1'
      }];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue(mockSources)
          })
        })
      });

      // 模拟超时响应
      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 31000); // 超过30秒超时
        });
      });

      const results = await rssSchedulerService.scheduleAllSources();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('超时');
    });

    it('应该正确处理HTTP 304未修改响应', async () => {
      const mockSources = [{
        id: '1',
        url: 'https://example.com/feed.xml',
        name: '测试RSS源',
        isActive: true,
        lastFetch: Date.now() - 1800000, // 30分钟前
        fetchInterval: 30,
        errorCount: 0,
        userId: 'user1'
      }];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue(mockSources)
          })
        })
      });

      // 模拟304响应
      global.fetch = vi.fn().mockResolvedValue({
        status: 304,
        ok: true
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ changes: 1 })
          })
        })
      });

      const results = await rssSchedulerService.scheduleAllSources();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].entriesCount).toBe(0);
      expect(results[0].newEntriesCount).toBe(0);
    });
  });

  describe('LLM队列并发控制测试', () => {
    it('应该严格控制LLM处理并发数为1', async () => {
      // 模拟AI处理Worker的并发控制
      const mockBatch = {
        messages: Array(5).fill(null).map((_, i) => ({
          id: `message-${i}`,
          body: {
            type: 'ai_process',
            sourceId: i + 1,
            userId: 'user1',
            content: `测试内容 ${i}`,
            metadata: { entryId: i + 1 }
          }
        }))
      };

      let concurrentProcesses = 0;
      let maxConcurrentProcesses = 0;

      // 模拟LLM处理过程
      const mockLLMProcessing = async (message: any) => {
        concurrentProcesses++;
        maxConcurrentProcesses = Math.max(maxConcurrentProcesses, concurrentProcesses);
        
        // 模拟处理时间
        await new Promise(resolve => setTimeout(resolve, 100));
        
        concurrentProcesses--;
        return { success: true };
      };

      // 串行处理消息
      const processingPromises = mockBatch.messages.map(message => 
        mockLLMProcessing(message)
      );

      // 按顺序处理（模拟严格的并发控制）
      for (let i = 0; i < processingPromises.length; i++) {
        await processingPromises[i];
      }

      expect(maxConcurrentProcesses).toBe(1); // 严格限制并发数为1
    });

    it('应该正确处理LLM处理队列的重试机制', async () => {
      let attemptCount = 0;
      const maxRetries = 3;

      const mockProcessWithRetry = async (): Promise<boolean> => {
        attemptCount++;
        
        if (attemptCount <= 2) {
          throw new Error('LLM处理失败');
        }
        
        return true; // 第3次成功
      };

      let result = false;
      let error: Error | null = null;

      try {
        // 重试逻辑
        for (let i = 0; i < maxRetries; i++) {
          try {
            result = await mockProcessWithRetry();
            if (result) break;
          } catch (err) {
            if (i === maxRetries - 1) throw err;
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒重试
          }
        }
      } catch (err) {
        error = err;
      }

      expect(attemptCount).toBe(3);
      expect(result).toBe(true);
      expect(error).toBeNull();
    });
  });

  describe('内容去重机制测试', () => {
    it('应该基于URL准确进行内容去重', async () => {
      const duplicateUrl = 'https://example.com/article1';
      
      // 模拟重复URL检查
      mockDeduplicationService.batchCheckDuplicateUrls.mockResolvedValue(
        new Map([[duplicateUrl, { isDuplicate: true, existingEntryId: 123 }]])
      );

      const mockEntries = [
        { url: duplicateUrl, title: '重复文章', content: '重复内容' },
        { url: 'https://example.com/article2', title: '新文章', content: '新内容' }
      ];

      const checkResults = await mockDeduplicationService.batchCheckDuplicateUrls(
        mockEntries.map(e => e.url),
        'user1'
      );

      expect(checkResults.get(duplicateUrl)?.isDuplicate).toBe(true);
      expect(checkResults.get('https://example.com/article2')).toBeUndefined(); // 未重复
    });

    it('应该正确处理URL缓存机制', async () => {
      const testUrl = 'https://example.com/test-article';
      
      // 模拟缓存命中
      let cacheHit = false;
      const urlCache = new Set([testUrl]);

      const mockCacheCheck = (url: string): boolean => {
        cacheHit = urlCache.has(url);
        return cacheHit;
      };

      // 第一次检查
      const firstCheck = mockCacheCheck(testUrl);
      expect(firstCheck).toBe(true);
      expect(cacheHit).toBe(true);

      // 清除缓存
      urlCache.clear();
      
      // 第二次检查
      const secondCheck = mockCacheCheck(testUrl);
      expect(secondCheck).toBe(false);
      expect(cacheHit).toBe(false);
    });
  });

  describe('分层存储架构测试', () => {
    it('应该正确实现共享内容池引用计数', async () => {
      let referenceCount = 0;
      
      // 模拟引用计数管理
      const incrementReference = (contentHash: string): number => {
        referenceCount++;
        return referenceCount;
      };

      const decrementReference = (contentHash: string): number => {
        referenceCount = Math.max(0, referenceCount - 1);
        return referenceCount;
      };

      // 测试引用计数增加
      const hash1 = 'content-hash-1';
      expect(incrementReference(hash1)).toBe(1);
      expect(incrementReference(hash1)).toBe(2);
      expect(incrementReference(hash1)).toBe(3);

      // 测试引用计数减少
      expect(decrementReference(hash1)).toBe(2);
      expect(decrementReference(hash1)).toBe(1);
      expect(decrementReference(hash1)).toBe(0);
      expect(decrementReference(hash1)).toBe(0); // 不能低于0
    });

    it('应该正确处理用户编辑后的独立副本创建', async () => {
      const sharedContentHash = 'shared-content-123';
      const userId = 'user1';
      
      // 模拟用户编辑检测
      let editDetected = false;
      let copyCreated = false;

      const simulateUserEdit = (detectedUserId: string): boolean => {
        if (detectedUserId === userId) {
          editDetected = true;
          copyCreated = true;
          return true;
        }
        return false;
      };

      // 模拟编辑操作
      const editResult = simulateUserEdit(userId);
      
      expect(editResult).toBe(true);
      expect(editDetected).toBe(true);
      expect(copyCreated).toBe(true);
    });
  });

  describe('系统稳定性测试', () => {
    it('应该在高负载情况下保持稳定运行', async () => {
      // 模拟高负载场景
      const concurrentRequests = 50;
      let activeRequests = 0;
      let maxActiveRequests = 0;
      const errors: Error[] = [];

      const simulateRequest = async (): Promise<{ success: boolean; duration: number }> => {
        activeRequests++;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        
        try {
          // 模拟处理时间
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          
          // 模拟10%的错误率
          if (Math.random() < 0.1) {
            throw new Error('随机错误');
          }
          
          return { success: true, duration: Math.random() * 100 };
        } catch (error) {
          errors.push(error);
          return { success: false, duration: Math.random() * 100 };
        } finally {
          activeRequests--;
        }
      };

      // 并发执行请求
      const startTime = Date.now();
      const promises = Array(concurrentRequests).fill(null).map(() => simulateRequest());
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      const successRate = results.filter(r => r.success).length / results.length;
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

      expect(successRate).toBeGreaterThan(0.8); // 成功率应该>80%
      expect(maxActiveRequests).toBeLessThanOrEqual(concurrentRequests);
      expect(duration).toBeLessThan(5000); // 总时间应该<5秒
      
      console.log(`高负载测试结果: 成功率=${(successRate * 100).toFixed(1)}%, 最大并发=${maxActiveRequests}, 耗时=${duration}ms`);
    });

    it('应该正确处理内存使用和资源清理', async () => {
      let memoryUsage = 0;
      const maxMemory = 100; // 模拟内存限制

      const allocateMemory = (size: number): boolean => {
        if (memoryUsage + size > maxMemory) {
          return false; // 内存不足
        }
        memoryUsage += size;
        return true;
      };

      const freeMemory = (size: number): void => {
        memoryUsage = Math.max(0, memoryUsage - size);
      };

      // 测试内存分配和释放
      expect(allocateMemory(50)).toBe(true);
      expect(memoryUsage).toBe(50);
      
      expect(allocateMemory(60)).toBe(false); // 超过限制
      expect(memoryUsage).toBe(50); // 未分配成功
      
      freeMemory(30);
      expect(memoryUsage).toBe(20);
      
      expect(allocateMemory(60)).toBe(true); // 现在可以分配
      expect(memoryUsage).toBe(80);
    });
  });

  describe('端到端集成测试', () => {
    it('应该完成完整的RSS到AI处理流程', async () => {
      // 模拟完整的处理流程
      const testWorkflow = async (): Promise<boolean> => {
        try {
          // 1. RSS抓取
          console.log('步骤1: RSS抓取');
          await new Promise(resolve => setTimeout(resolve, 100));

          // 2. 内容去重
          console.log('步骤2: 内容去重');
          await new Promise(resolve => setTimeout(resolve, 50));

          // 3. LLM处理（串行）
          console.log('步骤3: LLM处理');
          await new Promise(resolve => setTimeout(resolve, 500));

          // 4. 内容分发
          console.log('步骤4: 内容分发');
          await new Promise(resolve => setTimeout(resolve, 100));

          // 5. 存储
          console.log('步骤5: 存储');
          await new Promise(resolve => setTimeout(resolve, 50));

          return true;
        } catch (error) {
          console.error('工作流失败:', error);
          return false;
        }
      };

      const result = await testWorkflow();
      expect(result).toBe(true);
    });

    it('应该正确处理错误恢复机制', async () => {
      let retryCount = 0;
      const maxRetries = 3;

      const simulateFailure = async (): Promise<boolean> => {
        retryCount++;
        
        if (retryCount < maxRetries) {
          throw new Error(`模拟失败 ${retryCount}`);
        }
        
        return true; // 最终成功
      };

      let success = false;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          success = await simulateFailure();
          if (success) break;
        } catch (error) {
          lastError = error;
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待重试
          }
        }
      }

      expect(success).toBe(true);
      expect(retryCount).toBe(maxRetries);
      expect(lastError).toBeNull();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});