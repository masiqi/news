// src/services/content-distribution.service.test.ts
// 智能内容分发服务测试文件

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContentDistributionService } from '../src/services/content-distribution.service';
import { SharedContentPoolService } from '../src/services/shared-content-pool.service';
import { R2Service } from '../src/services/r2.service';

// Mock数据库
const mockDb = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  and: vi.fn(),
  eq: vi.fn(),
  gte: vi.fn(),
  lt: vi.fn(),
  inArray: vi.fn(),
  leftJoin: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  sql: vi.fn(),
  returning: vi.fn(),
  get: vi.fn(),
  all: vi.fn(),
};

// Mock SharedContentPoolService
const mockSharedContentPool = {
  createUserCopy: vi.fn(),
  handleUserContentUpdate: vi.fn(),
  getUserContent: vi.fn(),
  cleanupOrphanedContent: vi.fn(),
  getStorageStats: vi.fn(),
};

// Mock R2Service
const mockR2Service = {
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
  deleteFile: vi.fn(),
  fileExists: vi.fn(),
};

describe('ContentDistributionService', () => {
  let service: ContentDistributionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContentDistributionService(
      mockSharedContentPool as any,
      mockR2Service as any
    );
  });

  describe('智能内容分发', () => {
    it('应该成功将内容分发给匹配的用户', async () => {
      const contentHash = 'test-hash-123';
      const processedContentId = 1;
      const entryId = 1;
      
      const contentFeatures = {
        topics: ['AI', 'Technology'],
        keywords: ['machine learning', 'artificial intelligence'],
        importanceScore: 0.8,
        source: 'TechNews',
        contentType: 'news' as const
      };

      // Mock数据库返回活跃用户偏好
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        enabledTopics: 'AI,Technology',
        enabledKeywords: 'machine learning'
      });

      // Mock自动存储配置
      mockDb.get.mockResolvedValueOnce({
        maxFilesPerDay: 100
      });

      // Mock检查现有引用（无）
      mockDb.all.mockResolvedValue([]);

      // Mock今日统计（未达到限制）
      mockDb.get.mockResolvedValue({ totalFiles: 10, totalSize: 50000 });

      // Mock R2访问权限检查
      mockDb.get.mockResolvedValue({ id: 1, isActive: true });

      // Mock用户副本创建
      mockSharedContentPool.createUserCopy.mockResolvedValue({
        userId: '1',
        entryId: 1,
        userPath: 'users/1/notes/1.md',
        isModified: false
      });

      // Mock RSS条目和 processed content
      mockDb.all.mockResolvedValueOnce([
        { id: 1, title: 'Test Article', link: 'https://test.com' }
      ]);
      mockDb.all.mockResolvedValueOnce([
        { id: 1, markdownContent: '# Test Content\\nThis is test content.' }
      ]);

      const results = await service.distributeContent(
        contentHash,
        processedContentId,
        entryId,
        contentFeatures
      );

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].target.userId).toBe('1');
      expect(mockSharedContentPool.createUserCopy).toHaveBeenCalledWith('1', 1, contentHash);
    });

    it('应该跳过已存在的内容引用', async () => {
      const contentHash = 'existing-hash';
      const processedContentId = 2;
      const entryId = 2;
      
      const contentFeatures = {
        topics: ['Business'],
        keywords: ['finance'],
        importanceScore: 0.6,
        source: 'BusinessNews',
        contentType: 'analysis' as const
      };

      // Mock数据库返回活跃用户
      mockDb.get.mockResolvedValue({
        id: 2,
        enabledTopics: 'Business',
        enabledKeywords: 'finance'
      });

      // Mock自动存储配置
      mockDb.get.mockResolvedValue({ maxFilesPerDay: 50 });

      // Mock检查现有引用（已存在）
      mockDb.all.mockResolvedValue([{
        userId: '2',
        entryId: 2,
        contentHash: 'existing-hash'
      }]);

      const results = await service.distributeContent(
        contentHash,
        processedContentId,
        entryId,
        contentFeatures
      );

      expect(results).toHaveLength(0);
      expect(mockSharedContentPool.createUserCopy).not.toHaveBeenCalled();
    });

    it('应该跳过达到每日内容限制的用户', async () => {
      const contentHash = 'limited-hash';
      const processedContentId = 3;
      const entryId = 3;
      
      const contentFeatures = {
        topics: ['Science'],
        keywords: ['research'],
        importanceScore: 0.9,
        source: 'ScienceNews',
        contentType: 'tutorial' as const
      };

      // Mock数据库返回活跃用户
      mockDb.get.mockResolvedValue({
        id: 3,
        enabledTopics: 'Science',
        enabledKeywords: 'research'
      });

      // Mock自动存储配置（低限制）
      mockDb.get.mockResolvedValue({ maxFilesPerDay: 5 });

      // Mock检查现有引用（无）
      mockDb.all.mockResolvedValue([]);

      // Mock今日统计（已达到限制）
      mockDb.get.mockResolvedValue({ totalFiles: 5, totalSize: 100000 });

      const results = await service.distributeContent(
        contentHash,
        processedContentId,
        entryId,
        contentFeatures
      );

      expect(results).toHaveLength(0);
      expect(mockSharedContentPool.createUserCopy).not.toHaveBeenCalled();
    });
  });

  describe('内容匹配分数计算', () => {
    it('应该正确计算内容与用户偏好的匹配分数', async () => {
      const servicePrivate = service as any;
      
      const contentFeatures = {
        topics: ['AI', 'Machine Learning', 'Technology'],
        keywords: ['deep learning', 'neural networks', 'AI'],
        importanceScore: 0.8,
        source: 'TechBlog',
        contentType: 'news' as const
      };

      const userPreference = {
        userId: '1',
        enabledTopics: ['AI', 'Technology'],
        enabledKeywords: ['deep learning', 'AI'],
        minImportanceScore: 0.6,
        maxDailyContent: 100,
        contentTypes: ['news', 'analysis'],
        deliverySchedule: 'realtime' as const
      };

      const score = servicePrivate.calculateContentMatchScore(contentFeatures, userPreference);

      // 预期分数计算：
      // 主题匹配: 2/2 = 1.0 * 0.4 = 0.4
      // 关键词匹配: 2/2 = 1.0 * 0.3 = 0.3  
      // 重要性分数: 0.8 >= 0.6 = 1.0 * 0.2 = 0.2
      // 内容类型: 'news' 在 ['news', 'analysis'] = 1.0 * 0.1 = 0.1
      // 总分: 1.0
      expect(score).toBe(1.0);
    });

    it('应该为完全不匹配的内容返回0分数', async () => {
      const servicePrivate = service as any;
      
      const contentFeatures = {
        topics: ['Sports', 'Entertainment'],
        keywords: ['football', 'movies'],
        importanceScore: 0.3,
        source: 'EntertainmentNews',
        contentType: 'tutorial' as const
      };

      const userPreference = {
        userId: '2',
        enabledTopics: ['Technology', 'Science'],
        enabledKeywords: ['AI', 'programming'],
        minImportanceScore: 0.6,
        maxDailyContent: 50,
        contentTypes: ['news'],
        deliverySchedule: 'daily' as const
      };

      const score = servicePrivate.calculateContentMatchScore(contentFeatures, userPreference);

      // 预期分数计算：
      // 主题匹配: 0/2 = 0.0 * 0.4 = 0.0
      // 关键词匹配: 0/2 = 0.0 * 0.3 = 0.0
      // 重要性分数: 0.3 < 0.6 = 0.0 * 0.2 = 0.0
      // 内容类型: 'tutorial' 不在 ['news'] = 0.0 * 0.1 = 0.0
      // 总分: 0.0
      expect(score).toBe(0.0);
    });
  });

  describe('分发统计', () => {
    it('应该返回正确的分发统计信息', async () => {
      // Mock基础统计
      mockDb.get.mockResolvedValueOnce({
        totalUsers: 10,
        totalDistributed: 150
      });

      // Mock失败统计
      mockDb.get.mockResolvedValueOnce({
        failedCount: 5
      });

      // Mock平均处理时间
      mockDb.get.mockResolvedValueOnce({
        avgTime: 250
      });

      const stats = await service.getDistributionStats();

      expect(stats.totalUsers).toBe(10);
      expect(stats.distributedUsers).toBe(150);
      expect(stats.failedUsers).toBe(5);
      expect(stats.averageProcessingTime).toBe(250);
      expect(stats.distributionSuccessRate).toBe((150 - 5) / 150 * 100);
    });

    it('应该为指定用户返回统计信息', async () => {
      const userId = 'user-123';

      // Mock用户基础统计
      mockDb.get.mockResolvedValueOnce({
        totalUsers: 1,
        totalDistributed: 25
      });

      // Mock用户失败统计
      mockDb.get.mockResolvedValueOnce({
        failedCount: 1
      });

      // Mock用户平均处理时间
      mockDb.get.mockResolvedValueOnce({
        avgTime: 180
      });

      const stats = await service.getDistributionStats(userId);

      expect(stats.totalUsers).toBe(1);
      expect(stats.distributedUsers).toBe(25);
      expect(stats.failedUsers).toBe(1);
      expect(stats.averageProcessingTime).toBe(180);
    });
  });

  describe('重新分发', () => {
    it('应该成功重新分发内容到指定用户', async () => {
      const contentHash = 'redistribute-hash';
      const targetUserIds = ['user-1', 'user-2'];

      // Mock内容信息
      mockDb.all.mockResolvedValue([{
        id: 1,
        entryId: 1
      }]);

      // Mock R2访问权限检查
      mockDb.get.mockResolvedValue({ id: 1, isActive: true });

      // Mock用户副本创建
      mockSharedContentPool.createUserCopy.mockResolvedValue({
        userId: 'user-1',
        entryId: 1,
        userPath: 'users/user-1/notes/1.md',
        isModified: false
      });

      const results = await service.redistributeContent(contentHash, targetUserIds);

      expect(results).toHaveLength(2);
      expect(results[0].target.userId).toBe('user-1');
      expect(results[1].target.userId).toBe('user-2');
      expect(mockSharedContentPool.createUserCopy).toHaveBeenCalledTimes(2);
    });

    it('应该在找不到内容时抛出错误', async () => {
      const contentHash = 'nonexistent-hash';

      // Mock内容信息（无结果）
      mockDb.all.mockResolvedValue([]);

      await expect(service.redistributeContent(contentHash)).rejects.toThrow('找不到指定的内容');
    });
  });

  describe('清理无效分发记录', () => {
    it('应该成功清理无效的分发记录', async () => {
      // Mock无效引用
      mockDb.all.mockResolvedValue([
        { userId: 'user-1', entryId: 1 },
        { userId: 'user-2', entryId: 2 }
      ]);

      const cleanedCount = await service.cleanupInvalidDistributions();

      expect(cleanedCount).toBe(2);
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });

    it('应该在没有无效记录时返回0', async () => {
      // Mock无无效引用
      mockDb.all.mockResolvedValue([]);

      const cleanedCount = await service.cleanupInvalidDistributions();

      expect(cleanedCount).toBe(0);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  describe('错误处理', () => {
    it('应该处理R2访问权限检查失败', async () => {
      const contentHash = 'no-access-hash';
      const processedContentId = 4;
      const entryId = 4;
      
      const contentFeatures = {
        topics: ['Test'],
        keywords: ['test'],
        importanceScore: 0.7,
        source: 'TestNews',
        contentType: 'news' as const
      };

      // Mock数据库返回活跃用户
      mockDb.get.mockResolvedValue({
        id: 4,
        enabledTopics: 'Test',
        enabledKeywords: 'test'
      });

      // Mock自动存储配置
      mockDb.get.mockResolvedValue({ maxFilesPerDay: 100 });

      // Mock检查现有引用（无）
      mockDb.all.mockResolvedValue([]);

      // Mock今日统计（未达到限制）
      mockDb.get.mockResolvedValue({ totalFiles: 0, totalSize: 0 });

      // Mock R2访问权限检查（无权限）
      mockDb.get.mockResolvedValue(null);

      const results = await service.distributeContent(
        contentHash,
        processedContentId,
        entryId,
        contentFeatures
      );

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('用户缺少R2访问权限');
    });

    it('应该处理用户副本创建失败', async () => {
      const contentHash = 'copy-failed-hash';
      const processedContentId = 5;
      const entryId = 5;
      
      const contentFeatures = {
        topics: ['Test'],
        keywords: ['test'],
        importanceScore: 0.7,
        source: 'TestNews',
        contentType: 'news' as const
      };

      // Mock数据库返回活跃用户
      mockDb.get.mockResolvedValue({
        id: 5,
        enabledTopics: 'Test',
        enabledKeywords: 'test'
      });

      // Mock自动存储配置
      mockDb.get.mockResolvedValue({ maxFilesPerDay: 100 });

      // Mock检查现有引用（无）
      mockDb.all.mockResolvedValue([]);

      // Mock今日统计（未达到限制）
      mockDb.get.mockResolvedValue({ totalFiles: 0, totalSize: 0 });

      // Mock R2访问权限检查
      mockDb.get.mockResolvedValue({ id: 1, isActive: true });

      // Mock用户副本创建失败
      mockSharedContentPool.createUserCopy.mockRejectedValue(new Error('创建副本失败'));

      const results = await service.distributeContent(
        contentHash,
        processedContentId,
        entryId,
        contentFeatures
      );

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('创建副本失败');
    });
  });
});