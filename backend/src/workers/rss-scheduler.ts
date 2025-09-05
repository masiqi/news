// src/workers/rss-scheduler.ts
import { Context } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { sources } from '../db/schema';
import { eq } from 'drizzle-orm';

interface Env {
  DB: D1Database;
  RSS_FETCHER_QUEUE: Queue<any>;
  // 其他环境变量
}

export default {
  async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    return new Response('RSS Scheduler Worker');
  },

  /**
   * Cron触发器处理函数
   * 每小时执行一次，检查所有活跃的RSS源并发送获取任务到队列
   */
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('RSS调度器开始执行');

    try {
      const db = drizzle(env.DB);
      
      // 获取所有活跃的RSS源（排除系统用户ID=1的源）
      const activeSources = await db.select().from(sources).where(eq(sources.userId, 1)).all();
      
      console.log(`找到 ${activeSources.length} 个活跃RSS源`);
      
      // 为每个源发送获取任务到队列
      for (const source of activeSources) {
        try {
          await env.RSS_FETCHER_QUEUE.send({
            sourceId: source.id,
            rssUrl: source.url,
            scheduledAt: new Date().toISOString()
          });
          
          console.log(`已发送源 ${source.id} (${source.name}) 的获取任务到队列`);
        } catch (error) {
          console.error(`发送源 ${source.id} 的获取任务失败:`, error);
        }
      }
      
      console.log('RSS调度器执行完成');
    } catch (error) {
      console.error('RSS调度器执行失败:', error);
    }
  },
};