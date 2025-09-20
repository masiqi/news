// src/services/content-deduplication.service.ts
// 基于URL的内容去重机制 - 简化版本，只基于URL判断内容唯一性

import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, contentUrlIndex } from '../db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

interface ContentDeduplicationConfig {
  maxRetries: number;
  cleanupInterval: number; // 清理过期记录的间隔（小时）
  maxContentAge: number; // 内容最长保留时间（天）
}

interface ContentCheckResult {
  isDuplicate: boolean;
  existingEntryId?: number;
  userId?: string;
  processingTime: number;
}

interface CleanupStats {
  totalChecked: number;
  duplicatesRemoved: number;
  expiredRemoved: number;
  processingTime: number;
}

export class ContentDeduplicationService {
  private readonly config: ContentDeduplicationConfig;
  private readonly urlCache: Map<string, { entryId: number; userId: string; timestamp: number }> = new Map();
  private readonly cacheMaxAge = 30 * 60 * 1000; // 30分钟缓存过期

  constructor(
    private db: any,
    config: Partial<ContentDeduplicationConfig> = {}
  ) {
    this.db = drizzle(db);
    this.config = {
      maxRetries: config.maxRetries || 3,
      cleanupInterval: config.cleanupInterval || 24, // 24小时
      maxContentAge: config.maxContentAge || 30 // 30天
    };

    // 启动定时清理任务
    this.startCleanupTask();
  }

  /**
   * 检查内容是否重复（基于URL）
   */
  async checkDuplicateByUrl(
    url: string,
    userId: string,
    sourceId: number
  ): Promise<ContentCheckResult> {
    const startTime = Date.now();

    try {
      console.log(`检查URL去重: ${url}`);

      // 首先检查内存缓存
      const cachedResult = this.checkUrlCache(url);
      if (cachedResult) {
        console.log(`URL在缓存中找到: ${url}`);
        return {
          isDuplicate: true,
          existingEntryId: cachedResult.entryId,
          userId: cachedResult.userId,
          processingTime: Date.now() - startTime
        };
      }

      // 检查数据库中的URL索引
      const existingUrlIndex = await this.db
        .select()
        .from(contentUrlIndex)
        .where(eq(contentUrlIndex.url, url))
        .limit(1)
        .get();

      if (existingUrlIndex) {
        console.log(`URL已存在于数据库: ${url}, 条目ID: ${existingUrlIndex.entryId}`);

        // 更新缓存
        this.updateUrlCache(url, {
          entryId: existingUrlIndex.entryId,
          userId: existingUrlIndex.userId,
          timestamp: Date.now()
        });

        // 获取对应的RSS条目信息
        const rssEntry = await this.db
          .select()
          .from(rssEntries)
          .where(eq(rssEntries.id, existingUrlIndex.entryId))
          .limit(1)
          .get();

        return {
          isDuplicate: true,
          existingEntryId: existingUrlIndex.entryId,
          userId: rssEntry?.userId?.toString() || existingUrlIndex.userId,
          processingTime: Date.now() - startTime
        };
      }

      console.log(`URL不存在，可以处理: ${url}`);
      return {
        isDuplicate: false,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error(`检查URL去重失败: ${url}`, error);
      
      // 出错时默认认为是重复内容，避免重复处理
      return {
        isDuplicate: true,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 注册已处理的URL（创建新条目时调用）
   */
  async registerProcessedUrl(
    url: string,
    entryId: number,
    userId: string,
    metadata?: {
      sourceId: number;
      title: string;
      publishedAt: Date;
      contentHash?: string;
    }
  ): Promise<void> {
    try {
      console.log(`注册已处理的URL: ${url}, 条目ID: ${entryId}`);

      // 检查是否已存在
      const existingIndex = await this.db
        .select()
        .from(contentUrlIndex)
        .where(eq(contentUrlIndex.url, url))
        .limit(1)
        .get();

      if (existingIndex) {
        console.warn(`URL已存在于索引中，更新记录: ${url}`);
        await this.db
          .update(contentUrlIndex)
          .set({
            entryId: entryId,
            userId: userId,
            lastAccessedAt: new Date(),
            metadata: metadata ? JSON.stringify(metadata) : null
          })
          .where(eq(contentUrlIndex.id, existingIndex.id));
      } else {
        // 创建新的URL索引记录
        await this.db
          .insert(contentUrlIndex)
          .values({
            url: url,
            entryId: entryId,
            userId: userId,
            sourceId: metadata?.sourceId,
            title: metadata?.title,
            publishedAt: metadata?.publishedAt,
            contentHash: metadata?.contentHash,
            lastAccessedAt: new Date(),
            createdAt: new Date(),
            metadata: metadata ? JSON.stringify(metadata) : null
          });

        console.log(`URL索引创建成功: ${url}`);
      }

      // 更新内存缓存
      this.updateUrlCache(url, {
        entryId: entryId,
        userId: userId,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error(`注册URL索引失败: ${url}`, error);
      throw new Error(`URL索引注册失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 批量检查URL去重
   */
  async batchCheckDuplicateUrls(
    urls: string[],
    userId: string
  ): Promise<Map<string, ContentCheckResult>> {
    const startTime = Date.now();
    const results = new Map<string, ContentCheckResult>();

    try {
      console.log(`批量检查URL去重: ${urls.length} 个URL`);

      // 去重输入的URL列表
      const uniqueUrls = [...new Set(urls)];
      const urlsToCheck: string[] = [];
      const cachedResults: Map<string, ContentCheckResult> = new Map();

      // 首先检查内存缓存
      for (const url of uniqueUrls) {
        const cachedResult = this.checkUrlCache(url);
        if (cachedResult) {
          cachedResults.set(url, {
            isDuplicate: true,
            existingEntryId: cachedResult.entryId,
            userId: cachedResult.userId,
            processingTime: 0
          });
        } else {
          urlsToCheck.push(url);
        }
      }

      // 批量查询数据库中剩余的URL
      if (urlsToCheck.length > 0) {
        const existingIndices = await this.db
          .select()
          .from(contentUrlIndex)
          .where(inArray(contentUrlIndex.url, urlsToCheck));

        // 创建URL到索引的映射
        const urlToIndex = new Map<string, typeof existingIndices[0]>();
        for (const index of existingIndices) {
          urlToIndex.set(index.url, index);
        }

        // 构建结果
        for (const url of urlsToCheck) {
          const existingIndex = urlToIndex.get(url);
          if (existingIndex) {
            // 更新缓存
            this.updateUrlCache(url, {
              entryId: existingIndex.entryId,
              userId: existingIndex.userId,
              timestamp: Date.now()
            });

            results.set(url, {
              isDuplicate: true,
              existingEntryId: existingIndex.entryId,
              userId: existingIndex.userId,
              processingTime: 0
            });
          } else {
            results.set(url, {
              isDuplicate: false,
              processingTime: 0
            });
          }
        }
      }

      // 合并缓存结果
      for (const [url, result] of cachedResults) {
        results.set(url, result);
      }

      console.log(`批量去重检查完成，处理时间: ${Date.now() - startTime}ms`);
      return results;

    } catch (error) {
      console.error('批量URL去重检查失败:', error);
      
      // 出错时默认所有URL都是重复的
      for (const url of urls) {
        results.set(url, {
          isDuplicate: true,
          processingTime: Date.now() - startTime
        });
      }
      
      return results;
    }
  }

  /**
   * 批量注册已处理的URL
   */
  async batchRegisterProcessedUrls(
    urlEntries: Array<{
      url: string;
      entryId: number;
      userId: string;
      metadata?: {
        sourceId: number;
        title: string;
        publishedAt: Date;
        contentHash?: string;
      };
    }>
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const startTime = Date.now();
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      console.log(`批量注册URL索引: ${urlEntries.length} 个URL`);

      // 批量检查已存在的URL
      const urls = urlEntries.map(entry => entry.url);
      const existingIndices = await this.db
        .select()
        .from(contentUrlIndex)
        .where(inArray(contentUrlIndex.url, urls));

      const existingUrls = new Set(existingIndices.map(index => index.url));
      const urlsToInsert: typeof urlEntries = [];
      const urlsToUpdate: typeof urlEntries = [];

      // 分类处理
      for (const entry of urlEntries) {
        if (existingUrls.has(entry.url)) {
          urlsToUpdate.push(entry);
        } else {
          urlsToInsert.push(entry);
        }
      }

      // 批量插入新的URL索引
      if (urlsToInsert.length > 0) {
        try {
          const insertValues = urlsToInsert.map(entry => ({
            url: entry.url,
            entryId: entry.entryId,
            userId: entry.userId,
            sourceId: entry.metadata?.sourceId,
            title: entry.metadata?.title,
            publishedAt: entry.metadata?.publishedAt,
            contentHash: entry.metadata?.contentHash,
            lastAccessedAt: new Date(),
            createdAt: new Date(),
            metadata: entry.metadata ? JSON.stringify(entry.metadata) : null
          }));

          await this.db.insert(contentUrlIndex).values(insertValues);
          success += urlsToInsert.length;

          console.log(`批量插入URL索引成功: ${urlsToInsert.length} 个`);

        } catch (insertError) {
          console.error('批量插入URL索引失败:', insertError);
          failed += urlsToInsert.length;
          errors.push(`批量插入失败: ${insertError instanceof Error ? insertError.message : '未知错误'}`);
        }
      }

      // 批量更新现有的URL索引
      if (urlsToUpdate.length > 0) {
        for (const entry of urlsToUpdate) {
          try {
            await this.db
              .update(contentUrlIndex)
              .set({
                entryId: entry.entryId,
                userId: entry.userId,
                lastAccessedAt: new Date(),
                metadata: entry.metadata ? JSON.stringify(entry.metadata) : null
              })
              .where(eq(contentUrlIndex.url, entry.url));

            success++;

          } catch (updateError) {
            console.error(`更新URL索引失败: ${entry.url}`, updateError);
            failed++;
            errors.push(`更新失败 ${entry.url}: ${updateError instanceof Error ? updateError.message : '未知错误'}`);
          }
        }
      }

      // 更新内存缓存
      for (const entry of urlEntries) {
        this.updateUrlCache(entry.url, {
          entryId: entry.entryId,
          userId: entry.userId,
          timestamp: Date.now()
        });
      }

      console.log(`批量注册URL索引完成，成功: ${success}, 失败: ${failed}, 耗时: ${Date.now() - startTime}ms`);

      return { success, failed, errors };

    } catch (error) {
      console.error('批量注册URL索引失败:', error);
      return {
        success,
        failed: urlEntries.length,
        errors: [`总体失败: ${error instanceof Error ? error.message : '未知错误'}`]
      };
    }
  }

  /**
   * 获取URL去重统计信息
   */
  async getDeduplicationStats(): Promise<{
    totalUrls: number;
    duplicateUrls: number;
    uniqueUrls: number;
    cacheSize: number;
    oldestRecord?: Date;
    newestRecord?: Date;
  }> {
    try {
      // 获取总URL数
      const totalResult = await this.db.select({ 
        count: sql<number>`count(*)` 
      }).from(contentUrlIndex);
      const totalUrls = totalResult[0]?.count || 0;

      // 获取去重统计（基于entryId的唯一性）
      const uniqueResult = await this.db.select({ 
        count: sql<number>`count(DISTINCT entryId)` 
      }).from(contentUrlIndex);
      const uniqueUrls = uniqueResult[0]?.count || 0;

      const duplicateUrls = totalUrls - uniqueUrls;

      // 获取时间范围
      const oldestResult = await this.db.select({ 
        createdAt: sql<Date>`MIN(createdAt)` 
      }).from(contentUrlIndex);
      const newestResult = await this.db.select({ 
        createdAt: sql<Date>`MAX(createdAt)` 
      }).from(contentUrlIndex);

      return {
        totalUrls,
        duplicateUrls,
        uniqueUrls,
        cacheSize: this.urlCache.size,
        oldestRecord: oldestResult[0]?.createdAt,
        newestRecord: newestResult[0]?.createdAt
      };

    } catch (error) {
      console.error('获取去重统计失败:', error);
      return {
        totalUrls: 0,
        duplicateUrls: 0,
        uniqueUrls: 0,
        cacheSize: this.urlCache.size
      };
    }
  }

  /**
   * 清理过期的URL索引记录
   */
  async cleanupExpiredUrls(): Promise<CleanupStats> {
    const startTime = Date.now();
    const stats: CleanupStats = {
      totalChecked: 0,
      duplicatesRemoved: 0,
      expiredRemoved: 0,
      processingTime: 0
    };

    try {
      console.log('开始清理过期的URL索引记录');

      const cutoffDate = new Date(Date.now() - this.config.maxContentAge * 24 * 60 * 60 * 1000);

      // 删除过期的记录
      const expiredResult = await this.db
        .delete(contentUrlIndex)
        .where(sql`${contentUrlIndex.createdAt} < ${cutoffDate.toISOString()}`)
        .returning();

      stats.expiredRemoved = expiredResult.length;

      // 清理内存缓存中的过期记录
      const now = Date.now();
      for (const [url, cacheData] of this.urlCache.entries()) {
        if (now - cacheData.timestamp > this.cacheMaxAge) {
          this.urlCache.delete(url);
          stats.duplicatesRemoved++;
        }
      }

      stats.totalChecked = this.urlCache.size + stats.expiredRemoved;
      stats.processingTime = Date.now() - startTime;

      console.log(`URL索引清理完成，移除过期: ${stats.expiredRemoved}, 清理缓存: ${stats.duplicatesRemoved}, 耗时: ${stats.processingTime}ms`);

      return stats;

    } catch (error) {
      console.error('清理过期URL索引失败:', error);
      stats.processingTime = Date.now() - startTime;
      return stats;
    }
  }

  /**
   * 检查URL缓存
   */
  private checkUrlCache(url: string): { entryId: number; userId: string; timestamp: number } | null {
    const cached = this.urlCache.get(url);
    if (!cached) {
      return null;
    }

    // 检查缓存是否过期
    if (Date.now() - cached.timestamp > this.cacheMaxAge) {
      this.urlCache.delete(url);
      return null;
    }

    return cached;
  }

  /**
   * 更新URL缓存
   */
  private updateUrlCache(
    url: string, 
    data: { entryId: number; userId: string; timestamp: number }
  ): void {
    this.urlCache.set(url, data);

    // 如果缓存太大，清理最老的记录
    if (this.urlCache.size > 10000) {
      const oldestKey = this.urlCache.keys().next().value;
      if (oldestKey) {
        this.urlCache.delete(oldestKey);
      }
    }
  }

  /**
   * 启动定时清理任务
   */
  private startCleanupTask(): void {
    // 在实际应用中，这应该通过Cloudflare Cron或其他调度机制实现
    // 这里只是一个占位符，实际部署时需要配置定时任务
    console.log('URL索引清理任务已配置（需要通过外部调度器触发）');
  }

  /**
   * 强制清理缓存
   */
  clearCache(): void {
    this.urlCache.clear();
    console.log('URL去重缓存已清理');
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.urlCache.size;
  }
}