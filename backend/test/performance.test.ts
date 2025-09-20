// 性能测试套件
// 验证系统在高负载情况下的性能表现

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ContentDistributionService } from '../src/services/content-distribution.service';
import { StorageOptimizationService } from '../src/services/storage-optimization.service';

describe('性能测试 - 系统高负载性能验证', () => {
  let contentDistribution: ContentDistributionService;
  let storageOptimization: StorageOptimizationService;

  // Mock服务依赖
  let mockSharedContentPool: any;
  let mockR2Service: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSharedContentPool = {
      createUserCopy: vi.fn().mockResolvedValue({
        userPath: 'users/123/content.md',
        success: true
      }),
      cleanupOrphanedContent: vi.fn().mockResolvedValue(0),
      getStorageStats: vi.fn().mockResolvedValue({
        totalSize: 1024 * 1024 * 100,
        totalFiles: 1000,
        sharedCount: 500,
        userCopies: 500
      })
    };

    mockR2Service = {
      uploadFile: vi.fn().mockResolvedValue({ success: true, key: 'test/content.md' }),
      downloadFile: vi.fn().mockResolvedValue('测试内容'),
      deleteFile: vi.fn().mockResolvedValue(true),
      fileExists: vi.fn().mockResolvedValue(true),
      listFiles: vi.fn().mockResolvedValue(
        Array.from({ length: 1000 }, (_, i) => ({
          key: `file${i}.md`,
          size: Math.floor(Math.random() * 10 * 1024 * 1024),
          lastModified: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
        }))
      )
    };

    contentDistribution = new ContentDistributionService(mockSharedContentPool, mockR2Service);
    storageOptimization = new StorageOptimizationService({} as any, mockR2Service);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('内容分发性能测试', () => {
    it('应该能够高效处理大量内容匹配计算', () => {
      const servicePrivate = contentDistribution as any;
      
      const contentFeatures = {
        topics: ['AI', 'Technology', 'Programming', 'Machine Learning', 'Data Science'],
        keywords: ['machine learning', 'AI', 'programming', 'data science', 'neural networks'],
        importanceScore: 0.8,
        source: 'TechBlog',
        contentType: 'news' as const
      };

      // 生成大量用户偏好 - 模拟10,000用户
      const userPreferences = Array.from({ length: 10000 }, (_, i) => ({
        userId: i.toString(),
        enabledTopics: ['AI', 'Technology', 'Programming'],
        enabledKeywords: ['AI', 'machine learning', 'programming'],
        minImportanceScore: 0.6,
        maxDailyContent: 100,
        contentTypes: ['news', 'analysis', 'tutorial'],
        deliverySchedule: 'realtime' as const
      }));

      const startTime = Date.now();
      
      // 计算所有用户的匹配分数
      const scores = userPreferences.map(preference => 
        servicePrivate.calculateContentMatchScore(contentFeatures, preference)
      );
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      console.log(`处理 ${userPreferences.length} 个用户匹配计算耗时: ${processingTime}ms`);
      console.log(`平均每个用户计算时间: ${(processingTime / userPreferences.length).toFixed(3)}ms`);

      expect(scores).toHaveLength(10000);
      expect(scores.every(score => score >= 0)).toBe(true);
      expect(processingTime).toBeLessThan(1000); // 应该在1秒内完成10,000个用户的计算
    });

    it('应该能够高效处理不同复杂度的内容匹配', () => {
      const servicePrivate = contentDistribution as any;
      
      // 测试不同复杂度的内容特征
      const contentComplexities = [
        {
          name: '简单内容',
          features: {
            topics: ['AI'],
            keywords: ['AI'],
            importanceScore: 0.8,
            source: 'SimpleBlog',
            contentType: 'news' as const
          }
        },
        {
          name: '中等复杂度内容',
          features: {
            topics: ['AI', 'Technology', 'Programming'],
            keywords: ['machine learning', 'AI', 'programming', 'data science'],
            importanceScore: 0.8,
            source: 'TechBlog',
            contentType: 'analysis' as const
          }
        },
        {
          name: '高复杂度内容',
          features: {
            topics: ['AI', 'Technology', 'Programming', 'Machine Learning', 'Data Science', 'Blockchain', 'Cloud Computing'],
            keywords: ['machine learning', 'AI', 'programming', 'data science', 'neural networks', 'deep learning', 'blockchain', 'cloud'],
            importanceScore: 0.8,
            source: 'ComplexTechBlog',
            contentType: 'tutorial' as const
          }
        }
      ];

      const userPreference = {
        userId: '1',
        enabledTopics: ['AI', 'Technology', 'Programming'],
        enabledKeywords: ['AI', 'machine learning', 'programming'],
        minImportanceScore: 0.6,
        maxDailyContent: 100,
        contentTypes: ['news', 'analysis', 'tutorial'],
        deliverySchedule: 'realtime' as const
      };

      const results = contentComplexities.map(complexity => {
        const startTime = Date.now();
        
        // 执行1000次匹配计算
        for (let i = 0; i < 1000; i++) {
          servicePrivate.calculateContentMatchScore(complexity.features, userPreference);
        }
        
        const endTime = Date.now();
        const avgTime = (endTime - startTime) / 1000;
        
        return {
          complexity: complexity.name,
          avgTimeMs: avgTime,
          topicCount: complexity.features.topics.length,
          keywordCount: complexity.features.keywords.length
        };
      });

      console.log('内容匹配性能结果:', results);

      // 验证性能随复杂度增长的合理性
      expect(results[0].avgTimeMs).toBeLessThan(0.1); // 简单内容应该非常快
      expect(results[1].avgTimeMs).toBeLessThan(0.2); // 中等复杂度内容
      expect(results[2].avgTimeMs).toBeLessThan(0.3); // 高复杂度内容
    });

    it('应该能够高效处理批量内容分发决策', () => {
      const servicePrivate = contentDistribution as any;
      
      // 生成大量内容项
      const contentItems = Array.from({ length: 1000 }, (_, i) => ({
        contentHash: `hash${i}`,
        entryId: i,
        processedContentId: i,
        features: {
          topics: ['AI', 'Technology', 'Programming', 'Machine Learning'],
          keywords: ['machine learning', 'AI', 'programming', 'data science'],
          importanceScore: 0.6 + (Math.random() * 0.4),
          source: 'TechBlog',
          contentType: ['news', 'analysis', 'tutorial'][Math.floor(Math.random() * 3)] as const
        }
      }));

      // 生成大量用户偏好
      const userPreferences = Array.from({ length: 100 }, (_, i) => ({
        userId: i.toString(),
        enabledTopics: ['AI', 'Technology', 'Programming'],
        enabledKeywords: ['AI', 'machine learning', 'programming'],
        minImportanceScore: 0.6,
        maxDailyContent: 100,
        contentTypes: ['news', 'analysis', 'tutorial'],
        deliverySchedule: 'realtime' as const
      }));

      const startTime = Date.now();
      
      // 为每个内容项计算匹配的用户
      const matches = contentItems.map(content => {
        const matchingUsers = userPreferences.filter(user => {
          const score = servicePrivate.calculateContentMatchScore(content.features, user);
          return score >= 0.3; // 30%阈值
        });
        return {
          contentHash: content.contentHash,
          matchingUserCount: matchingUsers.length,
          avgScore: matchingUsers.reduce((sum, user) => {
            return sum + servicePrivate.calculateContentMatchScore(content.features, user);
          }, 0) / matchingUsers.length || 0
        };
      });
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      console.log(`处理 ${contentItems.length} 个内容项与 ${userPreferences.length} 个用户的匹配耗时: ${processingTime}ms`);
      console.log(`平均每个内容项处理时间: ${(processingTime / contentItems.length).toFixed(3)}ms`);
      console.log(`总匹配数: ${matches.reduce((sum, m) => sum + m.matchingUserCount, 0)}`);
      console.log(`平均每个内容匹配用户数: ${(matches.reduce((sum, m) => sum + m.matchingUserCount, 0) / matches.length).toFixed(2)}`);

      expect(matches).toHaveLength(1000);
      expect(processingTime).toBeLessThan(5000); // 应该在5秒内完成
    });
  });

  describe('存储优化性能测试', () => {
    it('应该能够高效处理大量存储分析决策', () => {
      const servicePrivate = storageOptimization as any;
      
      // 生成大量内容项进行清理分析
      const contentItems = Array.from({ length: 10000 }, (_, i) => ({
        contentHash: `hash${i}`,
        referenceCount: Math.floor(Math.random() * 10),
        lastAccessedAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        size: Math.floor(Math.random() * 10 * 1024 * 1024)
      }));

      const startTime = Date.now();
      
      // 模拟清理决策逻辑
      const cleanupCandidates = contentItems.filter(item => {
        return item.referenceCount === 0 && 
               (Date.now() - item.lastAccessedAt.getTime()) > 30 * 24 * 60 * 60 * 1000;
      });
      
      const compressionCandidates = contentItems.filter(item => {
        return item.size >= 1024 * 1024 && item.referenceCount > 0;
      });
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      console.log(`分析 ${contentItems.length} 个内容项耗时: ${processingTime}ms`);
      console.log(`清理候选数: ${cleanupCandidates.length}`);
      console.log(`压缩候选数: ${compressionCandidates.length}`);
      console.log(`平均每个项目分析时间: ${(processingTime / contentItems.length).toFixed(3)}ms`);

      expect(cleanupCandidates.length + compressionCandidates.length).toBeGreaterThan(0);
      expect(processingTime).toBeLessThan(100); // 应该在100ms内完成10,000个项目的分析
    });

    it('应该能够高效处理存储统计计算', () => {
      // 生成大量文件数据
      const files = Array.from({ length: 50000 }, (_, i) => ({
        key: `file${i}.md`,
        size: Math.floor(Math.random() * 10 * 1024 * 1024),
        lastModified: Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000,
        contentType: ['shared', 'user-copy', 'original'][Math.floor(Math.random() * 3)]
      }));

      const startTime = Date.now();
      
      // 计算存储统计
      const stats = {
        totalFiles: files.length,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
        averageFileSize: files.reduce((sum, file) => sum + file.size, 0) / files.length,
        sharedFiles: files.filter(f => f.contentType === 'shared').length,
        userCopies: files.filter(f => f.contentType === 'user-copy').length,
        originalFiles: files.filter(f => f.contentType === 'original').length,
        filesOlderThan30Days: files.filter(f => 
          Date.now() - f.lastModified > 30 * 24 * 60 * 60 * 1000
        ).length,
        filesLargerThan1MB: files.filter(f => f.size > 1024 * 1024).length,
        potentialSavings: files
          .filter(f => f.size > 1024 * 1024)
          .reduce((sum, file) => sum + (file.size * 0.5), 0) // 假设50%压缩率
      };
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      console.log(`计算 ${files.length} 个文件的统计信息耗时: ${processingTime}ms`);
      console.log('存储统计:', {
        totalFiles: stats.totalFiles,
        totalSize: `${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`,
        averageFileSize: `${(stats.averageFileSize / 1024).toFixed(2)}KB`,
        sharedFiles: stats.sharedFiles,
        userCopies: stats.userCopies,
        originalFiles: stats.originalFiles,
        filesOlderThan30Days: stats.filesOlderThan30Days,
        filesLargerThan1MB: stats.filesLargerThan1MB,
        potentialSavings: `${(stats.potentialSavings / 1024 / 1024).toFixed(2)}MB`
      });

      expect(stats.totalFiles).toBe(50000);
      expect(processingTime).toBeLessThan(50); // 应该在50ms内完成50,000个文件的统计
    });

    it('应该能够高效处理存储配额管理', () => {
      // 生成大量用户数据
      const users = Array.from({ length: 1000 }, (_, i) => ({
        userId: i.toString(),
        quota: 1024 * 1024 * 1024, // 1GB配额
        usedSpace: Math.floor(Math.random() * 1024 * 1024 * 1024),
        fileCount: Math.floor(Math.random() * 1000)
      }));

      const startTime = Date.now();
      
      // 分析配额使用情况
      const quotaAnalysis = {
        totalUsers: users.length,
        usersOverQuota: users.filter(u => u.usedSpace > u.quota).length,
        usersNearQuota: users.filter(u => u.usedSpace > u.quota * 0.8).length,
        averageUsage: users.reduce((sum, u) => sum + u.usedSpace, 0) / users.length,
        totalUsedSpace: users.reduce((sum, u) => sum + u.usedSpace, 0),
        totalQuota: users.reduce((sum, u) => sum + u.quota, 0),
        utilizationRate: users.reduce((sum, u) => sum + u.usedSpace, 0) / users.reduce((sum, u) => sum + u.quota, 0)
      };
      
      // 生成配额警告
      const quotaWarnings = users
        .filter(u => u.usedSpace > u.quota * 0.8)
        .map(u => ({
          userId: u.userId,
          usagePercent: (u.usedSpace / u.quota) * 100,
          actionRequired: u.usedSpace > u.quota ? 'cleanup' : 'warning'
        }));
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      console.log(`分析 ${users.length} 个用户的配额使用情况耗时: ${processingTime}ms`);
      console.log('配额分析:', {
        totalUsers: quotaAnalysis.totalUsers,
        usersOverQuota: quotaAnalysis.usersOverQuota,
        usersNearQuota: quotaAnalysis.usersNearQuota,
        averageUsage: `${(quotaAnalysis.averageUsage / 1024 / 1024).toFixed(2)}MB`,
        totalUsedSpace: `${(quotaAnalysis.totalUsedSpace / 1024 / 1024 / 1024).toFixed(2)}GB`,
        totalQuota: `${(quotaAnalysis.totalQuota / 1024 / 1024 / 1024).toFixed(2)}GB`,
        utilizationRate: `${(quotaAnalysis.utilizationRate * 100).toFixed(2)}%`
      });
      console.log(`生成 ${quotaWarnings.length} 个配额警告`);

      expect(quotaAnalysis.totalUsers).toBe(1000);
      expect(processingTime).toBeLessThan(20); // 应该在20ms内完成1000个用户的配额分析
    });
  });

  describe('并发性能测试', () => {
    it('应该能够高效处理并发内容匹配请求', async () => {
      const servicePrivate = contentDistribution as any;
      
      const contentFeatures = {
        topics: ['AI', 'Technology', 'Programming'],
        keywords: ['machine learning', 'AI', 'programming'],
        importanceScore: 0.8,
        source: 'TechBlog',
        contentType: 'news' as const
      };

      const userPreferences = Array.from({ length: 1000 }, (_, i) => ({
        userId: i.toString(),
        enabledTopics: ['AI', 'Technology', 'Programming'],
        enabledKeywords: ['AI', 'machine learning', 'programming'],
        minImportanceScore: 0.6,
        maxDailyContent: 100,
        contentTypes: ['news', 'analysis', 'tutorial'],
        deliverySchedule: 'realtime' as const
      }));

      // 模拟并发请求
      const concurrentRequests = 100;
      const requestsPerBatch = 10;
      
      const startTime = Date.now();
      
      // 分批处理并发请求
      const batches = [];
      for (let i = 0; i < concurrentRequests; i += requestsPerBatch) {
        const batch = userPreferences.slice(i, i + requestsPerBatch).map(preference => 
          Promise.resolve().then(() => 
            servicePrivate.calculateContentMatchScore(contentFeatures, preference)
          )
        );
        batches.push(Promise.all(batch));
      }
      
      const results = await Promise.all(batches);
      const flatResults = results.flat();
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      console.log(`处理 ${concurrentRequests} 个并发请求耗时: ${processingTime}ms`);
      console.log(`吞吐量: ${(concurrentRequests / (processingTime / 1000)).toFixed(2)} 请求/秒`);

      expect(flatResults).toHaveLength(concurrentRequests);
      expect(flatResults.every(score => score >= 0)).toBe(true);
      expect(processingTime).toBeLessThan(1000); // 应该在1秒内完成100个并发请求
    });

    it('应该能够高效处理内存使用', () => {
      const servicePrivate = contentDistribution as any;
      
      // 测试内存使用情况
      const initialMemory = process.memoryUsage();
      
      // 处理大量数据
      const largeDataset = Array.from({ length: 100000 }, (_, i) => ({
        contentHash: `hash${i}`,
        features: {
          topics: ['AI', 'Technology', 'Programming', 'Machine Learning'],
          keywords: ['machine learning', 'AI', 'programming', 'data science'],
          importanceScore: 0.6 + (Math.random() * 0.4),
          source: 'TechBlog',
          contentType: ['news', 'analysis', 'tutorial'][Math.floor(Math.random() * 3)] as const
        }
      }));

      const userPreference = {
        userId: '1',
        enabledTopics: ['AI', 'Technology', 'Programming'],
        enabledKeywords: ['AI', 'machine learning', 'programming'],
        minImportanceScore: 0.6,
        maxDailyContent: 100,
        contentTypes: ['news', 'analysis', 'tutorial'],
        deliverySchedule: 'realtime' as const
      };

      // 处理数据
      const startTime = Date.now();
      const scores = largeDataset.map(item => 
        servicePrivate.calculateContentMatchScore(item.features, userPreference)
      );
      const endTime = Date.now();

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`处理 ${largeDataset.length} 个内容项耗时: ${endTime - startTime}ms`);
      console.log('内存使用情况:', {
        initialMemory: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        finalMemory: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        memoryIncrease: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
        averageMemoryPerItem: `${(memoryIncrease / largeDataset.length / 1024).toFixed(2)}KB`
      });

      expect(scores).toHaveLength(100000);
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 内存增长应小于100MB
      expect(endTime - startTime).toBeLessThan(5000); // 应该在5秒内完成
    });
  });

  describe('性能基准测试', () => {
    it('应该满足性能基准要求', () => {
      const servicePrivate = contentDistribution as any;
      
      const benchmarks = [
        {
          name: '单用户匹配计算',
          iterations: 10000,
          execute: () => {
            const contentFeatures = {
              topics: ['AI', 'Technology'],
              keywords: ['machine learning', 'AI'],
              importanceScore: 0.8,
              source: 'TechBlog',
              contentType: 'news' as const
            };
            
            const userPreference = {
              userId: '1',
              enabledTopics: ['AI', 'Technology'],
              enabledKeywords: ['AI', 'machine learning'],
              minImportanceScore: 0.6,
              maxDailyContent: 100,
              contentTypes: ['news', 'analysis'],
              deliverySchedule: 'realtime' as const
            };
            
            return servicePrivate.calculateContentMatchScore(contentFeatures, userPreference);
          },
          maxTimeMs: 1000, // 10,000次迭代应该在1秒内完成
          maxTimePerIterationMs: 0.1 // 每次迭代应该在0.1ms内完成
        },
        {
          name: '存储优化决策',
          iterations: 1000,
          execute: () => {
            // 模拟存储优化决策逻辑
            const items = Array.from({ length: 100 }, (_, i) => ({
              referenceCount: Math.floor(Math.random() * 5),
              lastAccessedAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
              size: Math.floor(Math.random() * 10 * 1024 * 1024)
            }));
            
            return items.filter(item => 
              item.referenceCount === 0 && 
              (Date.now() - item.lastAccessedAt.getTime()) > 30 * 24 * 60 * 60 * 1000
            ).length;
          },
          maxTimeMs: 500, // 1,000次迭代应该在0.5秒内完成
          maxTimePerIterationMs: 0.5 // 每次迭代应该在0.5ms内完成
        }
      ];

      const results = benchmarks.map(benchmark => {
        const startTime = Date.now();
        
        for (let i = 0; i < benchmark.iterations; i++) {
          benchmark.execute();
        }
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        const avgTimePerIteration = totalTime / benchmark.iterations;
        
        return {
          name: benchmark.name,
          iterations: benchmark.iterations,
          totalTimeMs: totalTime,
          avgTimePerIterationMs: avgTimePerIteration,
          withinMaxTime: totalTime <= benchmark.maxTimeMs,
          withinMaxTimePerIteration: avgTimePerIteration <= benchmark.maxTimePerIterationMs,
          throughput: benchmark.iterations / (totalTime / 1000)
        };
      });

      console.log('性能基准测试结果:', results);

      // 验证所有基准测试都通过
      results.forEach(result => {
        expect(result.withinMaxTime).toBe(true);
        expect(result.withinMaxTimePerIteration).toBe(true);
        expect(result.throughput).toBeGreaterThan(1); // 至少1个操作/秒
      });
    });
  });
});