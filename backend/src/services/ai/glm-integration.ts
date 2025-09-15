// GLM 集成主服务 - 协调所有GLM相关功能
import { GLMRequest, GLMResponse, GLMError } from '../config/glm.config';
import { GLMAPIClient, GLMAPIClientConfig } from './glm-client';
import { GLMRetryHandler, createGLMRetryHandler } from './retry-handler';
import { GLMConcurrencyController, createGLMConcurrencyController } from './concurrency-controller';
import { GLMRequestQueueManager, createGLMRequestQueueManager } from './request-queue-manager';
import { GLMMonitoringService, createGLMMonitoringService } from './monitoring-service';
import { db } from '../../db';
import { glmConfigs, users } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

export interface GLMIntegrationConfig {
  // 客户端配置
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeout?: number;
  
  // 并发控制配置
  maxConcurrency?: number;
  queueSizeLimit?: number;
  
  // 重试策略配置
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  
  // 监控配置
  enableMonitoring?: boolean;
  metricsInterval?: number;
}

export interface GLMProcessOptions {
  priority?: number;
  timeout?: number;
  retryImmediately?: boolean;
  skipQueue?: boolean;
}

export interface GLMProcessResult {
  success: boolean;
  response?: GLMResponse;
  error?: GLMError;
  processingTime: number;
  retryCount: number;
  queueId?: string;
  cost?: number;
}

export interface GLMBatchResult {
  results: GLMProcessResult[];
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalProcessingTime: number;
  totalCost: number;
  averageResponseTime: number;
}

export class GLMIntegrationService {
  private client: GLMAPIClient;
  private retryHandler: GLMRetryHandler;
  private concurrencyController: GLMConcurrencyController;
  private queueManager: GLMRequestQueueManager;
  private monitoringService: GLMMonitoringService;
  private config: GLMIntegrationConfig;
  private isInitialized: boolean = false;

  constructor(config: GLMIntegrationConfig) {
    this.config = config;
    this.initialize();
  }

  /**
   * 初始化服务
   */
  private async initialize(): Promise<void> {
    try {
      // 创建GLM客户端
      this.client = new GLMAPIClient({
        apiKey: this.config.apiKey,
        baseUrl: this.config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4',
        timeout: this.config.timeout || 30000,
        model: this.config.model || 'glm-4'
      });

      // 创建重试处理器
      this.retryHandler = createGLMRetryHandler({
        maxRetries: this.config.maxRetries || 3,
        baseDelay: this.config.baseDelay || 1000,
        maxDelay: this.config.maxDelay || 30000,
        backoffMultiplier: this.config.backoffMultiplier || 2,
        retryableErrors: [
          'timeout',
          'rate_limit',
          'network_error',
          'server_error'
        ]
      });

      // 创建并发控制器
      this.concurrencyController = createGLMConcurrencyController(
        this.client,
        {
          maxConcurrency: this.config.maxConcurrency || 1,
          timeout: this.config.timeout || 30000,
          queueSizeLimit: this.config.queueSizeLimit || 1000,
          priorityLevels: 5
        }
      );

      // 创建队列管理器
      this.queueManager = createGLMRequestQueueManager(
        this.concurrencyController,
        this.retryHandler
      );

      // 创建监控服务
      if (this.config.enableMonitoring !== false) {
        this.monitoringService = createGLMMonitoringService();
      }

      this.isInitialized = true;
      console.log('GLM Integration Service initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize GLM Integration Service:', error);
      throw error;
    }
  }

  /**
   * 处理单个GLM请求
   */
  async processRequest(
    request: GLMRequest,
    userId: number,
    options: GLMProcessOptions = {}
  ): Promise<GLMProcessResult> {
    if (!this.isInitialized) {
      throw new GLMError(
        'service_not_initialized',
        'GLM Integration Service is not initialized',
        undefined,
        new Date(),
        false
      );
    }

    const startTime = Date.now();
    
    try {
      // 获取或创建用户配置
      const configId = await this.getUserConfigId(userId);
      
      if (options.skipQueue) {
        // 直接处理请求（不使用队列）
        return await this.processDirectly(request, configId, options);
      } else {
        // 通过队列处理请求
        const queueId = await this.queueManager.enqueueRequest(
          userId,
          configId,
          request.requestId || this.generateRequestId(),
          request,
          options.priority || 0
        );

        return {
          success: true,
          queueId,
          processingTime: Date.now() - startTime,
          retryCount: 0
        };
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const glmError = this.normalizeError(error);

      return {
        success: false,
        error: glmError,
        processingTime,
        retryCount: 0
      };
    }
  }

  /**
   * 批量处理GLM请求
   */
  async processBatch(
    requests: Array<{
      request: GLMRequest;
      contentId: string;
      priority?: number;
    }>,
    userId: number,
    options: GLMProcessOptions = {}
  ): Promise<GLMBatchResult> {
    if (!this.isInitialized) {
      throw new GLMError(
        'service_not_initialized',
        'GLM Integration Service is not initialized',
        undefined,
        new Date(),
        false
      );
    }

    const startTime = Date.now();
    
    try {
      // 获取用户配置
      const configId = await this.getUserConfigId(userId);
      
      // 准备批量请求
      const batchRequests = requests.map(item => ({
        contentId: item.contentId,
        request: item.request,
        priority: item.priority || options.priority || 0
      }));

      // 添加到队列
      const queueIds = await this.queueManager.enqueueBatch(
        userId,
        configId,
        batchRequests
      );

      const processingTime = Date.now() - startTime;

      return {
        results: queueIds.map(queueId => ({
          success: true,
          queueId,
          processingTime: 0,
          retryCount: 0
        })),
        totalRequests: requests.length,
        successfulRequests: requests.length,
        failedRequests: 0,
        totalProcessingTime: processingTime,
        totalCost: 0,
        averageResponseTime: processingTime / requests.length
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const glmError = this.normalizeError(error);

      return {
        results: requests.map(() => ({
          success: false,
          error: glmError,
          processingTime: 0,
          retryCount: 0
        })),
        totalRequests: requests.length,
        successfulRequests: 0,
        failedRequests: requests.length,
        totalProcessingTime: processingTime,
        totalCost: 0,
        averageResponseTime: processingTime / requests.length
      };
    }
  }

  /**
   * 直接处理请求（不使用队列）
   */
  private async processDirectly(
    request: GLMRequest,
    configId: number,
    options: GLMProcessOptions
  ): Promise<GLMProcessResult> {
    const startTime = Date.now();
    
    try {
      // 获取GLM配置
      const config = await this.getGLMConfig(configId);
      if (!config) {
        throw new GLMError('config_not_found', 'GLM configuration not found');
      }

      // 创建客户端实例
      const client = new GLMAPIClient({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        timeout: options.timeout || config.timeout,
        model: request.model || config.model
      });

      // 执行带重试的请求
      const retryResult = await this.retryHandler.executeWithRetry(
        client,
        {
          ...request,
          maxTokens: config.maxTokens,
          temperature: config.temperature
        },
        config.maxRetries
      );

      const processingTime = Date.now() - startTime;

      if (retryResult.success && retryResult.response) {
        // 计算成本
        const cost = this.calculateCost(
          retryResult.response.usage.prompt_tokens,
          retryResult.response.usage.completion_tokens
        );

        return {
          success: true,
          response: retryResult.response,
          processingTime,
          retryCount: retryResult.attempts - 1,
          cost
        };
      } else {
        throw retryResult.error || new GLMError('processing_failed', 'Processing failed');
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const glmError = this.normalizeError(error);

      return {
        success: false,
        error: glmError,
        processingTime,
        retryCount: 0
      };
    }
  }

  /**
   * 获取用户配置ID
   */
  private async getUserConfigId(userId: number): Promise<number> {
    const config = await db
      .select({ id: glmConfigs.id })
      .from(glmConfigs)
      .where(and(
        eq(glmConfigs.userId, userId),
        eq(glmConfigs.isActive, true)
      ))
      .limit(1);

    if (config.length === 0) {
      throw new GLMError(
        'user_config_not_found',
        'No active GLM configuration found for user',
        { userId },
        new Date(),
        false
      );
    }

    return config[0].id;
  }

  /**
   * 获取GLM配置
   */
  private async getGLMConfig(configId: number) {
    const result = await db
      .select()
      .from(glmConfigs)
      .where(eq(glmConfigs.id, configId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * 计算成本
   */
  private calculateCost(promptTokens: number, completionTokens: number): number {
    const promptCost = (promptTokens / 1000) * 0.0001;
    const completionCost = (completionTokens / 1000) * 0.0002;
    return promptCost + completionCost;
  }

  /**
   * 标准化错误对象
   */
  private normalizeError(error: any): GLMError {
    if (error instanceof GLMError) {
      return error;
    }

    return new GLMError(
      'unknown_error',
      error instanceof Error ? error.message : 'Unknown error',
      { originalError: error },
      new Date(),
      false
    );
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `glm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus(userId?: number) {
    return this.queueManager.getQueueStatus(userId);
  }

  /**
   * 获取用户队列状态
   */
  async getUserQueueStatus(userId: number) {
    return this.queueManager.getUserQueueStatus(userId);
  }

  /**
   * 取消队列中的请求
   */
  async cancelRequest(queueId: string, userId: number): Promise<boolean> {
    return this.queueManager.cancelRequest(queueId, userId);
  }

  /**
   * 获取用户使用统计
   */
  async getUserUsageStats(userId: number, startDate?: Date, endDate?: Date) {
    if (!this.monitoringService) {
      throw new GLMError('monitoring_disabled', 'Monitoring service is not enabled');
    }
    return this.monitoringService.getUserUsageStats(userId, startDate, endDate);
  }

  /**
   * 获取系统统计
   */
  async getSystemStats(startDate?: Date, endDate?: Date) {
    if (!this.monitoringService) {
      throw new GLMError('monitoring_disabled', 'Monitoring service is not enabled');
    }
    return this.monitoringService.getSystemStats(startDate, endDate);
  }

  /**
   * 获取用户成本统计
   */
  async getUserCostStats(userId: number, startDate?: Date, endDate?: Date) {
    if (!this.monitoringService) {
      throw new GLMError('monitoring_disabled', 'Monitoring service is not enabled');
    }
    return this.monitoringService.getUserCostStats(userId, startDate, endDate);
  }

  /**
   * 生成用户使用报告
   */
  async generateUserUsageReport(userId: number) {
    if (!this.monitoringService) {
      throw new GLMError('monitoring_disabled', 'Monitoring service is not enabled');
    }
    return this.monitoringService.generateUserUsageReport(userId);
  }

  /**
   * 生成系统报告
   */
  async generateSystemReport(startDate?: Date, endDate?: Date) {
    if (!this.monitoringService) {
      throw new GLMError('monitoring_disabled', 'Monitoring service is not enabled');
    }
    return this.monitoringService.generateSystemReport(startDate, endDate);
  }

  /**
   * 获取当前监控指标
   */
  async getCurrentMetrics() {
    if (!this.monitoringService) {
      throw new GLMError('monitoring_disabled', 'Monitoring service is not enabled');
    }
    return this.monitoringService.getCurrentMetrics();
  }

  /**
   * 获取并发控制器状态
   */
  getConcurrencyStatus() {
    return this.concurrencyController.getMetrics();
  }

  /**
   * 获取重试处理器状态
   */
  getRetryStatus() {
    return this.retryHandler.getRetryStatistics();
  }

  /**
   * 更新配置
   */
  async updateConfig(newConfig: Partial<GLMIntegrationConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    // 更新客户端配置
    if (newConfig.apiKey || newConfig.baseUrl || newConfig.model || newConfig.timeout) {
      this.client.updateConfig({
        apiKey: newConfig.apiKey || this.config.apiKey,
        baseUrl: newConfig.baseUrl || this.config.baseUrl,
        timeout: newConfig.timeout || this.config.timeout,
        model: newConfig.model || this.config.model
      });
    }

    // 更新并发控制配置
    if (newConfig.maxConcurrency || newConfig.queueSizeLimit) {
      this.concurrencyController.updateConfig({
        maxConcurrency: newConfig.maxConcurrency || this.config.maxConcurrency,
        timeout: newConfig.timeout || this.config.timeout,
        queueSizeLimit: newConfig.queueSizeLimit || this.config.queueSizeLimit
      });
    }

    // 更新重试策略
    if (newConfig.maxRetries || newConfig.baseDelay || newConfig.maxDelay || newConfig.backoffMultiplier) {
      this.retryHandler.updateStrategy({
        maxRetries: newConfig.maxRetries || this.config.maxRetries,
        baseDelay: newConfig.baseDelay || this.config.baseDelay,
        maxDelay: newConfig.maxDelay || this.config.maxDelay,
        backoffMultiplier: newConfig.backoffMultiplier || this.config.backoffMultiplier
      });
    }

    console.log('GLM Integration Service configuration updated');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      client: boolean;
      retryHandler: boolean;
      concurrencyController: boolean;
      queueManager: boolean;
      monitoringService: boolean;
    };
    metrics?: any;
  }> {
    const components = {
      client: false,
      retryHandler: false,
      concurrencyController: false,
      queueManager: false,
      monitoringService: this.monitoringService !== undefined
    };

    try {
      // 检查客户端
      const clientHealth = await this.client.healthCheck();
      components.client = clientHealth.status === 'healthy';

      // 检查重试处理器
      const retryStats = this.retryHandler.getRetryStatistics();
      components.retryHandler = retryStats.successRate > 0.8;

      // 检查并发控制器
      const concurrencyMetrics = this.concurrencyController.getMetrics();
      components.concurrencyController = concurrencyMetrics.currentConcurrency >= 0;

      // 检查队列管理器
      const queueMetrics = await this.queueManager.getQueueStatus();
      components.queueManager = queueMetrics.successRate > 0.7;

      // 获取监控指标
      let metrics;
      if (this.monitoringService) {
        metrics = await this.monitoringService.getCurrentMetrics();
      }

      // 确定整体状态
      const healthyComponents = Object.values(components).filter(Boolean).length;
      const totalComponents = Object.keys(components).length;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyComponents === totalComponents) {
        status = 'healthy';
      } else if (healthyComponents >= totalComponents * 0.7) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return { status, components, metrics };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        components,
        metrics: undefined
      };
    }
  }

  /**
   * 关闭服务
   */
  async shutdown(): Promise<void> {
    try {
      // 关闭队列管理器
      if (this.queueManager) {
        await this.queueManager.shutdown();
      }

      // 关闭并发控制器
      if (this.concurrencyController) {
        await this.concurrencyController.shutdown();
      }

      // 关闭监控服务
      if (this.monitoringService) {
        await this.monitoringService.shutdown();
      }

      // 关闭客户端
      if (this.client) {
        await this.client.close();
      }

      this.isInitialized = false;
      console.log('GLM Integration Service shutdown complete');
      
    } catch (error) {
      console.error('Error during GLM Integration Service shutdown:', error);
      throw error;
    }
  }
}

// 创建GLM集成服务的工厂函数
export function createGLMIntegrationService(
  config: GLMIntegrationConfig
): GLMIntegrationService {
  return new GLMIntegrationService(config);
}