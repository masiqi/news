// src/workers/rss-fetcher.ts
import { Context } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries, sources } from '../db/schema';
import { eq } from 'drizzle-orm';
import { ContentCacheService } from '../services/content-cache.service';
import { SourceService } from '../services/source.service';

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

        // 抓取RSS内容
        const response = await fetch(rssUrl);
        const rssContent = await response.text();

        // 解析RSS内容（这里简化处理，实际应用中应使用RSS解析库）
        // 示例：假设我们解析出条目数组
        const entries = parseRssContent(rssContent);

        // 处理每个条目
        for (const entry of entries) {
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

          // 如果条目尚未处理，发送到AI处理队列
          if (!wasAlreadyProcessed) {
            await env.AI_PROCESSOR_QUEUE.send({
              entryId: rssEntry.id,
              sourceId: sourceId,
              content: entry.content,
            });
          }
        }
      } catch (error) {
        console.error('处理RSS源时出错:', error);
        // 可以选择重新排队失败的消息
      }
    }
  },
};

// 简化的RSS解析函数（实际应用中应使用专业库）
function parseRssContent(rssContent: string): any[] {
  // 这里应该实现实际的RSS解析逻辑
  // 为简化起见，返回示例数据
  return [
    {
      guid: 'example-guid-1',
      title: 'Example RSS Entry 1',
      link: 'https://example.com/article1',
      content: 'Example content 1',
      publishedAt: new Date().toISOString(),
    },
    {
      guid: 'example-guid-2',
      title: 'Example RSS Entry 2',
      link: 'https://example.com/article2',
      content: 'Example content 2',
      publishedAt: new Date().toISOString(),
    },
  ];
}

// 注意：这里需要导入sources表和eq函数，但由于循环依赖问题，
// 在实际实现中可能需要重构代码结构