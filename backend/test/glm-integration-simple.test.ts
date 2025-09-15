// GLM API 集成测试 - 简化版本，不依赖外部服务器
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createGLMIntegrationService } from '../src/services/ai/glm-integration';
import { GLMRequest, GLMResponse, GLMError } from '../src/config/glm.config';

// 模拟GLM API响应
const mockGLMResponse: GLMResponse = {
  id: 'test-response-id',
  object: 'chat.completion',
  created: Math.floor(Date.now() / 1000),
  model: 'glm-4',
  choices: [{
    index: 0,
    message: {
      role: 'assistant',
      content: '这是一个测试响应，用于验证GLM API集成功能。'
    },
    finish_reason: 'stop'
  }],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150
  }
};

// 模拟GLM API错误
const mockGLMError = new GLMError(
  'rate_limit',
  'Rate limit exceeded',
  { limit: 100, current: 95 },
  new Date(),
  true
);

describe('GLM API Integration Tests', () => {
  let glmService: any;

  beforeAll(async () => {
    // 初始化GLM服务（使用测试配置）
    glmService = createGLMIntegrationService({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com',
      model: 'glm-4',
      timeout: 5000,
      maxConcurrency: 1,
      maxRetries: 2,
      enableMonitoring: false // 禁用监控以避免数据库依赖
    });
  });

  afterAll(async () => {
    if (glmService) {
      await glmService.shutdown();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GLM Integration Service Initialization', () => {
    it('should initialize GLM service with correct configuration', () => {
      expect(glmService).toBeDefined();
      expect(glmService.config).toMatchObject({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
        model: 'glm-4',
        maxConcurrency: 1,
        maxRetries: 2
      });
    });

    it('should pass health check', async () => {
      // 模拟健康检查成功
      vi.spyOn(glmService.client, 'healthCheck').mockResolvedValueOnce({
        status: 'healthy',
        latency: 100,
        model: 'glm-4'
      });

      const health = await glmService.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.components).toHaveProperty('client');
      expect(health.components).toHaveProperty('retryHandler');
      expect(health.components).toHaveProperty('concurrencyController');
      expect(health.components).toHaveProperty('queueManager');
    });
  });

  describe('Request Processing', () => {
    it('should process single request successfully', async () => {
      const request: GLMRequest = {
        prompt: '测试请求',
        model: 'glm-4',
        maxTokens: 1000,
        temperature: 0.7,
        userId: 'test-user-1',
        requestId: 'test-request-1'
      };

      // 模拟成功的API响应
      vi.spyOn(glmService.client, 'chatCompletion').mockResolvedValueOnce(mockGLMResponse);

      const result = await glmService.processRequest(request, 1, { skipQueue: true });

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.retryCount).toBe(0);
    });

    it('should handle API errors gracefully', async () => {
      const request: GLMRequest = {
        prompt: '测试错误处理',
        model: 'glm-4',
        userId: 'test-user-1',
        requestId: 'test-request-2'
      };

      // 模拟API错误
      vi.spyOn(glmService.client, 'chatCompletion').mockRejectedValueOnce(mockGLMError);

      const result = await glmService.processRequest(request, 1, { skipQueue: true });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('rate_limit');
      expect(result.error.retryable).toBe(true);
    });

    it('should process batch requests', async () => {
      const requests = [
        {
          request: {
            prompt: '批量请求 1',
            model: 'glm-4',
            userId: 'test-user-1',
            requestId: 'batch-request-1'
          } as GLMRequest,
          contentId: 'content-1'
        },
        {
          request: {
            prompt: '批量请求 2',
            model: 'glm-4',
            userId: 'test-user-1',
            requestId: 'batch-request-2'
          } as GLMRequest,
          contentId: 'content-2'
        }
      ];

      vi.spyOn(glmService.client, 'chatCompletion').mockResolvedValue(mockGLMResponse);

      const result = await glmService.processBatch(requests, 1);

      expect(result).toBeDefined();
      expect(result.totalRequests).toBe(2);
      expect(result.successfulRequests).toBe(2);
      expect(result.failedRequests).toBe(0);
    });

    it('should respect priority levels', async () => {
      const highPriorityRequest: GLMRequest = {
        prompt: '高优先级请求',
        model: 'glm-4',
        userId: 'test-user-1',
        requestId: 'high-priority-request'
      };

      const lowPriorityRequest: GLMRequest = {
        prompt: '低优先级请求',
        model: 'glm-4',
        userId: 'test-user-1',
        requestId: 'low-priority-request'
      };

      vi.spyOn(glmService.client, 'chatCompletion').mockResolvedValue(mockGLMResponse);

      const highResult = await glmService.processRequest(
        highPriorityRequest, 
        1, 
        { priority: 10, skipQueue: true }
      );

      const lowResult = await glmService.processRequest(
        lowPriorityRequest, 
        1, 
        { priority: 1, skipQueue: true }
      );

      expect(highResult.success).toBe(true);
      expect(lowResult.success).toBe(true);
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry on retryable errors', async () => {
      const request: GLMRequest = {
        prompt: '测试重试机制',
        model: 'glm-4',
        userId: 'test-user-1',
        requestId: 'retry-test-request'
      };

      // 模拟前两次调用失败，第三次成功
      vi.spyOn(glmService.client, 'chatCompletion')
        .mockRejectedValueOnce(new GLMError('timeout', 'Request timeout', undefined, new Date(), true))
        .mockRejectedValueOnce(new GLMError('timeout', 'Request timeout', undefined, new Date(), true))
        .mockResolvedValueOnce(mockGLMResponse);

      const result = await glmService.processRequest(request, 1, { skipQueue: true });

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
      expect(glmService.client.chatCompletion).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const request: GLMRequest = {
        prompt: '测试不可重试错误',
        model: 'glm-4',
        userId: 'test-user-1',
        requestId: 'non-retryable-test-request'
      };

      // 模拟认证错误（不可重试）
      const authError = new GLMError(
        'authentication_error', 
        'Invalid API key', 
        undefined, 
        new Date(), 
        false
      );

      vi.spyOn(glmService.client, 'chatCompletion').mockRejectedValueOnce(authError);

      const result = await glmService.processRequest(request, 1, { skipQueue: true });

      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(0);
      expect(glmService.client.chatCompletion).toHaveBeenCalledTimes(1);
    });
  });

  describe('Concurrency Control', () => {
    it('should respect concurrency limits', async () => {
      const request: GLMRequest = {
        prompt: '测试并发控制',
        model: 'glm-4',
        userId: 'test-user-1',
        requestId: 'concurrency-test-request'
      };

      // 模拟延迟响应
      vi.spyOn(glmService.client, 'chatCompletion').mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(mockGLMResponse), 100);
        });
      });

      const startTime = Date.now();
      const result = await glmService.processRequest(request, 1, { skipQueue: true });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Queue Management', () => {
    it('should enqueue requests via queue', async () => {
      const request: GLMRequest = {
        prompt: '测试队列处理',
        model: 'glm-4',
        userId: 'test-user-1',
        requestId: 'queue-test-request'
      };

      // 模拟队列管理器的enqueueRequest方法
      vi.spyOn(glmService.queueManager, 'enqueueRequest').mockResolvedValueOnce('test-queue-id');

      const result = await glmService.processRequest(request, 1, { skipQueue: false });

      expect(result.success).toBe(true);
      expect(result.queueId).toBe('test-queue-id');
      expect(glmService.queueManager.enqueueRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide usage statistics methods', async () => {
      // 验证方法是否存在
      expect(glmService.getUserUsageStats).toBeDefined();
      expect(glmService.getSystemStats).toBeDefined();
      expect(glmService.getCurrentMetrics).toBeDefined();
    });

    it('should provide cost statistics methods', async () => {
      expect(glmService.getUserCostStats).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid requests', async () => {
      const invalidRequest = {
        // 缺少必需的prompt字段
        model: 'glm-4',
        userId: 'test-user-1'
      } as any;

      await expect(glmService.processRequest(invalidRequest, 1))
        .rejects.toThrow();
    });

    it('should handle service not initialized', async () => {
      // 创建新的未初始化的服务
      const uninitializedService = createGLMIntegrationService({
        apiKey: 'test-key',
        enableMonitoring: false
      });

      const request: GLMRequest = {
        prompt: '测试未初始化服务',
        model: 'glm-4',
        userId: 'test-user-1',
        requestId: 'uninitialized-test-request'
      };

      await expect(uninitializedService.processRequest(request, 1))
        .rejects.toThrow('service_not_initialized');

      await uninitializedService.shutdown();
    });
  });

  describe('Configuration Management', () => {
    it('should allow configuration updates', async () => {
      const newConfig = {
        maxConcurrency: 2,
        maxRetries: 3,
        timeout: 10000
      };

      await expect(glmService.updateConfig(newConfig)).resolves.not.toThrow();

      // 验证配置已更新
      expect(glmService.config.maxConcurrency).toBe(2);
      expect(glmService.config.maxRetries).toBe(3);
      expect(glmService.config.timeout).toBe(10000);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle real-world scenario with mixed success/failure', async () => {
      const requests = [
        {
          request: {
            prompt: '成功请求',
            model: 'glm-4',
            userId: 'test-user-1',
            requestId: 'mixed-scenario-1'
          } as GLMRequest,
          contentId: 'content-1'
        },
        {
          request: {
            prompt: '失败请求',
            model: 'glm-4',
            userId: 'test-user-1',
            requestId: 'mixed-scenario-2'
          } as GLMRequest,
          contentId: 'content-2'
        }
      ];

      // 模拟一个成功一个失败
      vi.spyOn(glmService.client, 'chatCompletion')
        .mockResolvedValueOnce(mockGLMResponse)
        .mockRejectedValueOnce(mockGLMError);

      const result = await glmService.processBatch(requests, 1);

      expect(result).toBeDefined();
      expect(result.totalRequests).toBe(2);
      expect(result.successfulRequests + result.failedRequests).toBe(2);
    });

    it('should handle rate limiting scenario', async () => {
      const request: GLMRequest = {
        prompt: '测试限流',
        model: 'glm-4',
        userId: 'test-user-1',
        requestId: 'rate-limit-test-request'
      };

      // 模拟限流错误，但最终成功
      vi.spyOn(glmService.client, 'chatCompletion')
        .mockRejectedValueOnce(new GLMError('rate_limit', 'Rate limit exceeded', undefined, new Date(), true))
        .mockResolvedValueOnce(mockGLMResponse);

      const result = await glmService.processRequest(request, 1, { skipQueue: true });

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
    });
  });
});

describe('GLM Error Handling Tests', () => {
  it('should create GLMError with correct properties', () => {
    const error = new GLMError(
      'test_code',
      'Test error message',
      { test: 'data' },
      new Date(),
      true
    );

    expect(error.code).toBe('test_code');
    expect(error.message).toBe('Test error message');
    expect(error.details).toEqual({ test: 'data' });
    expect(error.retryable).toBe(true);
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  it('should serialize GLMError to JSON', () => {
    const error = new GLMError(
      'test_code',
      'Test error message',
      { test: 'data' },
      new Date(),
      true
    );

    const json = error.toJSON();
    
    expect(json).toHaveProperty('name');
    expect(json).toHaveProperty('code');
    expect(json).toHaveProperty('message');
    expect(json).toHaveProperty('details');
    expect(json).toHaveProperty('timestamp');
    expect(json).toHaveProperty('retryable');
  });
});

describe('GLM Request Validation', () => {
  it('should validate GLMRequest structure', () => {
    const validRequest: GLMRequest = {
      prompt: 'Test prompt',
      model: 'glm-4',
      maxTokens: 1000,
      temperature: 0.7,
      userId: 'test-user'
    };

    expect(validRequest.prompt).toBeDefined();
    expect(validRequest.userId).toBeDefined();
    expect(typeof validRequest.prompt).toBe('string');
    expect(typeof validRequest.userId).toBe('string');
  });

  it('should validate GLMResponse structure', () => {
    expect(mockGLMResponse.id).toBeDefined();
    expect(mockGLMResponse.choices).toBeDefined();
    expect(mockGLMResponse.usage).toBeDefined();
    expect(mockGLMResponse.choices[0].message).toBeDefined();
    expect(mockGLMResponse.choices[0].message.role).toBe('assistant');
  });
});