// src/services/shared-content-pool.service.test.ts
// 共享内容池服务测试文件

import { SharedContentPoolService } from './shared-content-pool.service';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock D1数据库和R2服务
const mockDb = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
  get: vi.fn(),
  all: vi.fn(),
  sql: vi.fn(),
};

const mockR2Service = {
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
  deleteFile: vi.fn(),
};

describe('SharedContentPoolService', () => {
  let service: SharedContentPoolService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SharedContentPoolService(mockDb, mockR2Service);
  });

  describe('存储到共享池', () => {
    it('应该成功存储新内容到共享池', async () => {
      const contentHash = 'test-hash-123';
      const markdownContent = '# Test Content\nThis is a test.';
      const metadata = {
        title: 'Test Article',
        source: 'Test Source',
        publishedAt: new Date(),
        processingTime: 1000,
        modelUsed: 'test-model',
        wordCount: 10,
        entryId: 123
      };

      // Mock数据库返回不存在
      mockDb.get.mockResolvedValue(null);
      mockDb.returning.mockResolvedValue([{
        id: 1,
        contentHash,
        storagePath: 'shared-content/test-hash-123/original.md',
        referenceCount: 0,
        fileSize: 25,
        createdAt: new Date(),
        lastAccessedAt: new Date()
      }]);

      const result = await service.storeToSharedPool(contentHash, markdownContent, metadata);

      expect(result.contentHash).toBe(contentHash);
      expect(result.originalPath).toContain(contentHash);
      expect(result.referenceCount).toBe(0);
      expect(mockR2Service.uploadFile).toHaveBeenCalledTimes(2); // 内容文件 + 元数据文件
    });

    it('应该返回已存在的共享内容', async () => {
      const contentHash = 'existing-hash';
      const markdownContent = '# Existing Content';
      const metadata = { title: 'Existing', source: 'Test', publishedAt: new Date(), processingTime: 1000, modelUsed: 'test', wordCount: 5, entryId: 456 };

      // Mock数据库返回已存在
      mockDb.get.mockResolvedValue({
        id: 1,
        contentHash,
        storagePath: 'shared-content/existing-hash/original.md',
        referenceCount: 2,
        fileSize: 50,
        createdAt: new Date(),
        lastAccessedAt: new Date()
      });

      const result = await service.storeToSharedPool(contentHash, markdownContent, metadata);

      expect(result.contentHash).toBe(contentHash);
      expect(result.referenceCount).toBe(2);
      expect(mockR2Service.uploadFile).not.toHaveBeenCalled(); // 不应该重复上传
    });
  });

  describe('创建用户副本', () => {
    it('应该成功为用户创建内容副本', async () => {
      const userId = 'user1';
      const entryId = 123;
      const contentHash = 'test-hash';

      // Mock用户引用不存在
      mockDb.get.mockResolvedValueOnce(null); // 用户引用检查
      
      // Mock共享内容存在
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        contentHash,
        storagePath: 'shared-content/test-hash/original.md',
        referenceCount: 1,
        fileSize: 100,
        createdAt: new Date()
      });

      // Mock文件下载和上传
      const contentBuffer = new TextEncoder().encode('# Test Content');
      mockR2Service.downloadFile.mockResolvedValue(contentBuffer);
      
      // Mock创建用户引用记录
      mockDb.returning.mockResolvedValue([{
        id: 1,
        userId,
        entryId,
        contentHash,
        userPath: 'users/user1/notes/123.md',
        isModified: false,
        currentHash: contentHash,
        fileSize: 100,
        createdAt: new Date()
      }]);

      const result = await service.createUserCopy(userId, entryId, contentHash);

      expect(result.userId).toBe(userId);
      expect(result.entryId).toBe(entryId);
      expect(result.isModified).toBe(false);
      expect(result.currentHash).toBe(contentHash);
      expect(mockR2Service.downloadFile).toHaveBeenCalledTimes(1);
      expect(mockR2Service.uploadFile).toHaveBeenCalledTimes(1);
    });

    it('应该返回已存在的用户副本', async () => {
      const userId = 'user1';
      const entryId = 123;
      const contentHash = 'test-hash';

      // Mock用户引用已存在
      mockDb.get.mockResolvedValue({
        id: 1,
        userId,
        entryId,
        contentHash,
        userPath: 'users/user1/notes/123.md',
        isModified: false,
        currentHash: contentHash,
        fileSize: 100,
        createdAt: new Date()
      });

      const result = await service.createUserCopy(userId, entryId, contentHash);

      expect(result.userId).toBe(userId);
      expect(result.isModified).toBe(false);
      expect(mockR2Service.downloadFile).not.toHaveBeenCalled(); // 不需要重新下载
      expect(mockR2Service.uploadFile).not.toHaveBeenCalled(); // 不需要重新上传
    });
  });

  describe('处理用户内容更新', () => {
    it('应该检测内容变化并创建独立副本', async () => {
      const userId = 'user1';
      const entryId = 123;
      const newContent = '# Updated Content\nThis has been modified.';
      const newHash = 'updated-hash-456';

      // Mock用户引用存在且未修改
      mockDb.get.mockResolvedValue({
        id: 1,
        userId,
        entryId,
        contentHash: 'original-hash',
        userPath: 'users/user1/notes/123.md',
        isModified: false,
        currentHash: 'original-hash',
        fileSize: 100,
        createdAt: new Date()
      });

      const result = await service.handleUserContentUpdate(userId, entryId, newContent);

      expect(result.isNewCopy).toBe(true);
      expect(mockR2Service.uploadFile).toHaveBeenCalledTimes(1); // 保存新内容
    });

    it('应该忽略内容未变化的更新', async () => {
      const userId = 'user1';
      const entryId = 123;
      const sameContent = '# Same Content\nNo changes here.';
      const sameHash = 'same-hash-789';

      // Mock用户引用存在且当前哈希匹配
      mockDb.get.mockResolvedValue({
        id: 1,
        userId,
        entryId,
        contentHash: 'original-hash',
        userPath: 'users/user1/notes/123.md',
        isModified: false,
        currentHash: sameHash,
        fileSize: 100,
        createdAt: new Date()
      });

      // Mock哈希计算结果相同
      vi.spyOn(service as any, 'computeContentHash').mockResolvedValue(sameHash);

      const result = await service.handleUserContentUpdate(userId, entryId, sameContent);

      expect(result.isNewCopy).toBe(false);
      expect(mockR2Service.uploadFile).not.toHaveBeenCalled(); // 不需要重新保存
    });
  });

  describe('获取用户内容', () => {
    it('应该成功获取用户内容', async () => {
      const userId = 'user1';
      const entryId = 123;
      const expectedContent = '# User Content\nThis is user-specific content.';

      // Mock用户引用存在
      mockDb.get.mockResolvedValue({
        id: 1,
        userId,
        entryId,
        contentHash: 'test-hash',
        userPath: 'users/user1/notes/123.md',
        isModified: true,
        currentHash: 'modified-hash',
        fileSize: 150,
        createdAt: new Date()
      });

      // Mock文件下载
      const contentBuffer = new TextEncoder().encode(expectedContent);
      mockR2Service.downloadFile.mockResolvedValue(contentBuffer);

      const result = await service.getUserContent(userId, entryId);

      expect(result.content).toBe(expectedContent);
      expect(result.path).toBe('users/user1/notes/123.md');
      expect(result.isModified).toBe(true);
    });
  });

  describe('清理孤立内容', () => {
    it('应该成功清理引用计数为0的内容', async () => {
      // Mock引用计数为0的内容
      mockDb.all.mockResolvedValue([
        {
          id: 1,
          contentHash: 'orphaned-hash-1',
          storagePath: 'shared-content/orphaned-hash-1/original.md',
          fileSize: 200,
          createdAt: new Date()
        },
        {
          id: 2,
          contentHash: 'orphaned-hash-2',
          storagePath: 'shared-content/orphaned-hash-2/original.md',
          fileSize: 150,
          createdAt: new Date()
        }
      ]);

      mockDb.delete.mockReturnThis();
      mockDb.where.mockReturnThis();

      const result = await service.cleanupOrphanedContent();

      expect(result.removed).toBe(2);
      expect(result.spaceFreed).toBe(350); // 200 + 150
      expect(mockR2Service.deleteFile).toHaveBeenCalledTimes(4); // 每个内容2个文件（内容+元数据）
    });

    it('应该正确处理清理错误', async () => {
      // Mock清理过程中出现错误
      mockDb.all.mockResolvedValue([
        {
          id: 1,
          contentHash: 'error-hash',
          storagePath: 'shared-content/error-hash/original.md',
          fileSize: 100,
          createdAt: new Date()
        }
      ]);

      mockR2Service.deleteFile.mockRejectedValue(new Error('删除失败'));

      const result = await service.cleanupOrphanedContent();

      expect(result.removed).toBe(0);
      expect(result.spaceFreed).toBe(0);
    });
  });

  describe('存储统计', () => {
    it('应该返回正确的存储统计信息', async () => {
      // Mock数据库统计结果
      mockDb.get.mockImplementation((query) => {
        if (query.includes('content_library')) {
          return Promise.resolve({
            totalFiles: 50,
            totalSize: 50000,
            totalReferences: 150
          });
        } else if (query.includes('user_storage_refs')) {
          return Promise.resolve({
            totalFiles: 200,
            totalSize: 80000,
            modifiedFiles: 30
          });
        }
        return Promise.resolve({ count: 0 });
      });

      const stats = await service.getStorageStats();

      expect(stats.totalSharedFiles).toBe(50);
      expect(stats.totalUserFiles).toBe(200);
      expect(stats.totalStorageUsed).toBe(130000); // 50000 + 80000
      expect(stats.sharedContentSavings).toBeGreaterThan(0); // 应该有节省
    });
  });
});