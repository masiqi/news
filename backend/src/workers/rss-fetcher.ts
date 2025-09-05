// src/workers/rss-fetcher.ts
import { Context } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, sources } from '../db/schema';
import { eq } from 'drizzle-orm';
import { ContentCacheService } from '../services/content-cache.service';
import { SourceService } from '../services/source.service';
import Parser from 'rss-parser';

// 最大失败重试次数
const MAX_FAILURE_RETRIES = 3;

// 指数退避重试延迟（毫秒）
const RETRY_DELAYS = [1000, 5000, 15000]; // 1秒, 5秒, 15秒

interface Env {
  DB: D1Database;
  AI_PROCESSOR_QUEUE: Queue<any>;
  // 其他环境变量
}

export default {
  async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    return new Response('RSS Fetcher Worker');
  },

  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    const db = drizzle(env.DB);
    const contentCacheService = new ContentCacheService(db);
    const sourceService = new SourceService(db);

    for (const message of batch.messages) {
      try {
        const { sourceId, rssUrl } = message.body;
        
        // 获取RSS源信息
        const source = await db.select().from(sources).where(eq(sources.id, sourceId)).get();
        if (!source) {
          console.error(`RSS源 ${sourceId} 不存在`);
          continue;
        }

        // 抓取RSS内容，带重试机制
        let rssContent: string | null = null;
        let fetchError: Error | null = null;
        
        // 尝试获取RSS内容，最多重试MAX_FAILURE_RETRIES次
        for (let attempt = 0; attempt <= MAX_FAILURE_RETRIES; attempt++) {
          try {
            const response = await fetch(rssUrl);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            rssContent = await response.text();
            fetchError = null;
            break; // 成功获取内容，跳出重试循环
          } catch (error) {
            fetchError = error as Error;
            console.error(`获取RSS源 ${sourceId} 失败 (尝试 ${attempt + 1}/${MAX_FAILURE_RETRIES + 1}):`, error);
            
            // 如果还有重试机会，等待一段时间后重试
            if (attempt < MAX_FAILURE_RETRIES) {
              const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
              console.log(`等待 ${delay}ms 后重试...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }

        // 如果获取内容失败，更新源状态并跳过处理
        if (!rssContent || fetchError) {
          console.error(`获取RSS源 ${sourceId} 内容失败，已达到最大重试次数`);
          
          // 更新源的获取状态
          await db.update(sources)
            .set({
              fetchFailureCount: source.fetchFailureCount + 1,
              fetchErrorMessage: fetchError?.message || '未知错误',
              lastFetchedAt: new Date(),
            })
            .where(eq(sources.id, sourceId));
          
          continue;
        }

        // 重置源的失败计数
        await db.update(sources)
          .set({
            fetchFailureCount: 0,
            fetchErrorMessage: null,
            lastFetchedAt: new Date(),
          })
          .where(eq(sources.id, sourceId));

        // 解析RSS内容
        const entries = await parseRssContent(rssContent);

        // 处理每个条目
        for (const entry of entries) {
          try {
            // 检查条目是否已存在并处理
            const { entry: rssEntry, wasAlreadyProcessed } = await contentCacheService.processRssEntry(
              sourceId,
              entry.guid,
              {
                title: entry.title,
                link: entry.link,
                content: entry.content,
                publishedAt: new Date(entry.publishedAt),
                createdAt: new Date(),
              }
            );

            // 检查失败次数
            if (rssEntry.failureCount >= MAX_FAILURE_RETRIES) {
              console.error(`条目 ${rssEntry.id} 失败次数超过最大重试次数，跳过处理`);
              continue;
            }

            // 如果条目尚未处理，发送到AI处理队列
            if (!wasAlreadyProcessed) {
              await env.AI_PROCESSOR_QUEUE.send({
                entryId: rssEntry.id,
                sourceId: sourceId,
                content: entry.content,
              });
            }
          } catch (entryError) {
            console.error(`处理RSS条目失败:`, entryError);
            // 继续处理下一个条目
          }
        }
      } catch (error) {
        console.error('处理RSS源时出错:', error);
        // 可以选择重新排队失败的消息
        // 注意：在实际应用中，我们需要更智能的重试机制
      }
    }
  },
};

// 使用专业RSS解析库解析RSS内容
async function parseRssContent(rssContent: string): Promise<any[]> {
  try {
    const parser = new Parser();
    const feed = await parser.parseString(rssContent);
    
    // 将解析后的条目转换为统一格式
    return feed.items.map(item => ({
      guid: item.guid || item.id || item.link || `${item.title}-${item.pubDate}`,
      title: item.title || '',
      link: item.link || '',
      content: item['content:encoded'] || item.content || item.summary || '',
      publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('解析RSS内容失败:', error);
    throw new Error(`RSS解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// 注意：这里需要导入sources表和eq函数，但由于循环依赖问题，
// 在实际实现中可能需要重构代码结构