// src/services/content-deduplication.service.test.ts
// 内容去重服务的测试文件

import { ContentDeduplicationService } from '../src/services/content-deduplication.service';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock D1数据库
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: vi.fn(),
  all: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  returning: vi.fn(),
  sql: vi.fn(),
};

describe('ContentDeduplicationService', () => {
  let service: ContentDeduplicationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContentDeduplicationService(mockDb);
  });

  describe('检查URL去重', () => {
    it('应该正确识别重复的URL', async () => {
      const mockUrl = 'https://example.com/article1';
      const mockEntryId = 123;
      const mockUserId = 'user1';

      // Mock数据库返回已存在的URL
      mockDb.get.mockResolvedValue({
        id: 1,
        url: mockUrl,
        entryId: mockEntryId,
        userId: mockUserId,
        createdAt: new Date(),
      });

      const result = await service.checkDuplicateByUrl(mockUrl, mockUserId, 1);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingEntryId).toBe(mockEntryId);
      expect(result.userId).toBe(mockUserId);
    });

    it('应该正确识别新的URL', async () => {
      const mockUrl = 'https://example.com/new-article';
      const mockUserId = 'user1';

      // Mock数据库返回不存在
      mockDb.get.mockResolvedValue(null);

      const result = await service.checkDuplicateByUrl(mockUrl, mockUserId, 1);

      expect(result.isDuplicate).toBe(false);
      expect(result.existingEntryId).toBeUndefined();
    });

    it('应该使用内存缓存优化性能', async () => {
      const mockUrl = 'https://example.com/cached-article';
      const mockUserId = 'user1';

      // 第一次检查，数据库返回不存在
      mockDb.get.mockResolvedValueOnce(null);
      
      let result = await service.checkDuplicateByUrl(mockUrl, mockUserId, 1);
      expect(result.isDuplicate).toBe(false);

      // 第二次检查，应该使用缓存，不调用数据库
      result = await service.checkDuplicateByUrl(mockUrl, mockUserId, 1);
      expect(result.isDuplicate).toBe(false);
      
      // 验证数据库只被调用了一次
      expect(mockDb.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('注册已处理的URL', () => {
    it('应该成功注册新的URL', async () => {
      const mockUrl = 'https://example.com/new-article';
      const mockEntryId = 456;
      const mockUserId = 'user1';

      // Mock数据库返回不存在
      mockDb.get.mockResolvedValue(null);
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.returning.mockResolvedValue([{
        id: 2,
        url: mockUrl,
        entryId: mockEntryId,
        userId: mockUserId,
        createdAt: new Date(),
      }]);

      await expect(
        service.registerProcessedUrl(mockUrl, mockEntryId, mockUserId, {
          sourceId: 1,
          title: 'Test Article',
          publishedAt: new Date(),
        })
      ).resolves.not.toThrow();

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('应该更新已存在的URL记录', async () => {
      const mockUrl = 'https://example.com/existing-article';
      const mockEntryId = 789;
      const mockUserId = 'user1';

      // Mock数据库返回已存在
      mockDb.get.mockResolvedValue({
        id: 3,
        url: mockUrl,
        entryId: mockEntryId,
        userId: mockUserId,
        createdAt: new Date(),
      });

      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.where.mockReturnThis();

      await expect(
        service.registerProcessedUrl(mockUrl, mockEntryId, mockUserId, {
          sourceId: 1,
          title: 'Updated Article',
          publishedAt: new Date(),
        })
      ).resolves.not.toThrow();

      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('批量URL处理', () => {
    it('应该正确处理批量URL去重检查', async () => {
      const urls = [
        'https://example.com/article1',
        'https://example.com/article2',
        'https://example.com/article3',
      ];
      const mockUserId = 'user1';

      // Mock数据库返回部分重复
      mockDb.all.mockResolvedValue([
        { url: 'https://example.com/article1', entryId: 100, userId: mockUserId },
        { url: 'https://example.com/article3', entryId: 102, userId: mockUserId },
      ]);

      const results = await service.batchCheckDuplicateUrls(urls, mockUserId);

      expect(results.size).toBe(3);
      expect(results.get('https://example.com/article1')?.isDuplicate).toBe(true);
      expect(results.get('https://example.com/article2')?.isDuplicate).toBe(false);
      expect(results.get('https://example.com/article3')?.isDuplicate).toBe(true);
    });

    it('应该正确处理批量URL注册', async () => {
      const urlEntries = [
        {
          url: 'https://example.com/new1',
          entryId: 1001,
          userId: 'user1',
          metadata: { sourceId: 1, title: 'New 1', publishedAt: new Date() },
        },
        {
          url: 'https://example.com/new2',
          entryId: 1002,
          userId: 'user1',
          metadata: { sourceId: 1, title: 'New 2', publishedAt: new Date() },
        },
      ];

      // Mock数据库返回都不存在
      mockDb.all.mockResolvedValue([]);
      mockDb.insert.mockReturnThis();
      mockDb.values.mockReturnThis();
      mockDb.returning.mockResolvedValue([{}, {}]);

      const result = await service.batchRegisterProcessedUrls(urlEntries);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  describe('统计和清理', () => {
    it('应该返回正确的去重统计信息', async () => {
      mockDb.select.mockReturnThis();
      mockDb.sql.mockImplementation((query) => ({
        get: vi.fn().mockResolvedValue({ count: 100 }),
      }));

      const stats = await service.getDeduplicationStats();

      expect(stats.totalUrls).toBe(100);
      expect(stats.duplicateUrls).toBe(0); // 由于mock返回相同的count
      expect(stats.uniqueUrls).toBe(100);
    });

    it('应该正确清理过期的URL索引', async () => {
      mockDb.delete.mockReturnThis();
      mockDb.returning.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const stats = await service.cleanupExpiredUrls();

      expect(stats.expiredRemoved).toBe(2);
      expect(stats.processingTime).toBeGreaterThan(0);
    });
  });

  describe('错误处理', () => {
    it('应该处理数据库错误', async () => {
      const mockUrl = 'https://example.com/error-article';
      const mockUserId = 'user1';

      // Mock数据库抛出错误
      mockDb.get.mockRejectedValue(new Error('Database error'));

      const result = await service.checkDuplicateByUrl(mockUrl, mockUserId, 1);

      // 出错时应该默认认为是重复内容
      expect(result.isDuplicate).toBe(true);
    });
  });

  describe('缓存管理', () => {
    it('应该正确清理缓存', () => {
      // 手动添加一些缓存数据
      (service as any).urlCache.set('test-url', {
        entryId: 1,
        userId: 'user1',
        timestamp: Date.now(),
      });

      expect((service as any).urlCache.size).toBe(1);

      service.clearCache();

      expect((service as any).urlCache.size).toBe(0);
    });

    it('应该返回正确的缓存大小', () => {
      expect(service.getCacheSize()).toBe(0);

      // 手动添加一些缓存数据
      (service as any).urlCache.set('test-url1', {
        entryId: 1,
        userId: 'user1',
        timestamp: Date.now(),
      });
      (service as any).urlCache.set('test-url2', {
        entryId: 2,
        userId: 'user2',
        timestamp: Date.now(),
      });

      expect(service.getCacheSize()).toBe(2);
    });
  });
});