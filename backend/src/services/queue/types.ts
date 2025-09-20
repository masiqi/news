// src/services/queue/types.ts

// 队列消息格式
export interface QueueMessage {
  id: string;
  type: 'rss_fetch' | 'ai_process' | 'content_distribute';
  payload: {
    sourceId?: string;
    userId?: string;
    url?: string;
    title?: string;
    content?: string;
    metadata?: Record<string, any>;
    // 内容分发专用字段
    contentHash?: string;
    processedContentId?: number;
    entryId?: number;
    contentFeatures?: {
      topics: string[];
      keywords: string[];
      importanceScore: number;
      source: string;
      contentType: 'news' | 'analysis' | 'tutorial';
    };
  };
  timestamp: Date;
  attempts: number;
  maxRetries: number;
}

// 处理状态跟踪
export interface ProcessingStatus {
  id: string;
  messageId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  userId: string;
  sourceId: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
}

// 队列统计信息
export interface QueueStats {
  queueName: string;
  pendingMessages: number;
  processingMessages: number;
  failedMessages: number;
  deadLetterMessages: number;
  averageProcessingTime: number;
  lastUpdated: Date;
}

// 消息历史记录
export interface MessageHistory {
  id: string;
  messageId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'retried' | 'dead_letter';
  timestamp: Date;
  error?: string;
  retryCount: number;
  processingTime?: number;
}

// 队列配置
export interface QueueConfig {
  maxBatchSize: number;
  maxWaitTimeMs: number;
  maxRetries: number;
  deadLetterQueue: string;
}

// 队列生产者接口
export interface QueueProducer {
  send(message: QueueMessage): Promise<void>;
  sendBatch(messages: QueueMessage[]): Promise<void>;
}

// 队列消费者接口
export interface QueueConsumer {
  process(handler: (message: QueueMessage) => Promise<void>): Promise<void>;
  acknowledge(messageId: string): Promise<void>;
  retry(messageId: string): Promise<void>;
  deadLetter(messageId: string, error: string): Promise<void>;
}

// 队列监控接口
export interface QueueMonitor {
  getQueueStats(): Promise<QueueStats>;
  getMessageHistory(messageId: string): Promise<MessageHistory[]>;
  getFailedMessages(): Promise<QueueMessage[]>;
}

// 队列错误类型
export class QueueError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'QueueError';
  }
}

// 队列配置错误
export class QueueConfigError extends QueueError {
  constructor(message: string, originalError?: Error) {
    super(message, 'QUEUE_CONFIG_ERROR', originalError);
    this.name = 'QueueConfigError';
  }
}

// 消息序列化错误
export class MessageSerializationError extends QueueError {
  constructor(message: string, originalError?: Error) {
    super(message, 'MESSAGE_SERIALIZATION_ERROR', originalError);
    this.name = 'MessageSerializationError';
  }
}

// 消息处理错误
export class MessageProcessingError extends QueueError {
  constructor(message: string, code: string = 'MESSAGE_PROCESSING_ERROR', originalError?: Error) {
    super(message, code, originalError);
    this.name = 'MessageProcessingError';
  }
}

// 队列连接错误
export class QueueConnectionError extends QueueError {
  constructor(message: string, originalError?: Error) {
    super(message, 'QUEUE_CONNECTION_ERROR', originalError);
    this.name = 'QueueConnectionError';
  }
}