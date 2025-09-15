// GLM API客户端 - 负责与智谱清言API的交互
import { GLMRequest, GLMResponse, GLMError, GLM_MODELS } from '../config/glm.config';

export interface GLMAPIClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  model?: string;
  maxRetries?: number;
}

export class GLMAPIClient {
  private config: GLMAPIClientConfig;
  private requestHeaders: Record<string, string>;

  constructor(config: GLMAPIClientConfig) {
    this.config = {
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      timeout: 30000,
      model: 'glm-4',
      maxRetries: 3,
      ...config
    };

    this.requestHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'User-Agent': 'AI-News-Platform/1.0'
    };
  }

  /**
   * 发送聊天完成请求
   */
  async chatCompletion(request: GLMRequest): Promise<GLMResponse> {
    const startTime = Date.now();
    const requestId = request.requestId || this.generateRequestId();

    try {
      const response = await this.makeRequest('chat/completions', {
        model: request.model || this.config.model,
        messages: [
          {
            role: 'user',
            content: request.prompt
          }
        ],
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        stream: false
      });

      const responseTime = Date.now() - startTime;

      return {
        ...response,
        created: Math.floor(startTime / 1000)
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      throw this.handleError(error, requestId, responseTime);
    }
  }

  /**
   * 发送异步聊天完成请求（支持长时间运行的任务）
   */
  async asyncChatCompletion(request: GLMRequest): Promise<{ taskId: string }> {
    const requestId = request.requestId || this.generateRequestId();

    try {
      const response = await this.makeRequest('async/chat/completions', {
        model: request.model || this.config.model,
        messages: [
          {
            role: 'user',
            content: request.prompt
          }
        ],
        max_tokens: request.maxTokens,
        temperature: request.temperature
      });

      return {
        taskId: response.id
      };
    } catch (error) {
      throw this.handleError(error, requestId);
    }
  }

  /**
   * 查询异步任务状态
   */
  async getTaskStatus(taskId: string): Promise<GLMResponse | { status: string; progress?: number }> {
    try {
      const response = await this.makeRequest(`async/chat/completions/${taskId}`);
      return response;
    } catch (error) {
      throw this.handleError(error, taskId);
    }
  }

  /**
   * 获取模型列表
   */
  async getModels(): Promise<Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>> {
    try {
      const response = await this.makeRequest('models');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'models');
    }
  }

  /**
   * 获取token使用情况
   */
  async getUsage(startDate?: string, endDate?: string): Promise<{
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    requests: number;
    cost: number;
  }> {
    try {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await this.makeRequest('usage', params);
      return {
        total_tokens: response.total_tokens || 0,
        prompt_tokens: response.prompt_tokens || 0,
        completion_tokens: response.completion_tokens || 0,
        requests: response.requests || 0,
        cost: response.cost || 0
      };
    } catch (error) {
      throw this.handleError(error, 'usage');
    }
  }

  /**
   * 内容安全检查
   */
  async contentCheck(text: string): Promise<{
    is_safe: boolean;
    categories: string[];
    confidence: number;
  }> {
    try {
      const response = await this.makeRequest('content/check', {
        text,
        type: 'text'
      });

      return {
        is_safe: response.is_safe,
        categories: response.categories || [],
        confidence: response.confidence || 0
      };
    } catch (error) {
      throw this.handleError(error, 'content-check');
    }
  }

  /**
   * 批量处理请求
   */
  async batchChatCompletion(requests: GLMRequest[]): Promise<GLMResponse[]> {
    const results: GLMResponse[] = [];
    
    // 串行处理以确保并发控制
    for (const request of requests) {
      try {
        const response = await this.chatCompletion(request);
        results.push(response);
      } catch (error) {
        // 为失败的请求创建错误响应
        results.push({
          id: this.generateRequestId(),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: request.model || this.config.model,
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
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency: number;
    model: string;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      await this.getModels();
      const latency = Date.now() - startTime;

      return {
        status: 'healthy',
        latency,
        model: this.config.model || 'glm-4'
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        status: 'unhealthy',
        latency,
        model: this.config.model || 'glm-4',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 发送HTTP请求
   */
  private async makeRequest(endpoint: string, data?: any): Promise<any> {
    const url = `${this.config.baseUrl}/${endpoint.replace(/^\//, '')}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.requestHeaders,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new GLMError(
          errorData.error?.code || 'http_error',
          errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`,
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new GLMError(
          'timeout',
          `Request timeout after ${this.config.timeout}ms`,
          { url, timeout: this.config.timeout }
        );
      }
      
      if (error instanceof GLMError) {
        throw error;
      }
      
      throw new GLMError(
        'network_error',
        error instanceof Error ? error.message : 'Network error',
        { url, originalError: error.message }
      );
    }
  }

  /**
   * 错误处理
   */
  private handleError(error: any, requestId: string, responseTime?: number): GLMError {
    console.error(`GLM API Error [${requestId}]:`, error);

    if (error instanceof GLMError) {
      return error;
    }

    // 处理不同的错误类型
    let code = 'unknown_error';
    let message = error.message || 'Unknown error';
    let retryable = true;

    if (error.status === 401) {
      code = 'authentication_error';
      message = 'Invalid API key';
      retryable = false;
    } else if (error.status === 403) {
      code = 'permission_error';
      message = 'Insufficient permissions';
      retryable = false;
    } else if (error.status === 429) {
      code = 'rate_limit';
      message = 'Rate limit exceeded';
      retryable = true;
    } else if (error.status >= 500) {
      code = 'server_error';
      message = 'Server error';
      retryable = true;
    } else if (error.status === 400) {
      code = 'invalid_request';
      message = 'Invalid request';
      retryable = false;
    } else if (error.code === 'content_filtered') {
      code = 'content_filtered';
      message = 'Content filtered by safety system';
      retryable = false;
    } else if (error.code === 'quota_exceeded') {
      code = 'quota_exceeded';
      message = 'API quota exceeded';
      retryable = false;
    }

    return new GLMError(
      code,
      message,
      {
        requestId,
        responseTime,
        originalError: error
      },
      new Date(),
      retryable
    );
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `glm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<GLMAPIClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.apiKey) {
      this.requestHeaders['Authorization'] = `Bearer ${newConfig.apiKey}`;
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): GLMAPIClientConfig {
    return { ...this.config };
  }

  /**
   * 关闭客户端连接
   */
  async close(): Promise<void> {
    // 清理资源（如果需要）
    console.log('GLM API client closed');
  }
}

// GLM错误类
export class GLMError extends Error {
  public code: string;
  public details: any;
  public timestamp: Date;
  public retryable: boolean;

  constructor(
    code: string,
    message: string,
    details: any = null,
    timestamp: Date = new Date(),
    retryable: boolean = true
  ) {
    super(message);
    this.name = 'GLMError';
    this.code = code;
    this.details = details;
    this.timestamp = timestamp;
    this.retryable = retryable;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      retryable: this.retryable
    };
  }
}

// 创建客户端实例的工厂函数
export function createGLMAPIClient(config: GLMAPIClientConfig): GLMAPIClient {
  return new GLMAPIClient(config);
}

// 默认客户端实例（使用环境变量配置）
export let defaultGLMAPIClient: GLMAPIClient | null = null;

export function getDefaultGLMAPIClient(): GLMAPIClient {
  if (!defaultGLMAPIClient) {
    const apiKey = process.env.GLM_API_KEY;
    if (!apiKey) {
      throw new Error('GLM_API_KEY environment variable is required');
    }

    defaultGLMAPIClient = createGLMAPIClient({
      apiKey,
      baseUrl: process.env.GLM_BASE_URL,
      timeout: parseInt(process.env.GLM_TIMEOUT || '30000'),
      model: process.env.GLM_MODEL || 'glm-4'
    });
  }

  return defaultGLMAPIClient;
}