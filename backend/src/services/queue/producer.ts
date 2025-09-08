// src/services/queue/producer.ts
import { QueueMessage, QueueProducer, QueueConfig, MessageSerializationError } from './types';

export class QueueProducerService implements QueueProducer {
  private config: QueueConfig;
  private queue: any; // Cloudflare Queue binding

  constructor(queue: any, config: QueueConfig) {
    this.queue = queue;
    this.config = config;
  }

  /**
   * 发送单个消息到队列
   */
  async send(message: QueueMessage): Promise<void> {
    try {
      // 验证消息格式
      this.validateMessage(message);
      
      // 序列化消息
      const serializedMessage = this.serializeMessage(message);
      
      // 发送消息到队列
      await this.queue.send(serializedMessage);
      
      console.log(`消息已发送到队列: ${message.id}, 类型: ${message.type}`);
    } catch (error) {
      console.error('发送消息到队列失败:', error);
      
      if (error instanceof MessageSerializationError) {
        throw error;
      }
      
      throw new MessageSerializationError(
        `发送消息失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error as Error
      );
    }
  }

  /**
   * 批量发送消息到队列
   */
  async sendBatch(messages: QueueMessage[]): Promise<void> {
    if (!messages || messages.length === 0) {
      console.warn('批量发送消息: 消息列表为空');
      return;
    }

    try {
      // 验证所有消息
      for (const message of messages) {
        this.validateMessage(message);
      }

      // 序列化所有消息
      const serializedMessages = messages.map(msg => this.serializeMessage(msg));

      // 批量发送消息
      await this.queue.sendBatch(serializedMessages);
      
      console.log(`批量发送消息成功: ${messages.length} 条消息`);
    } catch (error) {
      console.error('批量发送消息失败:', error);
      
      throw new MessageSerializationError(
        `批量发送消息失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error as Error
      );
    }
  }

  /**
   * 验证消息格式
   */
  private validateMessage(message: QueueMessage): void {
    if (!message.id) {
      throw new MessageSerializationError('消息ID不能为空');
    }

    if (!message.type || !['rss_fetch', 'ai_process'].includes(message.type)) {
      throw new MessageSerializationError(`无效的消息类型: ${message.type}`);
    }

    if (!message.payload || !message.payload.sourceId || !message.payload.userId) {
      throw new MessageSerializationError('消息payload缺少必要字段');
    }

    if (message.attempts < 0 || message.maxRetries < 0) {
      throw new MessageSerializationError('重试次数不能为负数');
    }

    if (message.attempts > message.maxRetries) {
      throw new MessageSerializationError('当前重试次数不能超过最大重试次数');
    }

    // 检查消息大小（Cloudflare Queues限制为128KB）
    const messageSize = this.calculateMessageSize(message);
    const maxSize = 128 * 1024; // 128KB
    if (messageSize > maxSize) {
      throw new MessageSerializationError(`消息大小超过限制: ${messageSize} > ${maxSize} 字节`);
    }
  }

  /**
   * 序列化消息
   */
  private serializeMessage(message: QueueMessage): any {
    try {
      return {
        id: message.id,
        type: message.type,
        payload: message.payload,
        timestamp: message.timestamp.toISOString(),
        attempts: message.attempts,
        maxRetries: message.maxRetries
      };
    } catch (error) {
      throw new MessageSerializationError(
        `消息序列化失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error as Error
      );
    }
  }

  /**
   * 创建RSS获取消息
   */
  static createRssFetchMessage(
    sourceId: string,
    userId: string,
    url: string,
    title?: string,
    metadata?: Record<string, any>
  ): QueueMessage {
    return {
      id: this.generateMessageId(),
      type: 'rss_fetch',
      payload: {
        sourceId,
        userId,
        url,
        title,
        metadata
      },
      timestamp: new Date(),
      attempts: 0,
      maxRetries: 3
    };
  }

  /**
   * 创建AI处理消息
   */
  static createAiProcessMessage(
    sourceId: string,
    userId: string,
    content: string,
    metadata?: Record<string, any>
  ): QueueMessage {
    return {
      id: this.generateMessageId(),
      type: 'ai_process',
      payload: {
        sourceId,
        userId,
        content,
        url: '', // AI处理消息需要url字段但可以为空
        metadata
      },
      timestamp: new Date(),
      attempts: 0,
      maxRetries: 3
    };
  }

  /**
   * 计算消息大小（字节）
   */
  private calculateMessageSize(message: QueueMessage): number {
    const serializedMessage = JSON.stringify(message);
    return new TextEncoder().encode(serializedMessage).length;
  }

  /**
   * 生成消息ID
   */
  private static generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取队列配置
   */
  getConfig(): QueueConfig {
    return { ...this.config };
  }
}