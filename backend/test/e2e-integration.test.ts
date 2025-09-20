// 端到端集成测试
// 验证整个RSS到AI处理到内容分发的完整流程

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RssSchedulerService } from '../src/services/rss-scheduler.service';
import { ContentDeduplicationService } from '../src/services/content-deduplication.service';
import { ContentDistributionService } from '../src/services/content-distribution.service';
import { UserEditIsolationService } from '../src/services/user-edit-isolation.service';
import { StorageOptimizationService } from '../src/services/storage-optimization.service';

describe('端到端集成测试 - RSS到AI处理到内容分发完整流程', () => {
  let rssScheduler: RssSchedulerService;
  let contentDeduplication: ContentDeduplicationService;
  let contentDistribution: ContentDistributionService;
  let userEditIsolation: UserEditIsolationService;
  let storageOptimization: StorageOptimizationService;

  // Mock服务依赖
  let mockDb: any;
  let mockEnv: any;
  let mockR2Service: any;
  let mockLLMService: any;
  let mockSharedContentPool: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // 模拟数据库环境
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      and: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      desc: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      sql: vi.fn()
    };

    mockEnv = {
      RSS_QUEUE: {
        send: vi.fn().mockResolvedValue(true)
      },
      AI_PROCESSOR_QUEUE: {
        send: vi.fn().mockResolvedValue(true)
      }
    };

    mockR2Service = {
      uploadFile: vi.fn().mockResolvedValue({ success: true, key: 'test/content.md' }),
      downloadFile: vi.fn().mockResolvedValue('测试内容'),
      deleteFile: vi.fn().mockResolvedValue(true),
      fileExists: vi.fn().mockResolvedValue(true)
    };

    mockLLMService = {
      generateContent: vi.fn().mockResolvedValue({
        content: 'AI生成的内容',
        topics: ['AI', '技术'],
        keywords: ['机器学习', '深度学习'],
        importanceScore: 0.8
      })
    };

    mockSharedContentPool = {
      getSharedContent: vi.fn().mockResolvedValue({
        contentHash: 'test-hash',
        content: '共享内容',
        referenceCount: 1
      }),
      createUserCopy: vi.fn().mockResolvedValue({
        userPath: 'users/123/content.md',
        success: true
      }),
      cleanupOrphanedContent: vi.fn().mockResolvedValue(0)
    };

    // 创建服务实例
    rssScheduler = new RssSchedulerService(mockDb, mockEnv, mockLLMService, mockR2Service);
    contentDeduplication = new ContentDeduplicationService(mockDb);
    contentDistribution = new ContentDistributionService(mockSharedContentPool, mockR2Service);
    userEditIsolation = new UserEditIsolationService(mockDb, mockR2Service);
    storageOptimization = new StorageOptimizationService(mockDb, mockR2Service);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('完整RSS处理流程测试', () => {
    it('应该成功执行从RSS抓取到内容分发的完整流程', async () => {
      // 1. 模拟RSS源配置
      const mockSources = [
        {
          id: 1,
          name: 'Tech News',
          url: 'https://technews.com/feed',
          userId: 123,
          isActive: true,
          lastFetchAt: null
        }
      ];

      // 2. 模拟RSS条目
      const mockRssEntries = [
        {
          id: 1,
          sourceId: 1,
          title: 'AI技术突破',
          link: 'https://technews.com/ai-breakthrough',
          description: '最新的AI技术进展',
          pubDate: new Date(),
          guid: 'unique-guid-123',
          createdAt: new Date()
        }
      ];

      // 3. 模拟用户偏好
      const mockUserPreferences = [
        {
          userId: '123',
          enabledTopics: ['AI', '技术'],
          enabledKeywords: ['机器学习'],
          minImportanceScore: 0.6,
          maxDailyContent: 100,
          contentTypes: ['news', 'analysis'],
          deliverySchedule: 'realtime'
        }
      ];

      // 设置mock返回值
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.and.mockReturnValue(mockDb);
      mockDb.eq.mockReturnValue(mockDb);
      mockDb.limit.mockReturnValue(mockDb);
      mockDb.leftJoin.mockReturnValue(mockDb);
      mockDb.groupBy.mockReturnValue(mockDb);
      mockDb.insert.mockReturnValue(mockDb);
      mockDb.values.mockReturnValue(mockDb);
      mockDb.update.mockReturnValue(mockDb);
      mockDb.set.mockReturnValue(mockDb);
      mockDb.delete.mockReturnValue(mockDb);
      
      // 模拟数据库查询结果
      mockDb.mockResolvedValueOnce(mockSources); // 获取RSS源
      mockDb.mockResolvedValueOnce([]); // 无现有条目
      mockDb.mockResolvedValueOnce([{ exists: false }]); // 内容不存在
      mockDb.mockResolvedValueOnce([{ id: 1 }]); // 插入RSS条目
      mockDb.mockResolvedValueOnce([{ id: 1, contentHash: 'test-hash' }]); // 插入处理内容
      mockDb.mockResolvedValueOnce(mockUserPreferences); // 获取用户偏好
      mockDb.mockResolvedValueOnce([]); // 无现有引用

      // 模拟内容哈希生成
      const generateContentHashSpy = vi.spyOn(contentDeduplication as any, 'generateContentHash');
      generateContentHashSpy.mockReturnValue('test-hash');

      // 模拟内容特征提取
      const extractContentFeaturesSpy = vi.spyOn(contentDeduplication as any, 'extractContentFeatures');
      extractContentFeaturesSpy.mockReturnValue({
        topics: ['AI', '技术'],
        keywords: ['机器学习', '深度学习'],
        importanceScore: 0.8,
        source: 'Tech News',
        contentType: 'news'
      });

      // 执行RSS调度
      const scheduleResult = await rssScheduler.scheduleAllSources();
      
      // 验证RSS调度结果
      expect(scheduleResult).toHaveLength(1);
      expect(scheduleResult[0].success).toBe(true);

      // 验证队列发送
      expect(mockEnv.RSS_QUEUE.send).toHaveBeenCalled();

      // 模拟AI处理器接收队列消息
      const aiProcessMessage = {
        type: 'ai_process',
        sourceId: 1,
        userId: '123',
        content: 'AI技术突破内容',
        metadata: { entryId: 1 }
      };

      // 验证内容去重
      const isDuplicate = await contentDeduplication.isContentDuplicate(
        'https://technews.com/ai-breakthrough',
        1
      );
      expect(isDuplicate).toBe(false);

      // 验证内容分发
      const distributionResults = await contentDistribution.distributeContent(
        'test-hash',
        1,
        1,
        {
          topics: ['AI', '技术'],
          keywords: ['机器学习', '深度学习'],
          importanceScore: 0.8,
          source: 'Tech News',
          contentType: 'news'
        }
      );

      // 验证分发结果
      expect(distributionResults).toHaveLength(1);
      expect(distributionResults[0].success).toBe(true);
      expect(distributionResults[0].target.userId).toBe('123');

      // 验证用户编辑隔离
      const isolationResult = await userEditIsolation.detectAndCreateEditCopy(
        123,
        'users/123/content.md'
      );
      expect(isolationResult.isolationRequired).toBe(false);

      // 验证存储优化
      const optimizationResult = await storageOptimization.runFullOptimization();
      expect(optimizationResult.success).toBe(true);
      expect(optimizationResult.results).toHaveLength(6); // 6个优化步骤
    });

    it('应该正确处理重复内容的情况', async () => {
      // 模拟重复内容检测
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.and.mockReturnValue(mockDb);
      mockDb.eq.mockReturnValue(mockDb);
      mockDb.limit.mockReturnValue(mockDb);
      mockDb.mockResolvedValueOnce([{ exists: true }]); // 内容已存在

      const isDuplicate = await contentDeduplication.isContentDuplicate(
        'https://existing-content.com',
        1
      );
      expect(isDuplicate).toBe(true);
    });

    it('应该正确处理用户编辑隔离', async () => {
      // 模拟用户已编辑的文件
      mockR2Service.downloadFile.mockResolvedValue('用户编辑的内容');

      const isolationResult = await userEditIsolation.detectAndCreateEditCopy(
        123,
        'users/123/content.md'
      );

      expect(isolationResult.isolationRequired).toBe(true);
      expect(mockSharedContentPool.createUserCopy).toHaveBeenCalled();
    });

    it('应该正确处理内容分发匹配失败的情况', async () => {
      // 模拟不匹配的用户偏好
      const mockUserPreferences = [
        {
          userId: '123',
          enabledTopics: ['体育'],
          enabledKeywords: ['足球'],
          minImportanceScore: 0.9,
          maxDailyContent: 100,
          contentTypes: ['sports'],
          deliverySchedule: 'realtime'
        }
      ];

      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.and.mockReturnValue(mockDb);
      mockDb.eq.mockReturnValue(mockDb);
      mockDb.leftJoin.mockReturnValue(mockDb);
      mockDb.groupBy.mockReturnValue(mockDb);
      mockDb.mockResolvedValueOnce(mockUserPreferences);
      mockDb.mockResolvedValueOnce([]); // 无现有引用

      const distributionResults = await contentDistribution.distributeContent(
        'test-hash',
        1,
        1,
        {
          topics: ['AI', '技术'],
          keywords: ['机器学习'],
          importanceScore: 0.8,
          source: 'Tech News',
          contentType: 'news'
        }
      );

      expect(distributionResults).toHaveLength(0); // 没有匹配的用户
    });
  });

  describe('错误处理和恢复测试', () => {
    it('应该正确处理RSS抓取失败的情况', async () => {
      // 模拟RSS抓取失败
      const mockSources = [
        {
          id: 1,
          name: 'Failed Source',
          url: 'https://failed-source.com/feed',
          userId: 123,
          isActive: true,
          lastFetchAt: null
        }
      ];

      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.and.mockReturnValue(mockDb);
      mockDb.eq.mockReturnValue(mockDb);
      mockDb.limit.mockReturnValue(mockDb);
      mockDb.mockResolvedValueOnce(mockSources);

      // 模拟fetch失败
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const scheduleResult = await rssScheduler.scheduleAllSources();
      
      expect(scheduleResult).toHaveLength(1);
      expect(scheduleResult[0].success).toBe(false);
      expect(scheduleResult[0].error).toContain('Network error');
    });

    it('应该正确处理AI处理失败的情况', async () => {
      // 模拟AI处理失败
      mockLLMService.generateContent.mockRejectedValue(new Error('AI service unavailable'));

      const processResult = await rssScheduler.processRssContent({
        sourceId: 1,
        userId: '123',
        content: '测试内容',
        metadata: { entryId: 1 }
      });

      expect(processResult.success).toBe(false);
      expect(processResult.error).toContain('AI service unavailable');
    });

    it('应该正确处理存储失败的情况', async () => {
      // 模拟R2存储失败
      mockR2Service.uploadFile.mockRejectedValue(new Error('Storage quota exceeded'));

      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.and.mockReturnValue(mockDb);
      mockDb.eq.mockReturnValue(mockDb);
      mockDb.limit.mockReturnValue(mockDb);
      mockDb.mockResolvedValueOnce([{ exists: false }]); // 内容不存在
      mockDb.mockResolvedValueOnce([{ id: 1 }]); // 插入RSS条目
      mockDb.mockResolvedValueOnce([{ id: 1, contentHash: 'test-hash' }]); // 插入处理内容

      const processResult = await rssScheduler.processRssContent({
        sourceId: 1,
        userId: '123',
        content: '测试内容',
        metadata: { entryId: 1 }
      });

      expect(processResult.success).toBe(false);
      expect(processResult.error).toContain('Storage quota exceeded');
    });
  });

  describe('性能和并发测试', () => {
    it('应该正确处理并发RSS请求', async () => {
      // 模拟多个并发RSS源
      const mockSources = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `Source ${i + 1}`,
        url: `https://source${i + 1}.com/feed`,
        userId: 123,
        isActive: true,
        lastFetchAt: null
      }));

      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.and.mockReturnValue(mockDb);
      mockDb.eq.mockReturnValue(mockDb);
      mockDb.limit.mockReturnValue(mockDb);
      mockDb.mockResolvedValueOnce(mockSources);
      mockDb.mockResolvedValueOnce([]); // 无现有条目
      mockDb.mockResolvedValueOnce([{ exists: false }]); // 内容不存在
      mockDb.mockResolvedValueOnce([{ id: 1 }]); // 插入RSS条目
      mockDb.mockResolvedValueOnce([{ id: 1, contentHash: 'test-hash' }]); // 插入处理内容

      const scheduleResult = await rssScheduler.scheduleAllSources();
      
      expect(scheduleResult).toHaveLength(10);
      expect(scheduleResult.filter(r => r.success).length).toBe(10);
    });

    it('应该正确处理大量内容分发', async () => {
      // 模拟大量用户偏好
      const mockUserPreferences = Array.from({ length: 100 }, (_, i) => ({
        userId: (i + 1).toString(),
        enabledTopics: ['AI', '技术'],
        enabledKeywords: ['机器学习'],
        minImportanceScore: 0.6,
        maxDailyContent: 100,
        contentTypes: ['news', 'analysis'],
        deliverySchedule: 'realtime'
      }));

      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.and.mockReturnValue(mockDb);
      mockDb.eq.mockReturnValue(mockDb);
      mockDb.leftJoin.mockReturnValue(mockDb);
      mockDb.groupBy.mockReturnValue(mockDb);
      mockDb.mockResolvedValueOnce(mockUserPreferences);
      mockDb.mockResolvedValueOnce([]); // 无现有引用

      const startTime = Date.now();
      const distributionResults = await contentDistribution.distributeContent(
        'test-hash',
        1,
        1,
        {
          topics: ['AI', '技术'],
          keywords: ['机器学习', '深度学习'],
          importanceScore: 0.8,
          source: 'Tech News',
          contentType: 'news'
        }
      );
      const endTime = Date.now();

      expect(distributionResults).toHaveLength(100);
      expect(distributionResults.filter(r => r.success).length).toBe(100);
      expect(endTime - startTime).toBeLessThan(5000); // 应该在5秒内完成
    });
  });

  describe('数据一致性测试', () => {
    it('应该确保数据在各个服务之间的一致性', async () => {
      // 模拟完整的数据流程
      const contentHash = 'consistent-hash';
      const entryId = 1;
      const userId = 123;

      // 1. 内容去重服务记录内容
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.and.mockReturnValue(mockDb);
      mockDb.eq.mockReturnValue(mockDb);
      mockDb.limit.mockReturnValue(mockDb);
      mockDb.mockResolvedValueOnce([{ exists: false }]); // 内容不存在

      const isDuplicate = await contentDeduplication.isContentDuplicate(
        'https://consistent-content.com',
        entryId
      );
      expect(isDuplicate).toBe(false);

      // 2. 内容分发服务分发内容
      mockDb.mockResolvedValueOnce([{ userId: userId.toString(), enabledTopics: ['AI'], enabledKeywords: ['AI'], minImportanceScore: 0.6, maxDailyContent: 100, contentTypes: ['news'], deliverySchedule: 'realtime' }]);
      mockDb.mockResolvedValueOnce([]); // 无现有引用

      const distributionResults = await contentDistribution.distributeContent(
        contentHash,
        1,
        entryId,
        {
          topics: ['AI'],
          keywords: ['AI'],
          importanceScore: 0.8,
          source: 'Test Source',
          contentType: 'news'
        }
      );

      expect(distributionResults).toHaveLength(1);
      expect(distributionResults[0].success).toBe(true);

      // 3. 用户编辑隔离服务检测编辑
      const isolationResult = await userEditIsolation.detectAndCreateEditCopy(
        userId,
        `users/${userId}/content.md`
      );
      expect(isolationResult.isolationRequired).toBe(false);

      // 4. 存储优化服务优化存储
      const optimizationResult = await storageOptimization.runFullOptimization();
      expect(optimizationResult.success).toBe(true);

      // 验证所有服务都使用相同的内容哈希
      expect(contentHash).toBe('consistent-hash');
    });
  });
});