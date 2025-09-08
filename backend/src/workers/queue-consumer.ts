// src/workers/queue-consumer.ts
import { Context, MessageBatch } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';
import { QueueConsumerService } from '../services/queue/consumer';
import { QueueMonitorService } from '../services/queue/monitor';
import { QueueMessage, ProcessingStatus } from '../services/queue/types';
import { processingStatuses, messageHistories, queueStats } from '../db/schema';

interface Env {
  DB: D1Database;
  RSS_PROCESSOR_QUEUE: Queue<any>;
  AI_PROCESSOR_QUEUE: Queue<any>;
  RSS_PROCESSOR_DLQ: Queue<any>;
  AI_PROCESSOR_DLQ: Queue<any>;
}

export default {
  async fetch(request: Request, env: Env, ctx: Context): Promise<Response> {
    return new Response('Queue Consumer Worker');
  },

  /**
   * RSS处理队列的消费者
   */
  async rssProcessorQueue(batch: MessageBatch<any>, env: Env): Promise<void> {
    const db = drizzle(env.DB);
    const queueMonitor = new QueueMonitorService(env.RSS_PROCESSOR_QUEUE);
    
    const consumer = new QueueConsumerService(env.RSS_PROCESSOR_QUEUE);
    
    await consumer.process(async (message: QueueMessage) => {
      await this.handleRssMessage(message, db, env, queueMonitor);
    });
  },

  /**
   * AI处理队列的消费者
   */
  async aiProcessorQueue(batch: MessageBatch<any>, env: Env): Promise<void> {
    const db = drizzle(env.DB);
    const queueMonitor = new QueueMonitorService(env.AI_PROCESSOR_QUEUE);
    
    const consumer = new QueueConsumerService(env.AI_PROCESSOR_QUEUE);
    
    await consumer.process(async (message: QueueMessage) => {
      await this.handleAiMessage(message, db, env, queueMonitor);
    });
  },

  /**
   * 处理RSS获取消息
   */
  private async handleRssMessage(
    message: QueueMessage,
    db: ReturnType<typeof drizzle>,
    env: Env,
    queueMonitor: QueueMonitorService
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 记录处理开始
      await this.updateProcessingStatus(db, message.id, 'processing');
      await this.recordMessageHistory(db, message.id, 'processing', message.attempts);
      
      // 执行RSS获取逻辑
      await this.processRssFetch(message, db, env);
      
      // 记录处理完成
      const processingTime = Date.now() - startTime;
      await this.updateProcessingStatus(db, message.id, 'completed', undefined, startTime + processingTime);
      await this.recordMessageHistory(db, message.id, 'completed', message.attempts, processingTime);
      
      console.log(`RSS消息处理完成: ${message.id}, 处理时间: ${processingTime}ms`);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // 记录处理失败
      await this.updateProcessingStatus(db, message.id, 'failed', error instanceof Error ? error.message : '未知错误', startTime + processingTime);
      await this.recordMessageHistory(db, message.id, 'failed', message.attempts, processingTime, error instanceof Error ? error.message : '未知错误');
      
      // 重新抛出错误，让队列自动重试
      throw error;
    }
  },

  /**
   * 处理AI处理消息
   */
  private async handleAiMessage(
    message: QueueMessage,
    db: ReturnType<typeof drizzle>,
    env: Env,
    queueMonitor: QueueMonitorService
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 记录处理开始
      await this.updateProcessingStatus(db, message.id, 'processing');
      await this.recordMessageHistory(db, message.id, 'processing', message.attempts);
      
      // 执行AI处理逻辑
      await this.processAiContent(message, db, env);
      
      // 记录处理完成
      const processingTime = Date.now() - startTime;
      await this.updateProcessingStatus(db, message.id, 'completed', undefined, startTime + processingTime);
      await this.recordMessageHistory(db, message.id, 'completed', message.attempts, processingTime);
      
      console.log(`AI消息处理完成: ${message.id}, 处理时间: ${processingTime}ms`);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // 记录处理失败
      await this.updateProcessingStatus(db, message.id, 'failed', error instanceof Error ? error.message : '未知错误', startTime + processingTime);
      await this.recordMessageHistory(db, message.id, 'failed', message.attempts, processingTime, error instanceof Error ? error.message : '未知错误');
      
      // 重新抛出错误，让队列自动重试
      throw error;
    }
  },

  /**
   * 执行RSS获取处理
   */
  private async processRssFetch(
    message: QueueMessage,
    db: ReturnType<typeof drizzle>,
    env: Env
  ): Promise<void> {
    const { sourceId, url } = message.payload;
    
    // 这里应该调用现有的RSS获取逻辑
    // 由于这是一个简化的示例，我们只是模拟处理过程
    
    console.log(`处理RSS获取: 源ID ${sourceId}, URL: ${url}`);
    
    // 模拟RSS获取
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`RSS获取失败: HTTP ${response.status} ${response.statusText}`);
    }
    
    const content = await response.text();
    console.log(`RSS内容获取成功: ${content.length} 字符`);
    
    // 如果需要，可以将获取的内容发送到AI处理队列
    if (message.type === 'rss_fetch' && content) {
      await env.AI_PROCESSOR_QUEUE.send({
        id: this.generateMessageId(),
        type: 'ai_process',
        payload: {
          sourceId,
          userId: message.payload.userId,
          content,
          metadata: message.payload.metadata
        },
        timestamp: new Date().toISOString(),
        attempts: 0,
        maxRetries: 3
      });
    }
  },

  /**
   * 执行AI内容处理
   */
  private async processAiContent(
    message: QueueMessage,
    db: ReturnType<typeof drizzle>,
    env: Env
  ): Promise<void> {
    const { sourceId, content } = message.payload;
    
    console.log(`处理AI内容: 源ID ${sourceId}, 内容长度: ${content?.length || 0} 字符`);
    
    // 使用Cloudflare Workers AI处理内容
    if (env.AI) {
      try {
        // 生成摘要
        const summaryResponse = await env.AI.run(
          '@cf/meta/llama-2-7b-chat-fp16',
          {
            prompt: `请为以下内容生成一个简短的摘要:\n\n${content}\n\n摘要:`
          }
        );
        const summary = summaryResponse.response;
        
        console.log(`AI摘要生成成功: ${summary.length} 字符`);
        
        // 这里可以保存处理结果到数据库
        // 由于这是一个示例，我们只记录日志
        
      } catch (aiError) {
        console.error('AI处理失败:', aiError);
        throw new Error(`AI处理失败: ${aiError instanceof Error ? aiError.message : '未知错误'}`);
      }
    } else {
      console.warn('AI服务未配置，跳过AI处理');
    }
  },

  /**
   * 更新处理状态
   */
  private async updateProcessingStatus(
    db: ReturnType<typeof drizzle>,
    messageId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    error?: string,
    completedAt?: number
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date()
      };
      
      if (error) {
        updateData.error = error;
      }
      
      if (completedAt) {
        updateData.completedAt = new Date(completedAt);
      }
      
      if (status === 'processing') {
        updateData.startedAt = new Date();
      }
      
      await db.update(processingStatuses)
        .set(updateData)
        .where(eq(processingStatuses.messageId, messageId));
        
    } catch (error) {
      console.error('更新处理状态失败:', error);
      // 不抛出错误，避免影响主流程
    }
  },

  /**
   * 记录消息历史
   */
  private async recordMessageHistory(
    db: ReturnType<typeof drizzle>,
    messageId: string,
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'retried' | 'dead_letter',
    retryCount: number,
    processingTime?: number,
    error?: string
  ): Promise<void> {
    try {
      await db.insert(messageHistories).values({
        messageId,
        status,
        timestamp: new Date(),
        retryCount,
        processingTime,
        error,
        createdAt: new Date()
      });
    } catch (historyError) {
      console.error('记录消息历史失败:', historyError);
      // 不抛出错误，避免影响主流程
    }
  },

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

// 导出队列处理器函数
const rssProcessorQueueHandler = (batch: MessageBatch<any>, env: Env, ctx: Context) => {
  return default.rssProcessorQueue(batch, env, ctx);
};

const aiProcessorQueueHandler = (batch: MessageBatch<any>, env: Env, ctx: Context) => {
  return default.aiProcessorQueue(batch, env, ctx);
};

export { rssProcessorQueueHandler, aiProcessorQueueHandler };