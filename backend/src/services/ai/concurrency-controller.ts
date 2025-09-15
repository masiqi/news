// 并发控制器 - 基于Semaphore模式的并发控制实现
import { GLMRequest, GLMResponse, GLMError, GLMConcurrencyConfig } from '../config/glm.config';
import { GLMAPIClient } from './glm-client';

export interface QueuedRequest {
  id: string;
  request: GLMRequest;
  priority: number;
  resolve: (value: GLMResponse) => void;
  reject: (reason: any) => void;
  timestamp: number;
  timeout?: number;
  timeoutId?: NodeJS.Timeout;
}

export interface ConcurrencyMetrics {
  currentConcurrency: number;
  queueLength: number;
  totalProcessed: number;
  totalFailed: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  peakConcurrency: number;
  startTime: number;
}

export class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];
  private metrics: ConcurrencyMetrics;

  constructor(permits: number) {
    this.permits = permits;
    this.metrics = {
      currentConcurrency: 0,
      queueLength: 0,
      totalProcessed: 0,
      totalFailed: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0,
      peakConcurrency: 0,
      startTime: Date.now()
    };
  }

  /**
   * 获取信号量许可
   */
  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        this.metrics.currentConcurrency++;
        this.metrics.peakConcurrency = Math.max(
          this.metrics.peakConcurrency,
          this.metrics.currentConcurrency
        );
        
        const release = () => {
          this.permits++;
          this.metrics.currentConcurrency--;
          this.processQueue();
        };
        
        resolve(release);
      } else {
        this.queue.push(() => {
          this.permits--;
          this.metrics.currentConcurrency++;
          this.metrics.peakConcurrency = Math.max(
            this.metrics.peakConcurrency,
            this.metrics.currentConcurrency
          );
          
          const release = () => {
            this.permits++;
            this.metrics.currentConcurrency--;
            this.processQueue();
          };
          
          resolve(release);
        });
      }
    });
  }

  /**
   * 处理队列中的等待请求
   */
  private processQueue(): void {
    if (this.queue.length > 0 && this.permits > 0) {
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  /**
   * 获取当前指标
   */
  getMetrics(): ConcurrencyMetrics {
    return {
      ...this.metrics,
      queueLength: this.queue.length
    };
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = {
      currentConcurrency: this.permits === 0 ? 0 : this.metrics.currentConcurrency,
      queueLength: this.queue.length,
      totalProcessed: 0,
      totalFailed: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0,
      peakConcurrency: 0,
      startTime: Date.now()
    };
  }
}

export class GLMConcurrencyController {
  private semaphore: Semaphore;
  private client: GLMAPIClient;
  private config: GLMConcurrencyConfig;
  private requestQueue: PriorityQueue<QueuedRequest>;
  private activeRequests: Map<string, Promise<GLMResponse>>;
  private processing = false;
  private metricsInterval?: NodeJS.Timeout;

  constructor(client: GLMAPIClient, config: GLMConcurrencyConfig) {
    this.client = client;
    this.config = config;
    this.semaphore = new Semaphore(config.maxConcurrency);
    this.requestQueue = new PriorityQueue<QueuedRequest>(
      (a, b) => b.priority - a.priority // 优先级高的先处理
    );
    this.activeRequests = new Map();

    // 启动队列处理器
    this.startQueueProcessor();

    // 启动指标收集
    this.startMetricsCollection();
  }

  /**
   * 执行GLM请求（带并发控制）
   */
  async execute(request: GLMRequest): Promise<GLMResponse> {
    const queuedRequest: QueuedRequest = {
      id: this.generateRequestId(),
      request,
      priority: request.priority || 0,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      // 检查队列长度限制
      if (this.requestQueue.size() >= this.config.queueSizeLimit) {
        reject(new Error('Request queue is full'));
        return;
      }

      // 设置超时
      if (this.config.timeout) {
        queuedRequest.timeout = this.config.timeout;
        queuedRequest.timeoutId = setTimeout(() => {
          this.requestQueue.remove(queuedRequest);
          reject(new Error('Request timeout in queue'));
        }, this.config.timeout);
      }

      queuedRequest.resolve = resolve;
      queuedRequest.reject = reject;

      this.requestQueue.enqueue(queuedRequest);
    });
  }

  /**
   * 批量执行请求
   */
  async executeBatch(requests: GLMRequest[]): Promise<GLMResponse[]> {
    const results: GLMResponse[] = [];
    
    for (const request of requests) {
      try {
        const result = await this.execute(request);
        results.push(result);
      } catch (error) {
        // 创建错误响应
        results.push({
          id: this.generateRequestId(),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: request.model || 'glm-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            },
            finish_reason: 'error'
          }],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          }
        });
      }
    }

    return results;
  }

  /**
   * 启动队列处理器
   */
  private startQueueProcessor(): void {
    const processQueue = async () => {
      if (this.processing || this.requestQueue.isEmpty()) {
        setTimeout(processQueue, 100); // 检查间隔
        return;
      }

      this.processing = true;

      while (!this.requestQueue.isEmpty()) {
        const queuedRequest = this.requestQueue.dequeue();
        if (!queuedRequest) break;

        // 清除超时定时器
        if (queuedRequest.timeoutId) {
          clearTimeout(queuedRequest.timeoutId);
        }

        // 执行请求
        this.processRequest(queuedRequest);
      }

      this.processing = false;
      setTimeout(processQueue, 100); // 继续检查队列
    };

    processQueue();
  }

  /**
   * 处理单个请求
   */
  private async processRequest(queuedRequest: QueuedRequest): Promise<void> {
    const requestId = queuedRequest.id;
    const startTime = Date.now();
    const waitTime = startTime - queuedRequest.timestamp;

    try {
      // 获取信号量许可
      const release = await this.semaphore.acquire();

      const requestPromise = this.executeWithRetry(queuedRequest.request);
      this.activeRequests.set(requestId, requestPromise);

      const response = await requestPromise;

      // 计算处理时间
      const processingTime = Date.now() - startTime;

      // 更新指标
      this.updateMetrics(waitTime, processingTime, true);

      queuedRequest.resolve(response);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // 更新指标
      this.updateMetrics(waitTime, processingTime, false);

      queuedRequest.reject(error);
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * 带重试的请求执行
   */
  private async executeWithRetry(request: GLMRequest): Promise<GLMResponse> {
    const maxRetries = request.maxRetries || 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.client.chatCompletion(request);
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          throw error;
        }

        // 检查是否可重试
        if (error instanceof GLMError && !error.retryable) {
          throw error;
        }

        // 指数退避
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * 更新指标
   */
  private updateMetrics(waitTime: number, processingTime: number, success: boolean): void {
    const metrics = this.semaphore.getMetrics();
    
    if (success) {
      metrics.totalProcessed++;
      
      // 更新平均等待时间
      metrics.averageWaitTime = (
        metrics.averageWaitTime * (metrics.totalProcessed - 1) + waitTime
      ) / metrics.totalProcessed;
      
      // 更新平均处理时间
      metrics.averageProcessingTime = (
        metrics.averageProcessingTime * (metrics.totalProcessed - 1) + processingTime
      ) / metrics.totalProcessed;
    } else {
      metrics.totalFailed++;
    }
  }

  /**
   * 启动指标收集
   */
  private startMetricsCollection(): void {
    // 定期记录指标到数据库或监控系统
    this.metricsInterval = setInterval(() => {
      const metrics = this.getMetrics();
      
      // 这里可以添加指标上报逻辑
      console.log('GLM Concurrency Metrics:', metrics);
    }, 60000); // 每分钟收集一次
  }

  /**
   * 获取当前指标
   */
  getMetrics(): ConcurrencyMetrics {
    const semaphoreMetrics = this.semaphore.getMetrics();
    
    return {
      ...semaphoreMetrics,
      queueLength: this.requestQueue.size()
    };
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const metrics = this.getMetrics();
    
    return {
      pending: this.requestQueue.size(),
      processing: metrics.currentConcurrency,
      completed: metrics.totalProcessed,
      failed: metrics.totalFailed
    };
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    while (!this.requestQueue.isEmpty()) {
      const request = this.requestQueue.dequeue();
      if (request && request.timeoutId) {
        clearTimeout(request.timeoutId);
        request.reject(new Error('Queue cleared'));
      }
    }
  }

  /**
   * 取消特定请求
   */
  cancelRequest(requestId: string): boolean {
    // 首先检查队列中是否有该请求
    const removed = this.requestQueue.remove(req => req.id === requestId);
    
    if (removed && removed.timeoutId) {
      clearTimeout(removed.timeoutId);
      removed.reject(new Error('Request cancelled'));
      return true;
    }

    return false;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<GLMConcurrencyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // 如果并发数发生变化，重新创建信号量
    if (newConfig.maxConcurrency !== undefined) {
      const currentMetrics = this.semaphore.getMetrics();
      this.semaphore = new Semaphore(newConfig.maxConcurrency);
      
      // 恢复指标
      this.semaphore.getMetrics().currentConcurrency = currentMetrics.currentConcurrency;
      this.semaphore.getMetrics().totalProcessed = currentMetrics.totalProcessed;
      this.semaphore.getMetrics().totalFailed = currentMetrics.totalFailed;
    }
  }

  /**
   * 关闭控制器
   */
  async shutdown(): Promise<void> {
    // 停止指标收集
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // 清空队列
    this.clearQueue();

    // 等待正在处理的请求完成
    const activePromises = Array.from(this.activeRequests.values());
    await Promise.allSettled(activePromises);

    console.log('GLM Concurrency Controller shutdown complete');
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 休眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 优先级队列实现
export class PriorityQueue<T> {
  private items: T[] = [];
  private comparator: (a: T, b: T) => number;

  constructor(comparator: (a: T, b: T) => number) {
    this.comparator = comparator;
  }

  enqueue(item: T): void {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  dequeue(): T | undefined {
    if (this.isEmpty()) return undefined;
    
    const item = this.items[0];
    const last = this.items.pop();
    
    if (this.items.length > 0 && last !== undefined) {
      this.items[0] = last;
      this.sinkDown(0);
    }
    
    return item;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  remove(predicate: (item: T) => boolean): T | undefined {
    const index = this.items.findIndex(predicate);
    if (index === -1) return undefined;
    
    const item = this.items[index];
    const last = this.items.pop();
    
    if (index < this.items.length && last !== undefined) {
      this.items[index] = last;
      this.bubbleUp(index);
      this.sinkDown(index);
    }
    
    return item;
  }

  private bubbleUp(index: number): void {
    const item = this.items[index];
    
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.items[parentIndex];
      
      if (this.comparator(item, parent) <= 0) break;
      
      this.items[index] = parent;
      this.items[parentIndex] = item;
      index = parentIndex;
    }
  }

  private sinkDown(index: number): void {
    const item = this.items[index];
    const length = this.items.length;
    
    while (true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let swapIndex = index;
      
      if (leftChildIndex < length) {
        const leftChild = this.items[leftChildIndex];
        if (this.comparator(leftChild, item) > 0) {
          swapIndex = leftChildIndex;
        }
      }
      
      if (rightChildIndex < length) {
        const rightChild = this.items[rightChildIndex];
        if (
          this.comparator(rightChild, this.items[swapIndex]) > 0
        ) {
          swapIndex = rightChildIndex;
        }
      }
      
      if (swapIndex === index) break;
      
      this.items[index] = this.items[swapIndex];
      this.items[swapIndex] = item;
      index = swapIndex;
    }
  }
}

// 创建并发控制器的工厂函数
export function createGLMConcurrencyController(
  client: GLMAPIClient,
  config: GLMConcurrencyConfig
): GLMConcurrencyController {
  return new GLMConcurrencyController(client, config);
}