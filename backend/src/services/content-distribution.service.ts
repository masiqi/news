// src/services/content-distribution.service.ts
// 智能内容分发服务 - 实现内容到用户的自动分发机制

import { initDB } from '../db';
import { 
  users, 
  sources, 
  rssEntries, 
  processedContents, 
  userNotes, 
  userStorageRefs,
  contentUrlIndex,
  contentLibrary,
  storageStats,
  userStorageStats,
  userTopics,
  userKeywords,
  topicEntryRelations,
  keywordEntryRelations,
  userAutoStorageConfigs,
  syncCredentials,
  userStorageLogs
} from '../db/schema';
import { and, eq, desc, gte, lt, sql, inArray } from 'drizzle-orm';
import { SharedContentPoolService } from './shared-content-pool.service';
import { R2Service } from './r2.service';

// 内容分发相关接口定义
export interface DistributionTarget {
  userId: string;
  entryId: number;
  processedContentId: number;
  contentHash: string;
  priority: 'high' | 'medium' | 'low';
  reason: 'auto_subscription' | 'manual_subscription' | 'topic_match' | 'keyword_match';
}

export interface DistributionResult {
  success: boolean;
  target: DistributionTarget;
  userPath?: string;
  error?: string;
  processingTime: number;
  distributedAt: Date;
}

export interface DistributionStats {
  totalUsers: number;
  distributedUsers: number;
  failedUsers: number;
  averageProcessingTime: number;
  distributionSuccessRate: number;
  topicBasedDistributions: number;
  keywordBasedDistributions: number;
  subscriptionBasedDistributions: number;
}

export interface UserContentPreferences {
  userId: string;
  enabledTopics: string[];
  enabledKeywords: string[];
  minImportanceScore: number;
  maxDailyContent: number;
  contentTypes: ('news' | 'analysis' | 'tutorial')[];
  deliverySchedule: 'realtime' | 'daily' | 'weekly';
}

export class ContentDistributionService {
  private readonly MAX_CONCURRENT_DISTRIBUTIONS = 20;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly CONTENT_CACHE_TTL = 300000; // 5分钟缓存

  constructor(
    private sharedContentPool: SharedContentPoolService,
    private r2Service: R2Service
  ) {}

  /**
   * 智能内容分发主入口
   * 基于用户偏好和内容特征，自动将处理后的内容分发给相关用户
   */
  async distributeContent(
    contentHash: string,
    processedContentId: number,
    entryId: number,
    contentFeatures: {
      topics: string[];
      keywords: string[];
      importanceScore: number;
      source: string;
      contentType: 'news' | 'analysis' | 'tutorial';
    }
  ): Promise<DistributionResult[]> {
    const startTime = Date.now();
    console.log(`开始智能内容分发: 内容哈希 ${contentHash}, 条目ID ${entryId}`);

    try {
      // 1. 获取所有活跃用户的内容偏好
      const userPreferences = await this.getActiveUserPreferences();
      
      // 2. 基于内容特征匹配目标用户
      const distributionTargets = await this.matchDistributionTargets(
        contentHash,
        processedContentId,
        entryId,
        contentFeatures,
        userPreferences
      );

      if (distributionTargets.length === 0) {
        console.log(`内容 ${contentHash} 没有匹配的分发目标`);
        return [];
      }

      // 3. 批量分发内容到目标用户
      const distributionResults = await this.batchDistributeToUsers(
        distributionTargets,
        contentHash
      );

      // 4. 更新分发统计
      await this.updateDistributionStats(distributionResults, startTime);

      const totalTime = Date.now() - startTime;
      console.log(`内容分发完成: 成功 ${distributionResults.filter(r => r.success).length}/${distributionResults.length}, 耗时 ${totalTime}ms`);

      return distributionResults;

    } catch (error) {
      console.error('智能内容分发失败:', error);
      throw error;
    }
  }

  /**
   * 获取活跃用户的内容偏好设置
   */
  private async getActiveUserPreferences(): Promise<UserContentPreferences[]> {
    try {
      // 获取所有活跃用户
      const activeUsers = await db.select({
        id: users.id,
        enabledTopics: sql<string>`COALESCE(GROUP_CONCAT(DISTINCT ${userTopics.topicName}), '')`,
        enabledKeywords: sql<string>`COALESCE(GROUP_CONCAT(DISTINCT ${userKeywords.keywordName}), '')`
      })
      .from(users)
      .leftJoin(userTopics, eq(users.id, userTopics.userId))
      .leftJoin(userKeywords, eq(users.id, userKeywords.userId))
      .where(
        and(
          eq(users.status, 'active'),
          eq(users.isVerified, true)
        )
      )
      .groupBy(users.id);

      // 为每个用户获取详细偏好
      const preferences: UserContentPreferences[] = [];
      
      for (const user of activeUsers) {
        // 获取用户的自动存储配置
        const autoStorageConfig = await db.select()
          .from(userAutoStorageConfigs)
          .where(
            and(
              eq(userAutoStorageConfigs.userId, user.id.toString()),
              eq(userAutoStorageConfigs.enabled, true)
            )
          )
          .limit(1);

        preferences.push({
          userId: user.id.toString(),
          enabledTopics: user.enabledTopics ? user.enabledTopics.split(',').filter(Boolean) : [],
          enabledKeywords: user.enabledKeywords ? user.enabledKeywords.split(',').filter(Boolean) : [],
          minImportanceScore: 0.5, // 默认中等重要性阈值
          maxDailyContent: autoStorageConfig[0]?.maxFilesPerDay || 100,
          contentTypes: ['news', 'analysis', 'tutorial'],
          deliverySchedule: 'realtime'
        });
      }

      return preferences;

    } catch (error) {
      console.error('获取用户偏好失败:', error);
      return [];
    }
  }

  /**
   * 基于内容特征和用户偏好匹配分发目标
   */
  private async matchDistributionTargets(
    contentHash: string,
    processedContentId: number,
    entryId: number,
    contentFeatures: {
      topics: string[];
      keywords: string[];
      importanceScore: number;
      source: string;
      contentType: 'news' | 'analysis' | 'tutorial';
    },
    userPreferences: UserContentPreferences[]
  ): Promise<DistributionTarget[]> {
    const targets: DistributionTarget[] = [];

    for (const preference of userPreferences) {
      // 检查用户是否已存在该内容的引用（避免重复分发）
      const existingRef = await db.select()
        .from(userStorageRefs)
        .where(
          and(
            eq(userStorageRefs.userId, preference.userId),
            eq(userStorageRefs.entryId, entryId)
          )
        )
        .limit(1);

      if (existingRef.length > 0) {
        continue; // 用户已拥有此内容，跳过分发
      }

      // 检查用户的每日内容限制
      const todayStats = await this.getUserTodayStats(preference.userId);
      if (todayStats.totalFiles >= preference.maxDailyContent) {
        continue; // 用户已达今日内容限制
      }

      // 计算内容与用户偏好的匹配分数
      const matchScore = this.calculateContentMatchScore(contentFeatures, preference);
      
      if (matchScore >= 0.3) { // 30%以上的匹配分数才进行分发
        const priority = matchScore >= 0.8 ? 'high' : matchScore >= 0.6 ? 'medium' : 'low';
        
        targets.push({
          userId: preference.userId,
          entryId,
          processedContentId,
          contentHash,
          priority,
          reason: matchScore >= 0.7 ? 'topic_match' : 'keyword_match'
        });
      }
    }

    // 按优先级排序
    return targets.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * 计算内容与用户偏好的匹配分数
   */
  private calculateContentMatchScore(
    contentFeatures: {
      topics: string[];
      keywords: string[];
      importanceScore: number;
      source: string;
      contentType: 'news' | 'analysis' | 'tutorial';
    },
    preference: UserContentPreferences
  ): number {
    let score = 0;

    // 主题匹配 (权重40%)
    const topicMatches = contentFeatures.topics.filter(topic => 
      preference.enabledTopics.includes(topic)
    ).length;
    const topicScore = preference.enabledTopics.length > 0 
      ? topicMatches / preference.enabledTopics.length 
      : 0;
    score += topicScore * 0.4;

    // 关键词匹配 (权重30%)
    const keywordMatches = contentFeatures.keywords.filter(keyword => 
      preference.enabledKeywords.includes(keyword)
    ).length;
    const keywordScore = preference.enabledKeywords.length > 0 
      ? keywordMatches / preference.enabledKeywords.length 
      : 0;
    score += keywordScore * 0.3;

    // 重要性分数匹配 (权重20%)
    const importanceScore = contentFeatures.importanceScore >= preference.minImportanceScore ? 1 : 0;
    score += importanceScore * 0.2;

    // 内容类型匹配 (权重10%)
    const typeScore = preference.contentTypes.includes(contentFeatures.contentType) ? 1 : 0;
    score += typeScore * 0.1;

    return Math.min(score, 1.0); // 确保分数不超过1.0
  }

  /**
   * 获取用户今日统计信息
   */
  private async getUserTodayStats(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const stats = await db.select()
      .from(userStorageStats)
      .where(
        and(
          eq(userStorageStats.userId, userId),
          gte(userStorageStats.createdAt, today),
          lt(userStorageStats.createdAt, tomorrow)
        )
      )
      .limit(1);

    return stats[0] || { totalFiles: 0, totalSize: 0 };
  }

  /**
   * 批量分发内容到用户
   */
  private async batchDistributeToUsers(
    targets: DistributionTarget[],
    contentHash: string
  ): Promise<DistributionResult[]> {
    const results: DistributionResult[] = [];
    
    // 限制并发数量，避免系统过载
    const batchSize = Math.min(targets.length, this.MAX_CONCURRENT_DISTRIBUTIONS);
    
    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      const batchPromises = batch.map(target => 
        this.distributeToSingleUser(target, contentHash)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        } else {
          // 处理分发失败的情况
          console.error('分发到单个用户失败:', result.reason);
        }
      }
    }

    return results;
  }

  /**
   * 分发内容到单个用户
   */
  private async distributeToSingleUser(
    target: DistributionTarget,
    contentHash: string
  ): Promise<DistributionResult> {
    const startTime = Date.now();
    
    try {
      // 检查用户是否已有R2访问权限
      const r2Access = await this.ensureUserR2Access(target.userId);
      if (!r2Access) {
        throw new Error('用户缺少R2访问权限');
      }

      // 创建用户内容副本（使用共享内容池）
      const userCopyResult = await this.sharedContentPool.createUserCopy(
        target.userId,
        target.entryId,
        contentHash
      );

      // 创建用户笔记记录
      await this.createUserNote(target);

      // 记录分发日志
      await this.logDistribution(target, true, null, Date.now() - startTime);

      return {
        success: true,
        target,
        userPath: userCopyResult.userPath,
        processingTime: Date.now() - startTime,
        distributedAt: new Date()
      };

    } catch (error) {
      console.error(`分发到用户 ${target.userId} 失败:`, error);
      
      // 记录失败日志
      await this.logDistribution(target, false, error instanceof Error ? error.message : String(error), Date.now() - startTime);

      return {
        success: false,
        target,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime,
        distributedAt: new Date()
      };
    }
  }

  /**
   * 确保用户具有R2访问权限
   */
  private async ensureUserR2Access(userId: string): Promise<boolean> {
    try {
      // 检查用户是否有同步凭证
      const credentials = await db.select()
        .from(syncCredentials)
        .where(
          and(
            eq(syncCredentials.userId, parseInt(userId)),
            eq(syncCredentials.isActive, true)
          )
        )
        .limit(1);

      if (credentials.length === 0) {
        console.log(`用户 ${userId} 缺少同步凭证，跳过分发`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`检查用户R2访问权限失败 ${userId}:`, error);
      return false;
    }
  }

  /**
   * 创建用户笔记记录
   */
  private async createUserNote(target: DistributionTarget): Promise<void> {
    try {
      // 获取原始RSS条目和处理后的内容
      const [entry, processedContent] = await Promise.all([
        db.select().from(rssEntries).where(eq(rssEntries.id, target.entryId)).limit(1),
        db.select().from(processedContents).where(eq(processedContents.id, target.processedContentId)).limit(1)
      ]);

      if (entry.length === 0 || processedContent.length === 0) {
        throw new Error('找不到原始内容或处理后的内容');
      }

      // 创建用户笔记记录
      await db.insert(userNotes).values({
        userId: parseInt(target.userId),
        entryId: target.entryId,
        processedContentId: target.processedContentId,
        title: entry[0].title,
        content: processedContent[0].markdownContent,
        personalTags: '', // 用户可以后续添加个性化标签
        isFavorite: false,
        readStatus: 0, // 未读状态
        createdAt: new Date(),
        updatedAt: new Date()
      });

    } catch (error) {
      console.error(`创建用户笔记失败 ${target.userId}:`, error);
      // 即使创建笔记失败，也不影响内容分发到R2存储
    }
  }

  /**
   * 记录分发日志
   */
  private async logDistribution(
    target: DistributionTarget,
    success: boolean,
    error: string | null,
    processingTime: number
  ): Promise<void> {
    try {
      await db.insert(userStorageLogs).values({
        userId: parseInt(target.userId),
        sourceId: 1, // 默认源ID，实际应该从entry获取
        entryId: target.entryId,
        filePath: target.userId,
        fileSize: 0, // 实际文件大小由R2服务提供
        status: success ? 'success' as const : 'failed' as const,
        errorMessage: error,
        processingTime,
        createdAt: new Date()
      });

    } catch (logError) {
      console.error('记录分发日志失败:', logError);
    }
  }

  /**
   * 更新分发统计
   */
  private async updateDistributionStats(
    results: DistributionResult[],
    startTime: number
  ): Promise<void> {
    try {
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;

      // 更新全局存储统计（如果需要）
      // 这里可以添加更复杂的统计逻辑

    } catch (error) {
      console.error('更新分发统计失败:', error);
    }
  }

  /**
   * 获取分发统计信息
   */
  async getDistributionStats(userId?: string): Promise<DistributionStats> {
    try {
      // 基础查询
      let baseQuery = db.select({
        totalUsers: sql<number>`COUNT(DISTINCT ${userStorageRefs.userId})`,
        totalDistributed: sql<number>`COUNT(*)`
      }).from(userStorageRefs);

      if (userId) {
        baseQuery = baseQuery.where(eq(userStorageRefs.userId, userId));
      }

      const [baseStats] = await baseQuery;

      // 获取失败分发统计
      let failedQuery = db.select({
        failedCount: sql<number>`COUNT(*)`
      }).from(userStorageLogs).where(eq(userStorageLogs.status, 'failed'));

      if (userId) {
        failedQuery = failedQuery.where(eq(userStorageLogs.userId, parseInt(userId)));
      }

      const [failedStats] = await failedQuery;

      // 获取平均处理时间
      let timeQuery = db.select({
        avgTime: sql<number>`AVG(${userStorageLogs.processingTime})`
      }).from(userStorageLogs);

      if (userId) {
        timeQuery = timeQuery.where(eq(userStorageLogs.userId, parseInt(userId)));
      }

      const [timeStats] = await timeQuery;

      return {
        totalUsers: baseStats.totalUsers || 0,
        distributedUsers: baseStats.totalDistributed || 0,
        failedUsers: failedStats.failedCount || 0,
        averageProcessingTime: timeStats.avgTime || 0,
        distributionSuccessRate: baseStats.totalDistributed > 0 
          ? ((baseStats.totalDistributed - (failedStats.failedCount || 0)) / baseStats.totalDistributed) * 100 
          : 0,
        topicBasedDistributions: 0, // 需要额外的表来跟踪这些信息
        keywordBasedDistributions: 0,
        subscriptionBasedDistributions: 0
      };

    } catch (error) {
      console.error('获取分发统计失败:', error);
      return {
        totalUsers: 0,
        distributedUsers: 0,
        failedUsers: 0,
        averageProcessingTime: 0,
        distributionSuccessRate: 0,
        topicBasedDistributions: 0,
        keywordBasedDistributions: 0,
        subscriptionBasedDistributions: 0
      };
    }
  }

  /**
   * 手动触发内容重新分发
   */
  async redistributeContent(
    contentHash: string,
    targetUserIds?: string[]
  ): Promise<DistributionResult[]> {
    try {
      // 获取内容信息
      const contentInfo = await db.select({
        id: processedContents.id,
        entryId: processedContents.entryId
      })
      .from(processedContents)
      .leftJoin(userStorageRefs, eq(processedContents.entryId, userStorageRefs.entryId))
      .where(eq(userStorageRefs.contentHash, contentHash))
      .limit(1);

      if (contentInfo.length === 0) {
        throw new Error('找不到指定的内容');
      }

      // 获取内容特征（简化版，实际应该从增强分析表中获取）
      const contentFeatures = {
        topics: [],
        keywords: [],
        importanceScore: 0.7,
        source: '',
        contentType: 'news' as const
      };

      if (targetUserIds) {
        // 分发到指定用户
        const targets: DistributionTarget[] = targetUserIds.map(userId => ({
          userId,
          entryId: contentInfo[0].entryId,
          processedContentId: contentInfo[0].id,
          contentHash,
          priority: 'high' as const,
          reason: 'manual_subscription' as const
        }));

        return this.batchDistributeToUsers(targets, contentHash);
      } else {
        // 重新分发到所有匹配用户
        return this.distributeContent(
          contentHash,
          contentInfo[0].id,
          contentInfo[0].entryId,
          contentFeatures
        );
      }

    } catch (error) {
      console.error('重新分发内容失败:', error);
      throw error;
    }
  }

  /**
   * 清理无效的分发记录
   */
  async cleanupInvalidDistributions(): Promise<number> {
    try {
      // 查找引用计数为0但仍有用户引用的内容
      const invalidRefs = await db.select({
        userId: userStorageRefs.userId,
        entryId: userStorageRefs.entryId
      })
      .from(userStorageRefs)
      .leftJoin(contentLibrary, eq(userStorageRefs.contentHash, contentLibrary.contentHash))
      .where(
        and(
          eq(contentLibrary.referenceCount, 0),
          eq(userStorageRefs.isModified, false)
        )
      );

      let cleanedCount = 0;

      for (const ref of invalidRefs) {
        try {
          // 删除无效的存储引用
          await db.delete(userStorageRefs)
            .where(
              and(
                eq(userStorageRefs.userId, ref.userId),
                eq(userStorageRefs.entryId, ref.entryId)
              )
            );

          cleanedCount++;
        } catch (error) {
          console.error(`清理无效分发记录失败:`, error);
        }
      }

      console.log(`清理了 ${cleanedCount} 个无效分发记录`);
      return cleanedCount;

    } catch (error) {
      console.error('清理无效分发记录失败:', error);
      return 0;
    }
  }
}