// GLM重试处理器 - 智能重试和错误处理机制
import { GLMRequest, GLMResponse, GLMError, GLMRetryStrategy, GLM_ERROR_CODES } from '../config/glm.config';
import { GLMAPIClient } from './glm-client';

export interface RetryContext {
  request: GLMRequest;
  attempt: number;
  maxRetries: number;
  lastError?: GLMError;
  delay: number;
  startTime: number;
}

export interface RetryResult {
  success: boolean;
  response?: GLMResponse;
  error?: GLMError;
  attempts: number;
  totalTime: number;
  retryHistory: RetryAttempt[];
}

export interface RetryAttempt {
  attempt: number;
  timestamp: number;
  error?: GLMError;
  delay: number;
  success: boolean;
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

export class GLMRetryHandler {
  private strategy: GLMRetryStrategy;
  private circuitBreaker: CircuitBreakerState;
  private retryHistory: Map<string, RetryAttempt[]>;
  private failureThreshold: number;
  private recoveryTimeout: number;

  constructor(
    strategy: GLMRetryStrategy,
    failureThreshold: number = 5,
    recoveryTimeout: number = 60000
  ) {
    this.strategy = strategy;
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
    this.circuitBreaker = {
      isOpen: false,
      failureCount: 0
    };
    this.retryHistory = new Map();
  }

  /**
   * 执行带重试的请求
   */
  async executeWithRetry(
    client: GLMAPIClient,
    request: GLMRequest,
    maxRetries?: number
  ): Promise<RetryResult> {
    const startTime = Date.now();
    const maxAttempts = (maxRetries || this.strategy.maxRetries) + 1;
    const retryHistory: RetryAttempt[] = [];
    const requestId = this.generateRequestId();

    // 检查断路器状态
    if (this.isCircuitBreakerOpen()) {
      return {
        success: false,
        error: new GLMError(
          'circuit_breaker_open',
          'Circuit breaker is open - requests temporarily blocked',
          { nextAttemptTime: this.circuitBreaker.nextAttemptTime },
          new Date(),
          false
        ),
        attempts: 0,
        totalTime: 0,
        retryHistory
      };
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const attemptStartTime = Date.now();
      let result: RetryResult;

      try {
        const response = await this.executeSingleAttempt(client, request);
        
        const attemptResult: RetryAttempt = {
          attempt,
          timestamp: attemptStartTime,
          success: true,
          delay: 0
        };
        
        retryHistory.push(attemptResult);

        // 成功，重置断路器
        this.resetCircuitBreaker();

        result = {
          success: true,
          response,
          attempts: attempt,
          totalTime: Date.now() - startTime,
          retryHistory
        };

        return result;
      } catch (error) {
        const glmError = this.normalizeError(error);
        const attemptResult: RetryAttempt = {
          attempt,
          timestamp: attemptStartTime,
          error: glmError,
          delay: 0,
          success: false
        };
        
        retryHistory.push(attemptResult);

        // 更新断路器状态
        this.updateCircuitBreaker(glmError);

        // 检查是否应该重试
        if (!this.shouldRetry(glmError, attempt, maxAttempts)) {
          result = {
            success: false,
            error: glmError,
            attempts: attempt,
            totalTime: Date.now() - startTime,
            retryHistory
          };

          return result;
        }

        // 计算重试延迟
        const delay = this.calculateDelay(attempt);
        
        // 等待重试
        await this.sleep(delay);

        // 更新重试历史中的延迟
        attemptResult.delay = delay;
      }
    }

    // 理论上不应该到达这里
    return {
      success: false,
      error: new GLMError(
        'max_retries_exceeded',
        'Maximum retry attempts exceeded',
        { maxAttempts: maxAttempts },
        new Date(),
        false
      ),
      attempts: maxAttempts,
      totalTime: Date.now() - startTime,
      retryHistory
    };
  }

  /**
   * 执行单次尝试
   */
  private async executeSingleAttempt(
    client: GLMAPIClient,
    request: GLMRequest
  ): Promise<GLMResponse> {
    return await client.chatCompletion(request);
  }

  /**
   * 判断是否应该重试
   */
  shouldRetry(error: GLMError, attempt: number, maxAttempts: number): boolean {
    // 超过最大重试次数
    if (attempt >= maxAttempts) {
      return false;
    }

    // 检查错误类型是否可重试
    if (!this.strategy.retryableErrors.includes(error.code)) {
      return false;
    }

    // 特殊错误类型的处理
    switch (error.code) {
      case GLM_ERROR_CODES.AUTHENTICATION_ERROR:
        return false; // 认证错误不重试
      case GLM_ERROR_CODES.PERMISSION_ERROR:
        return false; // 权限错误不重试
      case GLM_ERROR_CODES.INVALID_REQUEST:
        return false; // 无效请求不重试
      case GLM_ERROR_CODES.CONTENT_FILTERED:
        return false; // 内容过滤不重试
      case GLM_ERROR_CODES.QUOTA_EXCEEDED:
        return attempt < 2; // 配额限制只重试2次
      case GLM_ERROR_CODES.RATE_LIMIT:
        return true; // 限流错误总是重试
      case GLM_ERROR_CODES.TIMEOUT:
        return attempt < 3; // 超时错误重试3次
      case GLM_ERROR_CODES.NETWORK_ERROR:
        return true; // 网络错误总是重试
      case GLM_ERROR_CODES.SERVER_ERROR:
        return attempt < 3; // 服务器错误重试3次
      default:
        return true; // 其他错误默认重试
    }
  }

  /**
   * 计算重试延迟
   */
  calculateDelay(attempt: number): number {
    const delay = this.strategy.baseDelay * 
                  Math.pow(this.strategy.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.strategy.maxDelay);
  }

  /**
   * 标准化错误对象
   */
  private normalizeError(error: any): GLMError {
    if (error instanceof GLMError) {
      return error;
    }

    if (error.name === 'AbortError') {
      return new GLMError(
        GLM_ERROR_CODES.TIMEOUT,
        'Request timeout',
        { originalError: error.message },
        new Date(),
        true
      );
    }

    if (error.status === 429) {
      return new GLMError(
        GLM_ERROR_CODES.RATE_LIMIT,
        'Rate limit exceeded',
        { originalError: error.message },
        new Date(),
        true
      );
    }

    if (error.status >= 500) {
      return new GLMError(
        GLM_ERROR_CODES.SERVER_ERROR,
        'Server error',
        { originalError: error.message },
        new Date(),
        true
      );
    }

    return new GLMError(
      GLM_ERROR_CODES.UNKNOWN_ERROR,
      error.message || 'Unknown error',
      { originalError: error },
      new Date(),
      true
    );
  }

  /**
   * 断路器相关方法
   */
  private isCircuitBreakerOpen(): boolean {
    if (!this.circuitBreaker.isOpen) {
      return false;
    }

    // 检查是否到了恢复时间
    if (this.circuitBreaker.nextAttemptTime && Date.now() > this.circuitBreaker.nextAttemptTime) {
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failureCount = 0;
      return false;
    }

    return true;
  }

  private updateCircuitBreaker(error: GLMError): void {
    if (!error.retryable) {
      // 不可重试的错误直接打开断路器
      this.circuitBreaker.isOpen = true;
      this.circuitBreaker.failureCount = this.failureThreshold;
      this.circuitBreaker.lastFailureTime = Date.now();
      this.circuitBreaker.nextAttemptTime = Date.now() + this.recoveryTimeout;
    } else {
      // 可重试的错误增加失败计数
      this.circuitBreaker.failureCount++;
      
      if (this.circuitBreaker.failureCount >= this.failureThreshold) {
        this.circuitBreaker.isOpen = true;
        this.circuitBreaker.lastFailureTime = Date.now();
        this.circuitBreaker.nextAttemptTime = Date.now() + this.recoveryTimeout;
      }
    }
  }

  private resetCircuitBreaker(): void {
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.failureCount = 0;
    this.circuitBreaker.lastFailureTime = undefined;
    this.circuitBreaker.nextAttemptTime = undefined;
  }

  /**
   * 获取断路器状态
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  /**
   * 手动重置断路器
   */
  resetCircuitBreakerManually(): void {
    this.resetCircuitBreaker();
  }

  /**
   * 更新重试策略
   */
  updateStrategy(newStrategy: Partial<GLMRetryStrategy>): void {
    this.strategy = { ...this.strategy, ...newStrategy };
  }

  /**
   * 获取重试统计
   */
  getRetryStatistics(): {
    totalRetries: number;
    successRate: number;
    averageRetries: number;
    errorDistribution: Record<string, number>;
  } {
    const allAttempts = Array.from(this.retryHistory.values()).flat();
    const totalRequests = this.retryHistory.size;
    const successfulRequests = allAttempts.filter(a => a.success).length;
    
    const errorDistribution: Record<string, number> = {};
    allAttempts.forEach(attempt => {
      if (attempt.error) {
        errorDistribution[attempt.error.code] = (errorDistribution[attempt.error.code] || 0) + 1;
      }
    });

    return {
      totalRetries: allAttempts.filter(a => !a.success).length,
      successRate: totalRequests > 0 ? successfulRequests / totalRequests : 0,
      averageRetries: totalRequests > 0 ? allAttempts.length / totalRequests : 0,
      errorDistribution
    };
  }

  /**
   * 清理历史记录
   */
  clearHistory(olderThanMs: number = 3600000): void {
    const cutoff = Date.now() - olderThanMs;
    
    for (const [requestId, attempts] of this.retryHistory.entries()) {
      if (attempts[0]?.timestamp < cutoff) {
        this.retryHistory.delete(requestId);
      }
    }
  }

  /**
   * 休眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 重试策略工厂函数
export function createDefaultRetryStrategy(): GLMRetryStrategy {
  return {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      GLM_ERROR_CODES.TIMEOUT,
      GLM_ERROR_CODES.RATE_LIMIT,
      GLM_ERROR_CODES.NETWORK_ERROR,
      GLM_ERROR_CODES.SERVER_ERROR
    ]
  };
}

export function createAggressiveRetryStrategy(): GLMRetryStrategy {
  return {
    maxRetries: 5,
    baseDelay: 500,
    maxDelay: 60000,
    backoffMultiplier: 1.5,
    retryableErrors: [
      GLM_ERROR_CODES.TIMEOUT,
      GLM_ERROR_CODES.RATE_LIMIT,
      GLM_ERROR_CODES.NETWORK_ERROR,
      GLM_ERROR_CODES.SERVER_ERROR,
      GLM_ERROR_CODES.NETWORK_ERROR,
      GLM_ERROR_CODES.QUOTA_EXCEEDED
    ]
  };
}

export function createConservativeRetryStrategy(): GLMRetryStrategy {
  return {
    maxRetries: 2,
    baseDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2,
    retryableErrors: [
      GLM_ERROR_CODES.TIMEOUT,
      GLM_ERROR_CODES.NETWORK_ERROR,
      GLM_ERROR_CODES.SERVER_ERROR
    ]
  };
}

// 创建重试处理器的工厂函数
export function createGLMRetryHandler(
  strategy?: GLMRetryStrategy,
  failureThreshold?: number,
  recoveryTimeout?: number
): GLMRetryHandler {
  const retryStrategy = strategy || createDefaultRetryStrategy();
  return new GLMRetryHandler(retryStrategy, failureThreshold, recoveryTimeout);
}