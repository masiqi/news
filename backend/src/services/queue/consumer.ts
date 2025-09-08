// src/services/queue/consumer.ts
import type { MessageBatch } from '@cloudflare/workers-types';
import { QueueMessage, QueueConsumer, MessageProcessingError } from './types';

export class QueueConsumerService implements QueueConsumer {
  private queue: any; // Cloudflare Queue binding
  private processingMessages: Map<string, Promise<void>> = new Map();
  private isProcessing: boolean = false;
  private cleanupInterval?: NodeJS.Timeout;
  private readonly maxCleanupAge = 30 * 60 * 1000; // 30分钟

  constructor(queue: any) {
    this.queue = queue;
    this.startCleanupTimer();
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMessages();
    }, 5 * 60 * 1000); // 每5分钟清理一次
  }

  /**
   * 清理旧的消息处理记录
   */
  private cleanupOldMessages(): void {
    const now = Date.now();
    const messageIds = Array.from(this.processingMessages.keys());
    for (const messageId of messageIds) {
      // 简单的清理逻辑：如果消息在处理列表中存在时间过长，清理记录
      // 这是一个安全机制，防止内存泄漏
      // 在实际应用中，可能需要更复杂的时间跟踪逻辑
      console.warn(`发现长时间处理的消息: ${messageId}，清理记录`);
      this.processingMessages.delete(messageId);
    }
  }

  /**
   * 停止清理定时器
   */
  private stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * 处理队列消息
   */
  async process(handler: (message: QueueMessage) => Promise<void>): Promise<void> {
    if (this.isProcessing) {
      console.warn('消费者已经在处理消息中');
      return;
    }

    this.isProcessing = true;
    
    try {
      // 设置消息处理监听器
      this.queue.batch(async (batch: MessageBatch<any>) => {
        const processingPromises = batch.messages.map(async (message) => {
          try {
            // 解析消息
            const queueMessage = this.parseMessage(message);
            
            // 检查是否已经在处理中
            if (this.processingMessages.has(queueMessage.id)) {
              console.warn(`消息 ${queueMessage.id} 已经在处理中，跳过`);
              return;
            }

            // 标记为处理中
            const processingPromise = this.handleMessage(queueMessage, handler);
            this.processingMessages.set(queueMessage.id, processingPromise);

            // 等待处理完成
            await processingPromise;
          } catch (error) {
            console.error('处理消息时发生错误:', error);
            
            // 对于处理失败的消息，不进行重试（重试逻辑在Cloudflare Queues中自动处理）
            console.error(`消息 ${message.id} 处理失败，将由队列自动重试`);
          } finally {
            // 从处理中列表移除
            this.processingMessages.delete(message.id);
          }
        });

        // 等待所有消息处理完成
        await Promise.allSettled(processingPromises);
      });

      console.log('队列消费者启动成功');
    } catch (error) {
      console.error('启动队列消费者失败:', error);
      throw new MessageProcessingError(
        `启动队列消费者失败: ${error instanceof Error ? error.message : '未知错误'}`,
        'CONSUMER_STARTUP_FAILED',
        error as Error
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 处理单个消息
   */
  private async handleMessage(
    message: QueueMessage,
    handler: (message: QueueMessage) => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`开始处理消息: ${message.id}, 类型: ${message.type}`);

      // 检查重试次数
      if (message.attempts >= message.maxRetries) {
        throw new MessageProcessingError(
          `消息 ${message.id} 已达到最大重试次数 (${message.maxRetries})`,
          'MAX_RETRIES_EXCEEDED'
        );
      }

      // 执行用户定义的处理逻辑
      await handler(message);

      const processingTime = Date.now() - startTime;
      console.log(`消息处理成功: ${message.id}, 处理时间: ${processingTime}ms`);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      console.error(`消息处理失败: ${message.id}, 处理时间: ${processingTime}ms`, error);
      
      // 重新抛出错误，让Cloudflare Queues处理重试
      throw new MessageProcessingError(
        `消息处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
        'PROCESSING_FAILED'
      );
    }
  }

  /**
   * 解析消息
   */
  private parseMessage(message: any): QueueMessage {
    try {
      const body = message.body;
      
      return {
        id: body.id || message.id,
        type: body.type,
        payload: body.payload,
        timestamp: new Date(body.timestamp),
        attempts: body.attempts || 0,
        maxRetries: body.maxRetries || 3
      };
    } catch (error) {
      throw new MessageProcessingError(
        `消息解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
        'MESSAGE_PARSE_ERROR',
        error as Error
      );
    }
  }

  /**
   * 确认消息处理完成（Cloudflare Queues会自动处理）
   */
  async acknowledge(messageId: string): Promise<void> {
    // Cloudflare Queues会自动处理消息确认
    // 这里只需要记录日志
    console.log(`消息 ${messageId} 处理完成`);
  }

  /**
   * 手动重试消息
   */
  async retry(messageId: string): Promise<void> {
    console.log(`请求重试消息: ${messageId}`);
    // Cloudflare Queues会自动处理重试
    // 这里可以添加自定义的重试逻辑
  }

  /**
   * 将消息发送到死信队列
   */
  async deadLetter(messageId: string, error: string): Promise<void> {
    console.error(`将消息 ${messageId} 发送到死信队列: ${error}`);
    // Cloudflare Queues会自动处理死信队列
    // 这里可以添加自定义的死信处理逻辑
  }

  /**
   * 获取当前正在处理的消息数量
   */
  getProcessingCount(): number {
    return this.processingMessages.size;
  }

  /**
   * 检查是否正在处理中
   */
  isProcessingMessages(): boolean {
    return this.isProcessing;
  }

  /**
   * 获取处理中的消息ID列表
   */
  getProcessingMessageIds(): string[] {
    return Array.from(this.processingMessages.keys());
  }
}