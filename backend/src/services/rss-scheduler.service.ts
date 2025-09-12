// src/services/rss-scheduler.service.ts
import { drizzle } from 'drizzle-orm/d1';
import { sources, rssEntries } from '../db/schema';
import { eq, and, gte, lt, isNull, isNotNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { Source } from '../db/types';

export class RssSchedulerService {
  private db: ReturnType<typeof drizzle>;
  private rssQueue?: Queue<any>;

  constructor(d1: D1Database, rssQueue?: Queue<any>) {
    this.db = drizzle(d1);
    this.rssQueue = rssQueue;
  }

  /**
   * 获取所有需要检查的RSS源
   * @returns 需要检查的RSS源列表
   */
  async getSourcesToCheck(): Promise<Source[]> {
    try {
      // 获取所有活跃的RSS源
      // 为了简化，我们获取所有源，实际应用中可以根据用户活跃度或其他标准筛选
      const result = await this.db.select().from(sources);
      return result;
    } catch (error) {
      console.error('获取需要检查的RSS源失败:', error);
      return [];
    }
  }

  /**
   * 检查RSS源是否需要重新获取
   * @param source RSS源
   * @returns 是否需要重新获取
   */
  async shouldRefetchSource(source: Source): Promise<boolean> {
    try {
      // 检查上次获取时间，如果超过1小时则需要重新获取
      // 在实际应用中，可以基于源的更新频率进行更智能的判断
      if (!source.lastFetchedAt) {
        return true; // 从未获取过，需要获取
      }

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return source.lastFetchedAt < oneHourAgo;
    } catch (error) {
      console.error('检查RSS源是否需要重新获取失败:', error);
      return true; // 出错时默认需要获取
    }
  }

  /**
   * 更新RSS源的获取状态
   * @param sourceId RSS源ID
   * @param lastFetchedAt 上次获取时间
   * @param fetchFailureCount 连续失败次数
   * @param fetchErrorMessage 错误信息
   */
  async updateSourceFetchStatus(
    sourceId: number,
    lastFetchedAt: Date | null = null,
    fetchFailureCount: number = 0,
    fetchErrorMessage: string | null = null
  ): Promise<void> {
    try {
      await this.db.update(sources)
        .set({
          lastFetchedAt,
          fetchFailureCount,
          fetchErrorMessage
        })
        .where(eq(sources.id, sourceId));
    } catch (error) {
      console.error('更新RSS源获取状态失败:', error);
    }
  }

  /**
   * 增加RSS源的失败计数
   * @param sourceId RSS源ID
   */
  async incrementSourceFailureCount(sourceId: number): Promise<void> {
    try {
      const source = await this.db.select().from(sources).where(eq(sources.id, sourceId)).get();
      if (source) {
        const newFailureCount = (source.fetchFailureCount || 0) + 1;
        await this.db.update(sources)
          .set({
            fetchFailureCount: newFailureCount,
            lastFetchedAt: new Date()
          })
          .where(eq(sources.id, sourceId));
      }
    } catch (error) {
      console.error('增加RSS源失败计数失败:', error);
    }
  }

  /**
   * 重置RSS源的失败计数
   * @param sourceId RSS源ID
   */
  async resetSourceFailureCount(sourceId: number): Promise<void> {
    try {
      await this.db.update(sources)
        .set({
          fetchFailureCount: 0,
          fetchErrorMessage: null,
          lastFetchedAt: new Date()
        })
        .where(eq(sources.id, sourceId));
    } catch (error) {
      console.error('重置RSS源失败计数失败:', error);
    }
  }

  /**
   * 获取RSS源的统计数据
   * @returns RSS源统计信息
   */
  async getSourceStatistics(): Promise<{
    totalSources: number;
    activeSources: number;
    failedSources: number;
    lastHourSources: number;
  }> {
    try {
      // 获取总源数
      const totalSourcesResult = await this.db.select({ count: sql<number>`count(*)` }).from(sources);
      const totalSources = totalSourcesResult[0]?.count || 0;

      // 获取活跃源数（最近1小时内获取过）
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const activeSourcesResult = await this.db.select({ count: sql<number>`count(*)` }).from(sources)
        .where(and(isNotNull(sources.lastFetchedAt), gte(sources.lastFetchedAt, oneHourAgo)));
      const activeSources = activeSourcesResult[0]?.count || 0;

      // 获取失败源数（连续失败次数>=3）
      const failedSourcesResult = await this.db.select({ count: sql<number>`count(*)` }).from(sources)
        .where(gte(sources.fetchFailureCount, 3));
      const failedSources = failedSourcesResult[0]?.count || 0;

      // 获取最近1小时内的源数
      const lastHourSourcesResult = await this.db.select({ count: sql<number>`count(*)` }).from(sources)
        .where(gte(sources.lastFetchedAt, oneHourAgo));
      const lastHourSources = lastHourSourcesResult[0]?.count || 0;

      return {
        totalSources,
        activeSources,
        failedSources,
        lastHourSources
      };
    } catch (error) {
      console.error('获取RSS源统计数据失败:', error);
      return {
        totalSources: 0,
        activeSources: 0,
        failedSources: 0,
        lastHourSources: 0
      };
    }
  }

  /**
   * 获取特定RSS源的详细信息
   * @param sourceId RSS源ID
   * @returns RSS源详细信息
   */
  async getSourceDetails(sourceId: number): Promise<Source | null> {
    try {
      const result = await this.db.select().from(sources).where(eq(sources.id, sourceId)).limit(1);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('获取RSS源详细信息失败:', error);
      return null;
    }
  }

  /**
   * 手动触发特定RSS源的获取
   * @param sourceId RSS源ID
   */
  async triggerSourceFetch(sourceId: number): Promise<boolean> {
    try {
      console.log(`开始手动触发RSS源 ${sourceId} 获取`);
      
      // 检查源是否存在
      const source = await this.getSourceDetails(sourceId);
      if (!source) {
        console.error(`RSS源 ${sourceId} 不存在`);
        return false;
      }

      console.log(`找到RSS源:`, {
        id: source.id,
        url: source.url,
        name: source.name,
        lastFetchedAt: source.lastFetchedAt
      });

      // 发送消息到RSS获取队列
      if (this.rssQueue) {
        try {
          const message = {
            sourceId: sourceId,
            rssUrl: source.url,
            scheduledAt: new Date().toISOString(),
            manualTrigger: true
          };
          
          console.log(`准备发送队列消息:`, message);
          await this.rssQueue.send(message);
          console.log(`✅ 已成功发送手动触发的RSS源 ${sourceId} 获取任务到队列`);
        } catch (queueError) {
          console.error('❌ 发送队列消息失败:', queueError);
          return false;
        }
      } else {
        console.warn('⚠️ RSS队列未配置，无法发送获取任务');
        // 仍然更新数据库状态，但提示队列未配置
      }
      
      // 更新源的状态为正在获取
      await this.updateSourceFetchStatus(sourceId, new Date(), source.fetchFailureCount || 0, null);
      console.log(`✅ 已更新RSS源 ${sourceId} 的获取状态`);
      
      return true;
    } catch (error) {
      console.error('❌ 手动触发RSS源获取失败:', error);
      return false;
    }
  }

  /**
   * 获取调度器健康状态
   * @returns 调度器健康状态
   */
  async getSchedulerHealth(): Promise<{
    isHealthy: boolean;
    lastCheckTime: Date | null;
    errorCount: number;
  }> {
    try {
      // 在实际实现中，这里会检查调度器的各种指标
      // 为简化起见，我们返回一个基本的健康状态
      return {
        isHealthy: true,
        lastCheckTime: new Date(),
        errorCount: 0
      };
    } catch (error) {
      console.error('获取调度器健康状态失败:', error);
      return {
        isHealthy: false,
        lastCheckTime: null,
        errorCount: 1
      };
    }
  }
}