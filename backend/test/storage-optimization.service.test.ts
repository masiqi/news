// 存储优化服务测试
// 测试存储优化机制的各种功能和边界情况

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StorageOptimizationService, StorageOptimizationConfig } from '../src/services/storage-optimization.service';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, lt, gt, sql } from 'drizzle-orm';
import { 
  userStorageRefs, 
  contentLibrary, 
  storageStats,
  userAutoStorageConfigs
} from '../src/db/schema';

// 模拟环境变量
const mockEnv = {
  R2_BUCKET: {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    head: vi.fn()
  },
  DB: {} as D1Database
};

// 模拟数据库
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
};

// 模拟R2Service
const mockR2Service = {
  getObject: vi.fn(),
  deleteObject: vi.fn(),
  putObject: vi.fn(),
  listObjects: vi.fn(),
  headObject: vi.fn()
};

// 模拟SharedContentPoolService
const mockSharedContentPool = {
  optimizeReferences: vi.fn()
};

describe('StorageOptimizationService', () => {
  let optimizationService: StorageOptimizationService;
  let defaultConfig: StorageOptimizationConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    defaultConfig = {
      minReferenceCount: 0,
      maxUnusedDays: 30,
      enableCompression: true,
      compressionThreshold: 1024 * 1024,
      compressionTargets: ['text/markdown', 'text/plain'],
      enableLifecycle: true,
      defaultTTL: 90,
      tieredStorage: true,
      enableQuota: true,
      defaultUserQuota: 1024 * 1024 * 1024,
      quotaEnforcement: true
    };

    // 模拟依赖
    vi.doMock('../r2.service', () => ({
      R2Service: vi.fn().mockImplementation(() => mockR2Service)
    }));

    vi.doMock('../shared-content-pool.service', () => ({
      SharedContentPoolService: vi.fn().mockImplementation(() => mockSharedContentPool)
    }));

    optimizationService = new StorageOptimizationService(mockDb, mockEnv, defaultConfig);
  });

  describe('cleanupUnusedContent', () => {
    it('应该成功清理未使用内容', async () => {
      const mockUnusedContent = [
        {
          id: 1,
          contentHash: 'unused-hash-1',
          contentSize: 1024,
          referenceCount: 0,
          lastAccessedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
        },
        {
          id: 2,
          contentHash: 'unused-hash-2',
          contentSize: 2048,
          referenceCount: 0,
          lastAccessedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
        }
      ];

      // 模拟数据库查询
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(mockUnusedContent)
        })
      });

      // 模拟没有用户引用
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue([])
          })
        })
      });

      // 模拟R2删除
      mockR2Service.deleteObject.mockResolvedValue(true);

      // 模拟数据库删除
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ changes: 1 })
        })
      });

      const result = await optimizationService.cleanupUnusedContent();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.savedSpace).toBe(3072);
      expect(result.errors).toHaveLength(0);
    });

    it('应该跳过仍有用户引用的内容', async () => {
      const mockUnusedContent = [
        {
          id: 1,
          contentHash: 'unused-hash-1',
          contentSize: 1024,
          referenceCount: 0,
          lastAccessedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
        }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(mockUnusedContent)
        })
      });

      // 模拟仍有用户引用
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue([{ id: 1 }])
          })
        })
      });

      const result = await optimizationService.cleanupUnusedContent();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.savedSpace).toBe(0); // 没有实际删除
    });

    it('应该处理清理过程中的错误', async () => {
      const mockUnusedContent = [
        {
          id: 1,
          contentHash: 'unused-hash-1',
          contentSize: 1024,
          referenceCount: 0,
          lastAccessedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
        }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(mockUnusedContent)
        })
      });

      // 模拟R2删除失败
      mockR2Service.deleteObject.mockRejectedValue(new Error('R2 delete failed'));

      const result = await optimizationService.cleanupUnusedContent();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('unused-hash-1');
    });
  });

  describe('compressLargeFiles', () => {
    it('应该成功压缩大文件', async () => {
      const mockLargeFiles = [
        {
          id: 1,
          contentHash: 'large-file-1',
          contentSize: 2 * 1024 * 1024, // 2MB
          isCompressed: false
        },
        {
          id: 2,
          contentHash: 'large-file-2',
          contentSize: 1.5 * 1024 * 1024, // 1.5MB
          isCompressed: false
        }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(mockLargeFiles)
        })
      });

      // 模拟获取文件内容
      mockR2Service.getObject.mockResolvedValue({
        arrayBuffer: () => new ArrayBuffer(2 * 1024 * 1024)
      });

      // 模拟更新数据库
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ changes: 1 })
          })
        })
      });

      const result = await optimizationService.compressLargeFiles();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.savedSpace).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('应该跳过已压缩的文件', async () => {
      const mockFiles = [
        {
          id: 1,
          contentHash: 'compressed-file',
          contentSize: 2 * 1024 * 1024,
          isCompressed: true
        }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(mockFiles)
        })
      });

      const result = await optimizationService.compressLargeFiles();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.savedSpace).toBe(0); // 没有新压缩
    });
  });

  describe('applyLifecyclePolicy', () => {
    it('应该成功删除过期内容', async () => {
      const mockExpiredContent = [
        {
          id: 1,
          contentHash: 'expired-hash-1',
          contentSize: 1024,
          referenceCount: 0,
          createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) // 100天前
        },
        {
          id: 2,
          contentHash: 'expired-hash-2',
          contentSize: 2048,
          referenceCount: 0,
          createdAt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000) // 95天前
        }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(mockExpiredContent)
        })
      });

      mockR2Service.deleteObject.mockResolvedValue(true);
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ changes: 1 })
        })
      });

      const result = await optimizationService.applyLifecyclePolicy();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.savedSpace).toBe(3072);
    });

    it('应该保留仍有引用的内容', async () => {
      const mockContent = [
        {
          id: 1,
          contentHash: 'referenced-hash',
          contentSize: 1024,
          referenceCount: 1,
          createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
        }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(mockContent)
        })
      });

      const result = await optimizationService.applyLifecyclePolicy();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.savedSpace).toBe(0); // 没有删除
    });
  });

  describe('manageUserQuotas', () => {
    it('应该检查用户配额并执行清理', async () => {
      const mockUserUsage = [
        {
          userId: 'user-1',
          usedSize: 1.1 * 1024 * 1024 * 1024, // 超过1GB配额
          quota: 1024 * 1024 * 1024
        },
        {
          userId: 'user-2',
          usedSize: 0.9 * 1024 * 1024 * 1024, // 90%配额使用
          quota: 1024 * 1024 * 1024
        }
      ];

      // 模拟获取用户使用情况
      vi.spyOn(optimizationService as any, 'getUserStorageUsage').mockResolvedValue(mockUserUsage);

      // 模拟清理用户旧内容
      vi.spyOn(optimizationService as any, 'cleanupUserOldestContent').mockResolvedValue({
        processed: 5,
        savedSpace: 512 * 1024
      });

      const result = await optimizationService.manageUserQuotas();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.details.usersOverQuota).toBe(1);
      expect(result.details.usersNearQuota).toBe(1);
    });
  });

  describe('defragmentStorage', () => {
    it('应该成功整理存储碎片', async () => {
      const mockFragmentedContent = [
        { contentHash: 'fragment-1', count: 3 },
        { contentHash: 'fragment-2', count: 2 }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            having: vi.fn().mockReturnValue(mockFragmentedContent)
          })
        })
      });

      mockSharedContentPool.optimizeReferences.mockResolvedValue(true);

      const result = await optimizationService.defragmentStorage();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.details.defragmented).toBe(2);
    });
  });

  describe('optimizeIndexes', () => {
    it('应该成功优化索引', async () => {
      // 模拟更新存储统计
      vi.spyOn(optimizationService as any, 'updateStorageStats').mockResolvedValue(undefined);

      // 模拟清理无效引用
      vi.spyOn(optimizationService as any, 'cleanupInvalidStorageRefs').mockResolvedValue(5);

      // 模拟优化访问模式
      vi.spyOn(optimizationService as any, 'optimizeContentAccessPatterns').mockResolvedValue(undefined);

      const result = await optimizationService.optimizeIndexes();

      expect(result.success).toBe(true);
      expect(result.details.invalidRefsCleaned).toBe(5);
      expect(result.details.statsUpdated).toBe(true);
    });
  });

  describe('getStorageOptimizationStats', () => {
    it('应该正确返回存储统计', async () => {
      const mockStats = {
        totalSize: 1024 * 1024 * 1024, // 1GB
        totalFiles: 100,
        compressedFiles: 50,
        totalCompressedSize: 700 * 1024 * 1024 // 700MB
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockStats)
        })
      });

      // 模拟未使用内容统计
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ count: 10 })
        })
      });

      // 模拟用户使用情况
      vi.spyOn(optimizationService as any, 'getUserStorageUsage').mockResolvedValue([
        { userId: 'user-1', usedSize: 100 * 1024 * 1024, quota: 1024 * 1024 * 1024 }
      ]);

      const stats = await optimizationService.getStorageOptimizationStats();

      expect(stats.totalSize).toBe(1024 * 1024 * 1024);
      expect(stats.compressionRatio).toBeGreaterThan(0);
      expect(stats.cleanupStats.unusedContent).toBe(10);
      expect(stats.userQuotaStats.activeUsers).toBe(1);
    });

    it('应该处理错误情况并返回默认统计', async () => {
      mockDb.select.mockImplementation(() => {
        throw new Error('Database error');
      });

      const stats = await optimizationService.getStorageOptimizationStats();

      expect(stats.totalSize).toBe(0);
      expect(stats.compressionRatio).toBe(0);
      expect(stats.userQuotaStats.activeUsers).toBe(0);
    });
  });

  describe('runFullOptimization', () => {
    it('应该成功执行完整优化', async () => {
      // 模拟各个优化步骤
      vi.spyOn(optimizationService, 'cleanupUnusedContent').mockResolvedValue({
        type: 'cleanup_unused_content',
        success: true,
        processed: 5,
        savedSpace: 1024,
        errors: [],
        duration: 1000,
        details: {}
      });

      vi.spyOn(optimizationService, 'compressLargeFiles').mockResolvedValue({
        type: 'compress_large_files',
        success: true,
        processed: 3,
        savedSpace: 2048,
        errors: [],
        duration: 2000,
        details: {}
      });

      vi.spyOn(optimizationService, 'applyLifecyclePolicy').mockResolvedValue({
        type: 'apply_lifecycle_policy',
        success: true,
        processed: 2,
        savedSpace: 512,
        errors: [],
        duration: 1500,
        details: {}
      });

      vi.spyOn(optimizationService, 'manageUserQuotas').mockResolvedValue({
        type: 'manage_user_quotas',
        success: true,
        processed: 10,
        savedSpace: 0,
        errors: [],
        duration: 500,
        details: {}
      });

      vi.spyOn(optimizationService, 'defragmentStorage').mockResolvedValue({
        type: 'defragment_storage',
        success: true,
        processed: 1,
        savedSpace: 0,
        errors: [],
        duration: 300,
        details: {}
      });

      vi.spyOn(optimizationService, 'optimizeIndexes').mockResolvedValue({
        type: 'optimize_indexes',
        success: true,
        processed: 1,
        savedSpace: 0,
        errors: [],
        duration: 200,
        details: {}
      });

      vi.spyOn(optimizationService, 'getStorageOptimizationStats').mockResolvedValue({
        totalSize: 1024 * 1024,
        usedSize: 512 * 1024,
        availableSize: 0,
        compressionRatio: 0.5,
        cleanupStats: { totalCleaned: 0, spaceSaved: 0, unusedContent: 0 },
        userQuotaStats: { activeUsers: 0, usersNearQuota: 0, usersOverQuota: 0, totalQuotaUsage: 0 },
        performanceMetrics: { averageAccessTime: 0, hitRate: 0, compressionEfficiency: 0.5 }
      });

      const result = await optimizationService.runFullOptimization();

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(6);
      expect(result.totalSaved).toBe(3584); // 1024 + 2048 + 512
      expect(result.duration).toBeGreaterThan(0);
      expect(result.stats).toBeDefined();
    });

    it('应该处理优化过程中的部分失败', async () => {
      vi.spyOn(optimizationService, 'cleanupUnusedContent').mockResolvedValue({
        type: 'cleanup_unused_content',
        success: true,
        processed: 5,
        savedSpace: 1024,
        errors: [],
        duration: 1000,
        details: {}
      });

      vi.spyOn(optimizationService, 'compressLargeFiles').mockResolvedValue({
        type: 'compress_large_files',
        success: false,
        processed: 0,
        savedSpace: 0,
        errors: ['Compression failed'],
        duration: 2000,
        details: {}
      });

      vi.spyOn(optimizationService, 'getStorageOptimizationStats').mockResolvedValue({
        totalSize: 0,
        usedSize: 0,
        availableSize: 0,
        compressionRatio: 0,
        cleanupStats: { totalCleaned: 0, spaceSaved: 0, unusedContent: 0 },
        userQuotaStats: { activeUsers: 0, usersNearQuota: 0, usersOverQuota: 0, totalQuotaUsage: 0 },
        performanceMetrics: { averageAccessTime: 0, hitRate: 0, compressionEfficiency: 0 }
      });

      const result = await optimizationService.runFullOptimization();

      expect(result.success).toBe(false);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.totalSaved).toBe(1024);
    });
  });

  describe('配置验证', () => {
    it('应该使用正确的默认配置', () => {
      const service = new StorageOptimizationService(mockDb, mockEnv);
      const config = (service as any).config;

      expect(config.minReferenceCount).toBe(0);
      expect(config.maxUnusedDays).toBe(30);
      expect(config.enableCompression).toBe(true);
      expect(config.compressionThreshold).toBe(1024 * 1024);
      expect(config.enableLifecycle).toBe(true);
      expect(config.defaultTTL).toBe(90);
      expect(config.enableQuota).toBe(true);
      expect(config.defaultUserQuota).toBe(1024 * 1024 * 1024);
    });

    it('应该正确应用自定义配置', () => {
      const customConfig = {
        minReferenceCount: 1,
        maxUnusedDays: 60,
        enableCompression: false,
        defaultUserQuota: 2 * 1024 * 1024 * 1024
      };

      const service = new StorageOptimizationService(mockDb, mockEnv, customConfig);
      const config = (service as any).config;

      expect(config.minReferenceCount).toBe(1);
      expect(config.maxUnusedDays).toBe(60);
      expect(config.enableCompression).toBe(false);
      expect(config.defaultUserQuota).toBe(2 * 1024 * 1024 * 1024);
      
      // 未指定的配置应该使用默认值
      expect(config.enableLifecycle).toBe(true);
      expect(config.defaultTTL).toBe(90);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});