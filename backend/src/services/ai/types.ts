// src/services/ai/types.ts

// AI处理配置
export interface AIProcessingConfig {
  id: string;
  userId: string;
  language: 'zh-CN' | 'en-US' | 'auto';
  style: 'concise' | 'detailed' | 'academic';
  maxTokens: number;
  includeKeywords: boolean;
  includeSummary: boolean;
  includeAnalysis: boolean;
  includeCategories: boolean;
  templateId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// AI模型选择
export interface AIModelSelection {
  provider: 'cloudflare' | 'zhipu' | 'openai';
  model: string;
  name: string;
  description: string;
  category: 'fast' | 'balanced' | 'accurate';
  maxTokens: number;
  costPer1kTokens: number;
  available: boolean;
}

// 处理结果
export interface ProcessingResult {
  id: string;
  sourceId: string;
  userId: string;
  originalUrl: string;
  title: string;
  content: string;
  summary: string;
  keywords: string[];
  categories: string[];
  sentiment: string;
  importance: number;
  readability: number;
  markdownContent?: string;
  processingTime: number;
  aiTokensUsed: number;
  aiProvider: string;
  aiModel: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// 批量处理结果
export interface BatchProcessingResult {
  processed: number;
  failed: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  results: ProcessingResult[];
}

// AI服务接口
export interface AIProcessingService {
  analyzeContent(params: {
    content: string;
    title: string;
    config: AIProcessingConfig;
  }): Promise<ProcessingResult>;
  
  generateMarkdown(result: ProcessingResult): Promise<string>;
  
  validateConfig(config: AIProcessingConfig): Promise<boolean>;
  
  checkAvailability(): Promise<{ available: boolean; message: string }>;
  
  processBatch(params: {
    items: Array<{
      content: string;
      title: string;
      config: AIProcessingConfig;
    }>;
  }): Promise<BatchProcessingResult>;
}

// 配置服务接口
export interface AIConfigService {
  getUserConfig(userId: string): Promise<AIProcessingConfig>;
  updateUserConfig(userId: string, config: Partial<AIProcessingConfig>): Promise<void>;
  createUserConfig(userId: string, defaultConfig?: Partial<AIProcessingConfig>): Promise<AIProcessingConfig>;
  getUserModelSelection(userId: string): Promise<AIModelSelection>;
  updateUserModelSelection(userId: string, selection: AIModelSelection): Promise<void>;
  getAvailableModels(): Promise<AIModelSelection[]>;
}

// 模板相关接口
export interface MarkdownTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: 'news' | 'blog' | 'research' | 'custom';
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 模板服务接口
export interface TemplateService {
  getAvailableTemplates(userId: string): Promise<MarkdownTemplate[]>;
  getTemplateById(templateId: string): Promise<MarkdownTemplate | null>;
  createCustomTemplate(template: Omit<MarkdownTemplate, 'id' | 'createdAt'>): Promise<MarkdownTemplate>;
  updateTemplate(templateId: string, updates: Partial<MarkdownTemplate>): Promise<void>;
  deleteTemplate(templateId: string): Promise<void>;
  setDefaultTemplate(userId: string, templateId: string): Promise<void>;
}

// 处理历史接口
export interface ProcessingHistory {
  id: string;
  processingId: string;
  userId: string;
  action: 'started' | 'completed' | 'failed' | 'retried';
  details: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// 处理历史服务接口
export interface ProcessingHistoryService {
  recordHistory(history: Omit<ProcessingHistory, 'id'>): Promise<void>;
  getProcessingHistory(userId: string, limit?: number): Promise<ProcessingHistory[]>;
  getProcessingDetails(processingId: string): Promise<ProcessingHistory[]>;
}

// 错误类型
export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class ConfigValidationError extends AIServiceError {
  constructor(message: string, originalError?: Error) {
    super(message, 'CONFIG_VALIDATION_ERROR', originalError);
    this.name = 'ConfigValidationError';
  }
}

export class ProcessingError extends AIServiceError {
  constructor(message: string, originalError?: Error) {
    super(message, 'PROCESSING_ERROR', originalError);
    this.name = 'ProcessingError';
  }
}

export class QuotaExceededError extends AIServiceError {
  constructor(message: string, usage: number, limit: number) {
    super(message, 'QUOTA_EXCEEDED_ERROR');
    this.name = 'QuotaExceededError';
    this.usage = usage;
    this.limit = limit;
  }

  public readonly usage: number;
  public readonly limit: number;
}

// 处理状态枚举
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

// AI提供商枚举
export type AIProvider = 'cloudflare' | 'zhipu' | 'openai';

// 处理模式枚举
export type ProcessingMode = 'single' | 'batch' | 'scheduled';

// 导出配置接口
export interface ExportConfig {
  format: 'markdown' | 'json' | 'pdf';
  includeMetadata: boolean;
  includeProcessingInfo: boolean;
  customTemplate?: string;
}

// 导出服务接口
export interface ExportService {
  exportResults(results: ProcessingResult[], config: ExportConfig): Promise<{
    success: boolean;
    downloadUrl?: string;
    filename?: string;
    error?: string;
  }>;
  
  getExportHistory(userId: string): Promise<Array<{
    id: string;
    format: string;
    filename: string;
    createdAt: Date;
    downloadCount: number;
  }>>;
  
  deleteExport(exportId: string): Promise<void>;
}