// src/services/rss-scheduler.service.ts
// RSS抓取调度服务 - 实现并行抓取和智能调度

import { drizzle } from 'drizzle-orm/d1';
import { sources, rssEntries } from '../db/schema';
import { eq, and, gt, lt, isNull, or, sql } from 'drizzle-orm';
import { QueueProducerService } from './queue/producer';
import { ContentDeduplicationService } from './content-deduplication.service';
import Parser from 'rss-parser';

interface RSSSource {
  id: string;
  url: string;
  name: string;
  isActive: boolean;
  lastFetch: number;
  fetchInterval: number;
  errorCount: number;
  lastError?: string;
  userId: string;
}

interface RSSContent {
  guid: string;
  title: string;
  link: string;
  content: string;
  publishedAt: string;
}

interface FetchResult {
  sourceId: string;
  success: boolean;
  entriesCount: number;
  newEntriesCount: number;
  error?: string;
  processingTime: number;
}

export class RssSchedulerService {
  private readonly MAX_CONCURRENT_FETCHES = 10; // 并行抓取限制
  private readonly FETCH_TIMEOUT = 30000; // 30秒超时
  private readonly MIN_FETCH_INTERVAL = 5 * 60 * 1000; // 最小抓取间隔5分钟
  private readonly deduplicationService: ContentDeduplicationService;

  constructor(
    private db: any,
    private queueProducer: QueueProducerService,
    private rssQueue?: Queue<any>
  ) {
    this.deduplicationService = new ContentDeduplicationService(db);
  }

  /**
   * 调度所有活跃RSS源的抓取 - 新的并行抓取实现
   */
  async scheduleAllSources(force: boolean = false): Promise<FetchResult[]> {
    console.log('开始调度RSS源抓取...');
    
    // 获取需要抓取的RSS源
    const activeSources = await this.getFetchableSources(force);
    console.log(`找到 ${activeSources.length} 个需要抓取的RSS源`);

    if (activeSources.length === 0) {
      console.log('没有需要抓取的RSS源');
      return [];
    }

    // 分批并行处理，避免过载
    const batches = this.chunkArray(activeSources, this.MAX_CONCURRENT_FETCHES);
    const allResults: FetchResult[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`处理第 ${i + 1}/${batches.length} 批，包含 ${batch.length} 个RSS源`);
      
      // 并行抓取当前批次
      const batchPromises = batch.map(source => this.fetchSingleSource(source));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // 处理结果
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          allResults.push(result.value);
        } else {
          console.error('RSS源抓取失败:', result.reason);
        }
      }

      // 批次间短暂延迟，避免触发限流
      if (i < batches.length - 1) {
        await this.delay(1000);
      }
    }

    console.log(`RSS抓取调度完成，共处理 ${allResults.length} 个源`);
    return allResults;
  }

  /**
   * 获取所有需要检查的RSS源 - 兼容性方法
   */
  async getSourcesToCheck(): Promise<any[]> {
    const sources = await this.getFetchableSources();
    return sources.map(s => ({
      id: parseInt(s.id),
      url: s.url,
      name: s.name,
      isActive: s.isActive,
      lastFetchedAt: new Date(s.lastFetch),
      fetchFailureCount: s.errorCount,
      fetchErrorMessage: s.lastError
    }));
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
          console.log(`[SUCCESS] 已成功发送手动触发的RSS源 ${sourceId} 获取任务到队列`);
        } catch (queueError) {
          console.error('[ERROR] 发送队列消息失败:', queueError);
          return false;
        }
      } else {
        console.warn('[WARN] RSS队列未配置，无法发送获取任务');
        // 仍然更新数据库状态，但提示队列未配置
      }
      
      // 更新源的状态为正在获取
      await this.updateSourceFetchStatus(sourceId, new Date(), source.fetchFailureCount || 0, null);
      console.log(`[SUCCESS] 已更新RSS源 ${sourceId} 的获取状态`);
      
      return true;
    } catch (error) {
      console.error('[ERROR] 手动触发RSS源获取失败:', error);
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

  // ========== 新增的并行抓取核心方法 ==========

  /**
   * 获取需要抓取的RSS源
   */
  private async getFetchableSources(force: boolean = false): Promise<RSSSource[]> {
    const now = new Date();
    const minFetchTime = new Date(now.getTime() - this.MIN_FETCH_INTERVAL);

    try {
      let query = this.db.select().from(sources);
      
      if (!force) {
        // 正常模式：只选择可用的源
        query = query.where(
          and(
            // 只选择可用的源（失败次数小于5次且质量可用性大于50）
            lt(sources.fetchFailureCount, 5),
            gt(sources.qualityAvailability, 50),
            or(
              isNull(sources.lastFetchedAt), // 从未获取过
              lt(sources.lastFetchedAt, minFetchTime) // 或者超过间隔时间
            )
          )
        );
      } else {
        // 强制模式：选择所有源，忽略质量检查，但仍考虑时间间隔
        query = query.where(
          or(
            isNull(sources.lastFetchedAt), // 从未获取过
            lt(sources.lastFetchedAt, minFetchTime) // 或者超过间隔时间
          )
        );
      }
      
      const sourcesToFetch = await query;

      return sourcesToFetch.map(source => ({
        id: source.id.toString(),
        url: source.url,
        name: source.name,
        isActive: source.isActive,
        lastFetch: source.lastFetchedAt?.getTime() || 0,
        fetchInterval: source.fetchInterval || 30, // 默认30分钟
        errorCount: source.fetchFailureCount || 0,
        lastError: source.fetchErrorMessage,
        userId: source.userId.toString()
      }));
    } catch (error) {
      console.error('获取RSS源列表失败:', error);
      return [];
    }
  }

  /**
   * 抓取单个RSS源
   */
  private async fetchSingleSource(source: RSSSource): Promise<FetchResult> {
    const startTime = Date.now();
    
    try {
      console.log(`开始抓取RSS源: ${source.name} (${source.url})`);

      // 检查是否需要跳过（基于失败次数）
      if (source.errorCount >= 5) {
        throw new Error(`RSS源 ${source.name} 失败次数过多，暂停抓取`);
      }

      // 带超时和缓存的HTTP请求
      const response = await this.fetchWithTimeout(source.url, {
        headers: {
          'User-Agent': 'News-Platform/1.0',
          'Accept': 'application/rss+xml, application/xml, text/xml',
          'If-Modified-Since': source.lastFetch > 0 
            ? new Date(source.lastFetch).toUTCString() 
            : undefined
        },
        signal: AbortSignal.timeout(this.FETCH_TIMEOUT)
      });

      // 处理HTTP响应
      if (response.status === 304) {
        // 内容未修改
        await this.updateSourceStatus(parseInt(source.id), {
          lastFetchedAt: new Date()
        });
        
        console.log(`RSS源 ${source.name} 内容未修改，跳过处理`);
        return {
          sourceId: source.id,
          success: true,
          entriesCount: 0,
          newEntriesCount: 0,
          processingTime: Date.now() - startTime
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rssContent = await response.text();
      
      // 解析RSS内容
      const entries = await this.parseRSSContent(rssContent);
      console.log(`RSS源 ${source.name} 解析完成，找到 ${entries.length} 个条目`);

      // 去重处理和发送到队列
      const newEntriesCount = await this.processEntries(source, entries);

      // 更新源状态
      await this.updateSourceStatus(parseInt(source.id), {
        lastFetchedAt: new Date(),
        fetchFailureCount: 0,
        fetchErrorMessage: null
      });

      const processingTime = Date.now() - startTime;
      console.log(`RSS源 ${source.name} 抓取完成，新条目: ${newEntriesCount}/${entries.length}, 耗时: ${processingTime}ms`);

      return {
        sourceId: source.id,
        success: true,
        entriesCount: entries.length,
        newEntriesCount,
        processingTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error(`RSS源 ${source.name} 抓取失败:`, errorMessage);

      // 更新失败状态
      await this.updateSourceStatus(parseInt(source.id), {
        lastFetchedAt: new Date(),
        fetchFailureCount: source.errorCount + 1,
        fetchErrorMessage: errorMessage
      });

      return {
        sourceId: source.id,
        success: false,
        entriesCount: 0,
        newEntriesCount: 0,
        error: errorMessage,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * 带超时的HTTP请求
   */
  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`请求超时 (${this.FETCH_TIMEOUT}ms)`);
      }
      throw error;
    }
  }

  /**
   * 解析RSS内容
   */
  private async parseRSSContent(rssContent: string): Promise<RSSContent[]> {
    try {
      const parser = new Parser();
      const feed = await parser.parseString(rssContent);
      
      return feed.items.map(item => ({
        guid: item.guid || item.id || item.link || `${item.title}-${item.pubDate}`,
        title: item.title || '',
        link: item.link || '',
        content: item['content:encoded'] || item.content || item.summary || '',
        publishedAt: item.pubDate || item.isoDate || new Date().toISOString()
      }));
    } catch (error) {
      console.error('RSS解析失败:', error);
      throw new Error(`RSS解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 处理RSS条目，去重并发送到队列
   */
  private async processEntries(source: RSSSource, entries: RSSContent[]): Promise<number> {
    let newEntriesCount = 0;
    const messagesToSend = [];
    
    // 暂时禁用URL去重检查，直接处理所有条目
    console.log(`[DEBUG] 处理 ${entries.length} 个RSS条目，暂时禁用URL去重检查`);

    for (const entry of entries) {
      try {

        // 检查GUID是否已存在（避免主键冲突）
        const existingEntry = await this.db
          .select()
          .from(rssEntries)
          .where(eq(rssEntries.guid, entry.guid))
          .limit(1)
          .get();

        if (existingEntry) {
          console.log(`RSS条目已存在，跳过: ${entry.title} (GUID: ${entry.guid})`);
          continue;
        }

        // 创建新的RSS条目记录
        const newEntry = await this.db
          .insert(rssEntries)
          .values({
            sourceId: parseInt(source.id),
            userId: parseInt(source.userId),
            guid: entry.guid,
            title: entry.title,
            link: entry.link,
            content: entry.content,
            publishedAt: new Date(entry.publishedAt),
            createdAt: new Date(),
            status: 'pending',
            failureCount: 0
          })
          .returning()
          .get();

        // 暂时禁用URL去重注册
        /*
        try {
          await this.deduplicationService.registerProcessedUrl(
            entry.link,
            newEntry.id,
            source.userId,
            {
              sourceId: parseInt(source.id),
              title: entry.title,
              publishedAt: new Date(entry.publishedAt)
            }
          );
        } catch (urlError) {
          console.warn(`注册URL索引失败: ${entry.link}`, urlError);
          // 即使URL注册失败，也继续处理
        }
        */

        // 准备发送到AI处理队列
        const message = QueueProducerService.createAiProcessMessage(
          parseInt(source.id),
          source.userId,
          entry.content,
          {
            entryId: newEntry.id,
            title: entry.title,
            link: entry.link,
            guid: entry.guid,
            publishedAt: entry.publishedAt,
            sourceName: source.name
          }
        );

        messagesToSend.push(message);
        newEntriesCount++;

      } catch (error) {
        console.error(`处理RSS条目失败: ${entry.title}`, error);
        // 继续处理下一个条目
      }
    }

    // 批量发送到队列
    if (messagesToSend.length > 0) {
      try {
        await this.queueProducer.sendBatch(messagesToSend);
        console.log(`批量发送 ${messagesToSend.length} 个新条目到AI处理队列`);
      } catch (error) {
        console.error('发送消息到队列失败:', error);
        // 这里可以考虑重试机制
      }
    }

    return newEntriesCount;
  }

  /**
   * 数组分批工具
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 延迟工具
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取调度统计信息
   */
  async getSchedulerStats(): Promise<{
    totalSources: number;
    activeSources: number;
    failedSources: number;
    avgProcessingTime: number;
    lastScheduledAt: Date;
  }> {
    try {
      const [totalResult, activeResult, failedResult] = await Promise.all([
        this.db.select({ count: sql`count(*)` }).from(sources),
        this.db.select({ count: sql`count(*)` }).from(sources).where(eq(sources.isActive, true)),
        this.db.select({ count: sql`count(*)` }).from(sources).where(gt(sources.fetchFailureCount, 0))
      ]);

      return {
        totalSources: totalResult[0]?.count || 0,
        activeSources: activeResult[0]?.count || 0,
        failedSources: failedResult[0]?.count || 0,
        avgProcessingTime: 0, // 可以从历史记录计算
        lastScheduledAt: new Date()
      };
    } catch (error) {
      console.error('获取调度统计失败:', error);
      return {
        totalSources: 0,
        activeSources: 0,
        failedSources: 0,
        avgProcessingTime: 0,
        lastScheduledAt: new Date()
      };
    }
  }

  /**
   * 更新RSS源状态
   */
  private async updateSourceStatus(sourceId: number, updates: {
    lastFetchedAt?: Date;
    fetchFailureCount?: number;
    fetchErrorMessage?: string | null;
  }): Promise<void> {
    try {
      const updateData: any = {};
      
      if (updates.lastFetchedAt) {
        updateData.lastFetchedAt = updates.lastFetchedAt;
      }
      if (updates.fetchFailureCount !== undefined) {
        updateData.fetchFailureCount = updates.fetchFailureCount;
      }
      if (updates.fetchErrorMessage !== undefined) {
        updateData.fetchErrorMessage = updates.fetchErrorMessage;
      }

      await this.db
        .update(sources)
        .set(updateData)
        .where(eq(sources.id, sourceId));
        
    } catch (error) {
      console.error(`更新RSS源 ${sourceId} 状态失败:`, error);
    }
  }
}