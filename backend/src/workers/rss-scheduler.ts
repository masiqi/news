// src/workers/rss-scheduler.ts
import { Context } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { sources } from '../db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { RssSchedulerService } from '../services/rss-scheduler.service';

interface Env {
  DB: D1Database;
  RSS_FETCHER_QUEUE: Queue<any>;
  // 其他环境变量
}

export default {
  async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    const url = new URL(request.url);
    
    // 添加手动触发端点
    if (url.pathname === '/trigger-scheduler') {
      const controller = {
        cron: '0 * * * *'
      } as ScheduledController;
      
      await this.scheduled(controller, env, ctx);
      return new Response('RSS调度器已手动触发', { status: 200 });
    }
    
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
      const schedulerService = new RssSchedulerService(env.DB);
      
      // 获取所有活跃的RSS源
      const activeSources = await schedulerService.getSourcesToCheck();
      
      console.log(`找到 ${activeSources.length} 个活跃RSS源`);
      
      // 为每个需要重新获取的源发送获取任务到队列
      let scheduledTasks = 0;
      for (const source of activeSources) {
        try {
          // 检查源是否需要重新获取
          const shouldRefetch = await schedulerService.shouldRefetchSource(source);
          if (shouldRefetch) {
            // 发送获取任务到RSS获取队列
            await env.RSS_FETCHER_QUEUE.send({
              sourceId: source.id,
              rssUrl: source.url,
              scheduledAt: new Date().toISOString()
            });
            
            console.log(`已发送源 ${source.id} (${source.name}) 的获取任务到队列`);
            scheduledTasks++;
          } else {
            console.log(`源 ${source.id} (${source.name}) 不需要重新获取`);
          }
        } catch (error) {
          console.error(`处理源 ${source.id} 时出错:`, error);
        }
      }
      
      console.log(`RSS调度器执行完成，共调度 ${scheduledTasks} 个任务`);
    } catch (error) {
      console.error('RSS调度器执行失败:', error);
    }
  },
};