// test/queue.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueueProducerService } from '../src/services/queue/producer';
import { QueueConsumerService } from '../src/services/queue/consumer';
import { QueueMonitorService } from '../src/services/queue/monitor';
import { QueueMessage } from '../src/services/queue/types';

// Mock Cloudflare Queue
const createMockQueue = () => ({
  send: vi.fn(),
  sendBatch: vi.fn(),
  batch: vi.fn(),
  info: vi.fn()
});

describe('Queue Processing Pipeline', () => {
  let mockQueue: any;
  let producer: QueueProducerService;
  let consumer: QueueConsumerService;
  let monitor: QueueMonitorService;

  beforeEach(() => {
    mockQueue = createMockQueue();
    producer = new QueueProducerService(mockQueue, {
      maxBatchSize: 10,
      maxWaitTimeMs: 5000,
      maxRetries: 3,
      deadLetterQueue: 'TEST_DLQ'
    });
    consumer = new QueueConsumerService(mockQueue);
    monitor = new QueueMonitorService(mockQueue);
    
    vi.clearAllMocks();
  });

  describe('QueueProducerService', () => {
    it('should send a single message successfully', async () => {
      const testMessage: QueueMessage = {
        id: 'test-message-1',
        type: 'rss_fetch',
        payload: {
          sourceId: '1',
          userId: '1',
          url: 'https://example.com/rss.xml',
          title: 'Test RSS'
        },
        timestamp: new Date(),
        attempts: 0,
        maxRetries: 3
      };

      mockQueue.send.mockResolvedValue(undefined);

      await producer.send(testMessage);

      expect(mockQueue.send).toHaveBeenCalledWith({
        id: testMessage.id,
        type: testMessage.type,
        payload: testMessage.payload,
        timestamp: testMessage.timestamp.toISOString(),
        attempts: testMessage.attempts,
        maxRetries: testMessage.maxRetries
      });
    });

    it('should send batch of messages successfully', async () => {
      const messages: QueueMessage[] = [
        {
          id: 'msg-1',
          type: 'rss_fetch',
          payload: {
            sourceId: '1',
            userId: '1',
            url: 'https://example.com/rss.xml'
          },
          timestamp: new Date(),
          attempts: 0,
          maxRetries: 3
        },
        {
          id: 'msg-2',
          type: 'ai_process',
          payload: {
            sourceId: '2',
            userId: '1',
            content: 'Test content'
          },
          timestamp: new Date(),
          attempts: 0,
          maxRetries: 3
        }
      ];

      mockQueue.sendBatch.mockResolvedValue(undefined);

      await producer.sendBatch(messages);

      expect(mockQueue.sendBatch).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'msg-1' }),
        expect.objectContaining({ id: 'msg-2' })
      ]);
    });

    it('should validate message format', async () => {
      const invalidMessage = {
        id: '',
        type: 'invalid_type',
        payload: {
          sourceId: '',
          userId: ''
        },
        timestamp: new Date(),
        attempts: 0,
        maxRetries: 3
      } as QueueMessage;

      await expect(producer.send(invalidMessage)).rejects.toThrow('消息ID不能为空');
    });

    it('should create RSS fetch message correctly', () => {
      const message = QueueProducerService.createRssFetchMessage(
        '1',
        '1',
        'https://example.com/rss.xml',
        'Test RSS',
        { key: 'value' }
      );

      expect(message.type).toBe('rss_fetch');
      expect(message.payload.sourceId).toBe('1');
      expect(message.payload.url).toBe('https://example.com/rss.xml');
      expect(message.payload.title).toBe('Test RSS');
      expect(message.payload.metadata).toEqual({ key: 'value' });
      expect(message.attempts).toBe(0);
      expect(message.maxRetries).toBe(3);
    });

    it('should create AI process message correctly', () => {
      const message = QueueProducerService.createAiProcessMessage(
        '1',
        '1',
        'Test content',
        { key: 'value' }
      );

      expect(message.type).toBe('ai_process');
      expect(message.payload.sourceId).toBe('1');
      expect(message.payload.content).toBe('Test content');
      expect(message.payload.metadata).toEqual({ key: 'value' });
      expect(message.attempts).toBe(0);
      expect(message.maxRetries).toBe(3);
    });
  });

  describe('QueueConsumerService', () => {
    it('should process messages with handler', async () => {
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      const mockMessage = {
        id: 'test-message',
        body: {
          id: 'test-message',
          type: 'rss_fetch',
          payload: {
            sourceId: '1',
            userId: '1',
            url: 'https://example.com/rss.xml'
          },
          timestamp: new Date().toISOString(),
          attempts: 0,
          maxRetries: 3
        }
      };

      const mockBatch = {
        messages: [mockMessage]
      };

      mockQueue.batch.mockImplementation((handler) => {
        handler(mockBatch);
      });

      await consumer.process(mockHandler);

      expect(mockQueue.batch).toHaveBeenCalled();
    });

    it('should handle message processing errors', async () => {
      const mockHandler = vi.fn().mockRejectedValue(new Error('Processing failed'));
      const mockMessage = {
        id: 'test-message',
        body: {
          id: 'test-message',
          type: 'rss_fetch',
          payload: {
            sourceId: '1',
            userId: '1',
            url: 'https://example.com/rss.xml'
          },
          timestamp: new Date().toISOString(),
          attempts: 0,
          maxRetries: 3
        }
      };

      const mockBatch = {
        messages: [mockMessage]
      };

      mockQueue.batch.mockImplementation((handler) => {
        handler(mockBatch);
      });

      // 不应该抛出错误，应该由队列自动处理重试
      await consumer.process(mockHandler);
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should check retry limits', async () => {
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      const mockMessage = {
        id: 'test-message',
        body: {
          id: 'test-message',
          type: 'rss_fetch',
          payload: {
            sourceId: '1',
            userId: '1',
            url: 'https://example.com/rss.xml'
          },
          timestamp: new Date().toISOString(),
          attempts: 4, // 超过最大重试次数
          maxRetries: 3
        }
      };

      const mockBatch = {
        messages: [mockMessage]
      };

      mockQueue.batch.mockImplementation((handler) => {
        handler(mockBatch);
      });

      await consumer.process(mockHandler);

      // 不应该调用处理函数，因为重试次数已超限
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should track processing messages', () => {
      expect(consumer.getProcessingCount()).toBe(0);
      expect(consumer.isProcessingMessages()).toBe(false);
      expect(consumer.getProcessingMessageIds()).toEqual([]);
    });
  });

  describe('QueueMonitorService', () => {
    it('should get queue stats', async () => {
      mockQueue.info.mockResolvedValue({
        pending: 5,
        processing: 2,
        failed: 1,
        deadLetter: 0,
        averageProcessingTime: 1500
      });

      const stats = await monitor.getQueueStats('TEST_QUEUE');

      expect(stats.queueName).toBe('TEST_QUEUE');
      expect(stats.pendingMessages).toBe(5);
      expect(stats.processingMessages).toBe(2);
      expect(stats.failedMessages).toBe(1);
      expect(stats.deadLetterMessages).toBe(0);
      expect(stats.averageProcessingTime).toBe(1500);
    });

    it('should handle queue info errors gracefully', async () => {
      mockQueue.info.mockRejectedValue(new Error('Queue info unavailable'));

      const stats = await monitor.getQueueStats('TEST_QUEUE');

      expect(stats.queueName).toBe('TEST_QUEUE');
      expect(stats.pendingMessages).toBe(0);
      expect(stats.processingMessages).toBe(0);
      expect(stats.failedMessages).toBe(0);
      expect(stats.deadLetterMessages).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
    });

    it('should get message history', async () => {
      const history = await monitor.getMessageHistory('test-message-id');

      expect(Array.isArray(history)).toBe(true);
      // 模拟实现应该返回一些默认历史记录
    });

    it('should get failed messages', async () => {
      const failedMessages = await monitor.getFailedMessages();

      expect(Array.isArray(failedMessages)).toBe(true);
    });

    it('should check queue health', async () => {
      mockQueue.info.mockResolvedValue({
        pending: 50,
        processing: 5,
        failed: 0,
        deadLetter: 0,
        averageProcessingTime: 25000
      });

      const health = await monitor.checkQueueHealth('TEST_QUEUE');

      expect(health.healthy).toBe(true);
      expect(health.issues).toEqual([]);
    });

    it('should detect queue health issues', async () => {
      mockQueue.info.mockResolvedValue({
        pending: 150,
        processing: 20,
        failed: 15,
        deadLetter: 8,
        averageProcessingTime: 45000
      });

      const health = await monitor.checkQueueHealth('TEST_QUEUE');

      expect(health.healthy).toBe(false);
      expect(health.issues.length).toBeGreaterThan(0);
      expect(health.issues).toContain('队列积压消息过多: 150');
    });

    it('should clear cache', () => {
      expect(() => monitor.clearCache()).not.toThrow();
    });

    it('should get cache stats', () => {
      const cacheStats = monitor.getCacheStats();

      expect(cacheStats).toHaveProperty('statsCacheSize');
      expect(cacheStats).toHaveProperty('historyCacheSize');
      expect(typeof cacheStats.statsCacheSize).toBe('number');
      expect(typeof cacheStats.historyCacheSize).toBe('number');
    });
  });

  describe('End-to-end Pipeline', () => {
    it('should work as complete pipeline', async () => {
      const testMessage = QueueProducerService.createRssFetchMessage(
        '1',
        '1',
        'https://example.com/rss.xml'
      );

      // Producer sends message
      mockQueue.send.mockResolvedValue(undefined);
      await producer.send(testMessage);
      expect(mockQueue.send).toHaveBeenCalled();

      // Consumer processes message
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      const mockMessage = {
        id: testMessage.id,
        body: {
          id: testMessage.id,
          type: testMessage.type,
          payload: testMessage.payload,
          timestamp: testMessage.timestamp.toISOString(),
          attempts: testMessage.attempts,
          maxRetries: testMessage.maxRetries
        }
      };

      const mockBatch = {
        messages: [mockMessage]
      };

      mockQueue.batch.mockImplementation((handler) => {
        handler(mockBatch);
      });

      await consumer.process(mockHandler);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: testMessage.id,
          type: testMessage.type,
          payload: testMessage.payload
        })
      );

      // Monitor checks health
      mockQueue.info.mockResolvedValue({
        pending: 0,
        processing: 0,
        failed: 0,
        deadLetter: 0,
        averageProcessingTime: 1000
      });

      const health = await monitor.checkQueueHealth('TEST_QUEUE');
      expect(health.healthy).toBe(true);
    });
  });
});