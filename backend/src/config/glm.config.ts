// GLM API集成配置
export interface GLMConfig {
  id: string;
  userId: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  maxRetries: number;
  isActive: boolean;
  maxConcurrency: number;
  dailyLimit?: number;
  monthlyLimit?: number;
  createdAt: Date;
  updatedAt: Date;
}

// GLM API请求参数
export interface GLMRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  userId?: string;
  contentId?: string;
  priority?: number;
  requestId?: string;
  maxRetries?: number;
}

// GLM API响应
export interface GLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 重试策略配置
export interface GLMRetryStrategy {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// 并发控制配置
export interface GLMConcurrencyConfig {
  maxConcurrency: number;
  timeout: number;
  queueSizeLimit: number;
  priorityLevels: number;
}

// 监控指标
export interface GLMMetrics {
  currentConcurrency: number;
  queueLength: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  errorRate: number;
  totalTokensUsed: number;
  totalCost: number;
}

// 成本计算配置
export interface GLMCostConfig {
  model: string;
  promptTokenPrice: number; // 每1000个token的价格
  completionTokenPrice: number; // 每1000个token的价格
  currency: string;
}

// 支持的GLM模型
export const GLM_MODELS = {
  'glm-4': {
    maxTokens: 8192,
    cost: { prompt: 0.0001, completion: 0.0002 } // 每1000 token价格
  },
  'glm-4-air': {
    maxTokens: 8192,
    cost: { prompt: 0.00005, completion: 0.0001 }
  },
  'glm-4-airx': {
    maxTokens: 32768,
    cost: { prompt: 0.0001, completion: 0.0002 }
  },
  'glm-4-long': {
    maxTokens: 32768,
    cost: { prompt: 0.0005, completion: 0.001 }
  },
  'glm-3-turbo': {
    maxTokens: 128000,
    cost: { prompt: 0.00005, completion: 0.0001 }
  }
} as const;

// 默认配置
export const DEFAULT_GLM_CONFIG: Partial<GLMConfig> = {
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  model: 'glm-4',
  maxTokens: 2000,
  temperature: 0.7,
  timeout: 30000,
  maxRetries: 3,
  isActive: true,
  maxConcurrency: 1,
  monthlyLimit: 3000
};

// 默认重试策略
export const DEFAULT_RETRY_STRATEGY: GLMRetryStrategy = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'timeout',
    'rate_limit',
    'network_error',
    'server_error',
    'connection_error'
  ]
};

// 默认并发控制配置
export const DEFAULT_CONCURRENCY_CONFIG: GLMConcurrencyConfig = {
  maxConcurrency: 1,
  timeout: 30000,
  queueSizeLimit: 1000,
  priorityLevels: 5
};

// 错误类型定义
export interface GLMError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  retryable: boolean;
}

// 支持的错误代码
export const GLM_ERROR_CODES = {
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  NETWORK_ERROR: 'network_error',
  SERVER_ERROR: 'server_error',
  AUTHENTICATION_ERROR: 'authentication_error',
  PERMISSION_ERROR: 'permission_error',
  INVALID_REQUEST: 'invalid_request',
  CONTENT_FILTERED: 'content_filtered',
  QUOTA_EXCEEDED: 'quota_exceeded',
  MODEL_NOT_AVAILABLE: 'model_not_available',
  UNKNOWN_ERROR: 'unknown_error'
} as const;

// 环境变量配置
export function getGLMConfigFromEnv(): Partial<GLMConfig> {
  const config: Partial<GLMConfig> = {};
  
  if (process.env.GLM_API_KEY) {
    config.apiKey = process.env.GLM_API_KEY;
  }
  
  if (process.env.GLM_BASE_URL) {
    config.baseUrl = process.env.GLM_BASE_URL;
  }
  
  if (process.env.GLM_MODEL) {
    config.model = process.env.GLM_MODEL;
  }
  
  if (process.env.GLM_MAX_TOKENS) {
    config.maxTokens = parseInt(process.env.GLM_MAX_TOKENS);
  }
  
  if (process.env.GLM_TEMPERATURE) {
    config.temperature = parseFloat(process.env.GLM_TEMPERATURE);
  }
  
  if (process.env.GLM_TIMEOUT) {
    config.timeout = parseInt(process.env.GLM_TIMEOUT);
  }
  
  if (process.env.GLM_MAX_RETRIES) {
    config.maxRetries = parseInt(process.env.GLM_MAX_RETRIES);
  }
  
  if (process.env.GLM_MAX_CONCURRENCY) {
    config.maxConcurrency = parseInt(process.env.GLM_MAX_CONCURRENCY);
  }
  
  if (process.env.GLM_DAILY_LIMIT) {
    config.dailyLimit = parseInt(process.env.GLM_DAILY_LIMIT);
  }
  
  if (process.env.GLM_MONTHLY_LIMIT) {
    config.monthlyLimit = parseInt(process.env.GLM_MONTHLY_LIMIT);
  }
  
  return config;
}

// 配置验证函数
export function validateGLMConfig(config: Partial<GLMConfig>): config is GLMConfig {
  const requiredFields = ['id', 'userId', 'name', 'apiKey', 'baseUrl', 'model'];
  
  for (const field of requiredFields) {
    if (!config[field as keyof GLMConfig]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // 验证数值范围
  if (config.maxTokens && (config.maxTokens < 1 || config.maxTokens > 128000)) {
    throw new Error('maxTokens must be between 1 and 128000');
  }
  
  if (config.temperature && (config.temperature < 0 || config.temperature > 2)) {
    throw new Error('temperature must be between 0 and 2');
  }
  
  if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
    throw new Error('timeout must be between 1000 and 300000ms');
  }
  
  if (config.maxRetries && (config.maxRetries < 0 || config.maxRetries > 10)) {
    throw new Error('maxRetries must be between 0 and 10');
  }
  
  if (config.maxConcurrency && (config.maxConcurrency < 1 || config.maxConcurrency > 10)) {
    throw new Error('maxConcurrency must be between 1 and 10');
  }
  
  // 验证模型支持
  if (config.model && !GLM_MODELS[config.model as keyof typeof GLM_MODELS]) {
    throw new Error(`Unsupported model: ${config.model}`);
  }
  
  return true;
}

// 成本计算函数
export function calculateGLMCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const modelConfig = GLM_MODELS[model as keyof typeof GLM_MODELS];
  if (!modelConfig) {
    throw new Error(`Unsupported model: ${model}`);
  }
  
  const promptCost = (promptTokens / 1000) * modelConfig.cost.prompt;
  const completionCost = (completionTokens / 1000) * modelConfig.cost.completion;
  
  return promptCost + completionCost;
}

// 估算token数量
export function estimateTokens(text: string): number {
  // 简单的token估算：平均每个英文单词约1.3个token，中文字符约1.5个token
  const englishWords = text.match(/[a-zA-Z]+/g)?.length || 0;
  const chineseChars = text.match(/[\u4e00-\u9fff]/g)?.length || 0;
  const otherChars = text.length - englishWords - chineseChars;
  
  return Math.ceil(englishWords * 1.3 + chineseChars * 1.5 + otherChars * 0.5);
}

// 导出所有类型和配置
export type {
  GLMConfig,
  GLMRequest,
  GLMResponse,
  GLMRetryStrategy,
  GLMConcurrencyConfig,
  GLMMetrics,
  GLMCostConfig,
  GLMError
};