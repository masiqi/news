// src/workers/content-distributor.ts
// 内容分发Worker - 专门处理内容分发任务的Worker

import { Context } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { ContentDistributionService } from '../services/content-distribution.service';
import { SharedContentPoolService } from '../services/shared-content-pool.service';
import { R2Service } from '../services/r2.service';
import { QueueConsumerService } from '../services/queue/consumer';
import { QueueMonitorService } from '../services/queue/monitor';
import { QueueMessage } from '../services/queue/types';

interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  CONTENT_DISTRIBUTION_QUEUE: Queue;
  // 其他环境变量
}

export default {
  async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    return new Response('Content Distribution Worker');
  },

  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    const db = drizzle(env.DB);
    const queueMonitor = new QueueMonitorService(env.CONTENT_DISTRIBUTION_QUEUE);
    
    // 初始化服务
    const r2Service = new R2Service(env);
    const sharedContentPool = new SharedContentPoolService(db, r2Service);
    const contentDistributionService = new ContentDistributionService(sharedContentPool, r2Service);
    
    const consumer = new QueueConsumerService(env.CONTENT_DISTRIBUTION_QUEUE);
    
    await consumer.process(async (message: QueueMessage) => {
      const startTime = Date.now();
      
      try {
        const { 
          contentHash, 
          processedContentId, 
          entryId, 
          contentFeatures 
        } = message.payload;

        if (!contentHash || !processedContentId || !entryId || !contentFeatures) {
          throw new Error('内容分发消息缺少必要字段');
        }

        console.log(`[DISTRIBUTION-WORKER] 开始处理内容分发: 内容哈希 ${contentHash}, 条目ID ${entryId}`);

        // 执行智能内容分发
        const distributionResults = await contentDistributionService.distributeContent(
          contentHash,
          processedContentId,
          entryId,
          contentFeatures
        );

        const successCount = distributionResults.filter(r => r.success).length;
        const totalCount = distributionResults.length;
        const totalTime = Date.now() - startTime;

        console.log(`[DISTRIBUTION-WORKER] 内容分发完成: 成功 ${successCount}/${totalCount} 用户, 耗时 ${totalTime}ms`);

        if (totalCount > 0) {
          console.log(`[DISTRIBUTION-WORKER] 分发统计:`);
          console.log(`[DISTRIBUTION-WORKER]   - 成功率: ${((successCount / totalCount) * 100).toFixed(1)}%`);
          console.log(`[DISTRIBUTION-WORKER]   - 平均处理时间: ${(distributionResults.reduce((sum, r) => sum + r.processingTime, 0) / totalCount).toFixed(0)}ms`);
          
          // 记录分发失败的详情
          const failedDistributions = distributionResults.filter(r => !r.success);
          if (failedDistributions.length > 0) {
            console.warn(`[DISTRIBUTION-WORKER] 分发失败详情:`);
            failedDistributions.forEach(fd => {
              console.warn(`[DISTRIBUTION-WORKER]   - 用户 ${fd.target.userId}: ${fd.error}`);
            });
          }
        }

        // 记录队列健康状态
        try {
          await queueMonitor.checkQueueHealth('CONTENT_DISTRIBUTION_QUEUE');
        } catch (monitorError) {
          console.warn('记录队列健康状态失败:', monitorError);
        }

      } catch (error) {
        console.error('[DISTRIBUTION-WORKER] 内容分发处理失败:', error);
        
        // 记录错误并重新抛出，让队列自动重试
        throw new Error(`内容分发处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    });
  }
};

export { ContentDistributionService };