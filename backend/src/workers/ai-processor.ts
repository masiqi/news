// src/workers/ai-processor.ts
import { Context } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { rssEntries } from '../db/schema';
import { eq } from 'drizzle-orm';
import { ContentCacheService } from '../services/content-cache.service';
import { QueueConsumerService } from '../services/queue/consumer';
import { QueueMonitorService } from '../services/queue/monitor';
import { QueueMessage } from '../services/queue/types';

// 最大失败重试次数
const MAX_FAILURE_RETRIES = 3;

interface Env {
  DB: D1Database;
  AI: any; // Cloudflare AI bindings
  // 其他环境变量
}

export default {
  async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    return new Response('AI Processor Worker');
  },

  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    const db = drizzle(env.DB);
    const contentCacheService = new ContentCacheService(db);
    const queueMonitor = new QueueMonitorService(env.AI_PROCESSOR_QUEUE);
    
    const consumer = new QueueConsumerService(env.AI_PROCESSOR_QUEUE);
    
    await consumer.process(async (message: QueueMessage) => {
      const startTime = Date.now();
      
      try {
        const { sourceId, content, metadata } = message.payload;
        const entryId = metadata?.entryId;
        
        // 如果提供了entryId，检查条目状态
        if (entryId) {
          const entry = await db.select().from(rssEntries).where(eq(rssEntries.id, entryId)).get();
          if (!entry) {
            console.error(`条目 ${entryId} 不存在`);
            return;
          }
          
          if (entry.failureCount >= MAX_FAILURE_RETRIES) {
            console.error(`条目 ${entryId} 失败次数超过最大重试次数，跳过处理`);
            return;
          }
        }
        
        // 使用Cloudflare Workers AI处理内容
        const aiStartTime = Date.now();
        
        // 并行执行AI处理任务以提高性能
        const [summaryResponse, markdownResponse, keywordsResponse, sentimentResponse] = await Promise.allSettled([
          env.AI.run('@cf/meta/llama-2-7b-chat-fp16', {
            prompt: `请为以下内容生成一个简短的摘要:\n\n${content}\n\n摘要:`
          }),
          env.AI.run('@cf/meta/llama-2-7b-chat-fp16', {
            prompt: `请将以下内容转换为结构化的Markdown格式:\n\n${content}\n\nMarkdown:`
          }),
          env.AI.run('@cf/meta/llama-2-7b-chat-fp16', {
            prompt: `请从以下内容中提取5个最重要的关键词，用逗号分隔:\n\n${content}\n\n关键词:`
          }),
          env.AI.run('@cf/meta/llama-2-7b-chat-fp16', {
            prompt: `请分析以下内容的情感倾向，回答"正面"、"负面"或"中性":\n\n${content}\n\n情感:`
          })
        ]);
        
        // 处理结果
        const summary = summaryResponse.status === 'fulfilled' ? summaryResponse.value.response : '摘要生成失败';
        const markdownContent = markdownResponse.status === 'fulfilled' ? markdownResponse.value.response : 'Markdown生成失败';
        const keywords = keywordsResponse.status === 'fulfilled' ? keywordsResponse.value.response : '关键词提取失败';
        const sentiment = sentimentResponse.status === 'fulfilled' ? sentimentResponse.value.response : '中性';
        
        // 记录任何AI处理失败
        if (summaryResponse.status === 'rejected') {
          console.error('摘要生成失败:', summaryResponse.reason);
        }
        if (markdownResponse.status === 'rejected') {
          console.error('Markdown生成失败:', markdownResponse.reason);
        }
        if (keywordsResponse.status === 'rejected') {
          console.error('关键词提取失败:', keywordsResponse.reason);
        }
        if (sentimentResponse.status === 'rejected') {
          console.error('情感分析失败:', sentimentResponse.reason);
        }
        
        const aiProcessingTime = Date.now() - aiStartTime;
        const totalProcessingTime = Date.now() - startTime;
        
        // 如果提供了entryId，缓存处理后的内容
        if (entryId) {
          const processedContent = await contentCacheService.cacheProcessedContent(
            entryId,
            {
              summary,
              markdownContent,
              keywords,
              sentiment,
              processingTime: aiProcessingTime,
              modelUsed: '@cf/meta/llama-2-7b-chat-fp16',
              createdAt: new Date(),
            }
          );
          
          // 标记条目为已处理
          await contentCacheService.markEntryAsProcessed(entryId);
          
          console.log(`内容处理完成，条目ID: ${entryId}, AI处理时间: ${aiProcessingTime}ms, 总处理时间: ${totalProcessingTime}ms`);
        } else {
          console.log(`内容处理完成，消息ID: ${message.id}, AI处理时间: ${aiProcessingTime}ms, 总处理时间: ${totalProcessingTime}ms`);
        }
        
        // 记录队列统计信息
        try {
          await queueMonitor.checkQueueHealth('AI_PROCESSOR_QUEUE');
        } catch (monitorError) {
          console.warn('记录队列统计信息失败:', monitorError);
        }
        
      } catch (error) {
        console.error('AI处理内容时出错:', error);
        
        // 如果提供了entryId，增加失败次数
        if (message.payload.metadata?.entryId) {
          try {
            await contentCacheService.incrementFailureCount(message.payload.metadata.entryId);
            console.log(`条目 ${message.payload.metadata.entryId} 失败次数已增加`);
          } catch (incrementError) {
            console.error('增加失败次数时出错:', incrementError);
          }
        }
        
        // 重新抛出错误，让队列自动重试
        throw new Error(`AI处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    });
  },
};