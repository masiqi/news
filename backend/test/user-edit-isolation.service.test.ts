// 用户编辑隔离服务测试
// 测试用户编辑隔离机制的各种功能和边界情况

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UserEditIsolationService } from '../src/services/user-edit-isolation.service';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { userStorageRefs, contentLibrary, processedContents } from '../src/db/schema';

// 模拟环境变量
const mockEnv = {
  R2_BUCKET: {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    list: vi.fn()
  },
  DB: {} as D1Database
};

// 导入测试工具
import { createMockDb, setupMockQuery, setupMockGet, setupMockAll, setupMockRun } from './utils/db-mock';

// 模拟数据库
const mockDb = createMockDb();

// 模拟WebDAVAuthUser
const mockAuthUser: WebDAVAuthUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  userPathPrefix: 'user/test-user-123/'
};

describe('UserEditIsolationService', () => {
  let isolationService: UserEditIsolationService;

  beforeEach(() => {
    vi.clearAllMocks();
    isolationService = new UserEditIsolationService(mockDb, mockEnv);
  });

  describe('detectAndCreateEditCopy', () => {
    it('应该成功检测编辑操作并创建副本', async () => {
      // 模拟数据库查询结果
      const mockStorageRef = {
        id: 1,
        userId: 'test-user-123',
        entryId: 123,
        contentHash: 'original-hash-123',
        userPath: '/notes/test-article.md',
        fileSize: 1024,
        isModified: false,
        createdAt: new Date(),
        modifiedAt: null
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockStorageRef)
            })
          })
        })
      });

      // 模拟R2服务
      mockEnv.R2_BUCKET.put.mockResolvedValue({
        etag: 'new-etag',
        uploaded: new Date()
      });

      const result = await isolationService.detectAndCreateEditCopy(
        mockAuthUser,
        '/notes/test-article.md',
        'update',
        new TextEncoder().encode('updated content').buffer
      );

      expect(result.success).toBe(true);
      expect(result.copyPath).toBeDefined();
      expect(result.copyPath).toContain('.edit-');
    });

    it('应该跳过非分发内容文件', async () => {
      // 模拟数据库查询结果为空（非分发内容）
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(null)
            })
          })
        })
      });

      const result = await isolationService.detectAndCreateEditCopy(
        mockAuthUser,
        '/notes/personal-note.md',
        'update',
        new TextEncoder().encode('content').buffer
      );

      expect(result.success).toBe(true);
      expect(result.copyPath).toBeUndefined();
    });

    it('应该处理已存在的编辑副本', async () => {
      // 模拟已存在的修改记录
      const mockExistingRef = {
        id: 1,
        userId: 'test-user-123',
        entryId: 123,
        contentHash: 'original-hash-123',
        userPath: '/notes/test-article.edit-timestamp-random.md',
        fileSize: 1024,
        isModified: true,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockExistingRef)
            })
          })
        })
      });

      // 模拟更新操作
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ changes: 1 })
          })
        })
      });

      const result = await isolationService.detectAndCreateEditCopy(
        mockAuthUser,
        '/notes/test-article.md',
        'update',
        new TextEncoder().encode('updated content').buffer
      );

      expect(result.success).toBe(true);
      expect(result.copyPath).toBeDefined();
    });

    it('应该正确处理删除操作', async () => {
      const mockStorageRef = {
        id: 1,
        userId: 'test-user-123',
        entryId: 123,
        contentHash: 'original-hash-123',
        userPath: '/notes/test-article.md',
        fileSize: 1024,
        isModified: false,
        createdAt: new Date(),
        modifiedAt: null
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockStorageRef)
            })
          })
        })
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ changes: 1 })
          })
        })
      });

      const result = await isolationService.detectAndCreateEditCopy(
        mockAuthUser,
        '/notes/test-article.md',
        'delete'
      );

      expect(result.success).toBe(true);
      expect(result.copyPath).toBeDefined();
    });

    it('应该处理错误情况', async () => {
      mockDb.select.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await isolationService.detectAndCreateEditCopy(
        mockAuthUser,
        '/notes/test-article.md',
        'update',
        new TextEncoder().encode('content').buffer
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getUserEditStats', () => {
    it('应该正确返回用户编辑统计', async () => {
      const mockModifiedRefs = [
        {
          id: 1,
          userId: 'test-user-123',
          userPath: '/notes/article1.edit-timestamp-random.md',
          fileSize: 1024,
          isModified: true,
          modifiedAt: new Date(),
          createdAt: new Date()
        },
        {
          id: 2,
          userId: 'test-user-123',
          userPath: '/notes/article2.deleted',
          fileSize: 2048,
          isModified: true,
          modifiedAt: new Date(),
          createdAt: new Date()
        }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(mockModifiedRefs)
            })
          })
        })
      });

      const stats = await isolationService.getUserEditStats('test-user-123');

      expect(stats.totalEdits).toBe(2);
      expect(stats.activeCopies).toBe(2);
      expect(stats.totalStorageUsed).toBe(3072);
      expect(stats.dirtyCopies).toBe(2);
      expect(stats.editsByOperation.update).toBe(1);
      expect(stats.editsByOperation.delete).toBe(1);
      expect(stats.recentEdits).toHaveLength(2);
    });

    it('应该处理空结果情况', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue([])
            })
          })
        })
      });

      const stats = await isolationService.getUserEditStats('test-user-123');

      expect(stats.totalEdits).toBe(0);
      expect(stats.activeCopies).toBe(0);
      expect(stats.totalStorageUsed).toBe(0);
      expect(stats.recentEdits).toHaveLength(0);
    });
  });

  describe('cleanupExpiredCopies', () => {
    it('应该成功清理过期副本', async () => {
      const expiredRefs = [
        {
          id: 1,
          userId: 'test-user-123',
          contentHash: 'hash1',
          userPath: '/notes/expired1.edit-old.md',
          modifiedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) // 40天前
        },
        {
          id: 2,
          userId: 'test-user-123',
          contentHash: 'hash2',
          userPath: '/notes/expired2.edit-old.md',
          modifiedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) // 40天前
        }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(expiredRefs)
        })
      });

      // 模拟没有其他用户引用
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue([])
          })
        })
      });

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ changes: 2 })
        })
      });

      const result = await isolationService.cleanupExpiredCopies(30 * 24 * 60 * 60 * 1000);

      expect(result.cleaned).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('应该处理清理过程中的错误', async () => {
      mockDb.select.mockImplementation(() => {
        throw new Error('Cleanup error');
      });

      const result = await isolationService.cleanupExpiredCopies();

      expect(result.cleaned).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('Cleanup error');
    });
  });

  describe('canEditContent', () => {
    it('应该正确检查编辑权限', async () => {
      const mockUserRef = {
        id: 1,
        userId: 'test-user-123',
        contentHash: 'test-hash-123',
        userPath: '/notes/test.md'
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockUserRef)
            })
          })
        })
      });

      const result = await isolationService.canEditContent('test-user-123', 'test-hash-123');

      expect(result.canEdit).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('应该拒绝无权限用户的编辑', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(null)
            })
          })
        })
      });

      const result = await isolationService.canEditContent('test-user-123', 'test-hash-123');

      expect(result.canEdit).toBe(false);
      expect(result.reason).toBe('用户没有该内容的访问权限');
    });
  });

  describe('getUserEditHistory', () => {
    it('应该正确返回用户编辑历史', async () => {
      const mockRefs = [
        {
          id: 1,
          userId: 'test-user-123',
          userPath: '/notes/article1.edit-timestamp.md',
          fileSize: 1024,
          isModified: true,
          modifiedAt: new Date(),
          createdAt: new Date(),
          entryId: 123
        }
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(mockRefs)
            })
          })
        })
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ count: 1 })
          })
        })
      });

      const result = await isolationService.getUserEditHistory('test-user-123', 10, 0);

      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.events[0].operation).toBe('update');
      expect(result.events[0].userId).toBe('test-user-123');
    });

    it('应该处理分页参数', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue([]),
              offset: vi.fn()
            })
          })
        })
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ count: 0 })
          })
        })
      });

      const result = await isolationService.getUserEditHistory('test-user-123', 5, 10);

      expect(result.events).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('辅助方法', () => {
    it('应该正确生成副本路径', () => {
      const service = new UserEditIsolationService(mockDb, mockEnv);
      
      // 测试不同操作类型
      const updatePath = service['generateCopyPath'](mockAuthUser, '/notes/test.md', 'update');
      expect(updatePath).toContain('/notes/test.edit-');
      expect(updatePath.slice(-3)).toBe('.md');
      
      const deletePath = service['generateCopyPath'](mockAuthUser, '/notes/test.md', 'delete');
      expect(deletePath).toContain('/notes/test.edit-');
      
      const copyPath = service['generateCopyPath'](mockAuthUser, '/notes/test.md', 'copy');
      expect(copyPath).toContain('/notes/test.edit-');
    });

    it('应该正确推断操作类型', () => {
      const service = new UserEditIsolationService(mockDb, mockEnv);
      
      expect(service['inferOperationFromPath']('/notes/test.edit-timestamp.md')).toBe('update');
      expect(service['inferOperationFromPath']('/notes/test.deleted')).toBe('delete');
      expect(service['inferOperationFromPath']('/notes/test.move-timestamp.md')).toBe('move');
      expect(service['inferOperationFromPath']('/notes/test.copy-timestamp.md')).toBe('copy');
      expect(service['inferOperationFromPath']('/notes/test.md')).toBe('create');
    });

    it('应该正确生成内容哈希', () => {
      const service = new UserEditIsolationService(mockDb, mockEnv);
      const content = new TextEncoder().encode('test content').buffer;
      const hash = service['generateContentHash'](content);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 hex length
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('应该正确生成事件ID', () => {
      const service = new UserEditIsolationService(mockDb, mockEnv);
      const eventId1 = service['generateEventId']();
      const eventId2 = service['generateEventId']();
      
      expect(eventId1).toBeDefined();
      expect(eventId2).toBeDefined();
      expect(eventId1).not.toBe(eventId2);
      expect(eventId1).toMatch(/^event-\d+-[a-z0-9]+$/);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});