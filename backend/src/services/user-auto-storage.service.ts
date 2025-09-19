// 用户自动存储设置服务
// 管理用户的markdown自动存储偏好设置

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, gte, count, desc } from 'drizzle-orm';
import { userAutoStorageConfigs, userStorageLogs, userStorageStats } from '../db/schema';

// 用户自动存储设置接口
export interface UserAutoStorageConfig {
  id?: number;
  userId: number;
  enabled: boolean;
  storagePath: string;
  filenamePattern: string;
  maxFileSize: number;
  maxFilesPerDay: number;
  includeMetadata: boolean;
  fileFormat: 'standard' | 'academic' | 'concise';
  createdAt?: Date;
  updatedAt?: Date;
}

// 默认配置
const DEFAULT_CONFIG: Omit<UserAutoStorageConfig, 'userId' | 'id' | 'createdAt' | 'updatedAt'> = {
  enabled: true,
  storagePath: 'notes',
  filenamePattern: '{title}_{id}_{date}',
  maxFileSize: 1024 * 1024, // 1MB
  maxFilesPerDay: 100,
  includeMetadata: true,
  fileFormat: 'standard'
};

export class UserAutoStorageService {
  private db: any;

  constructor(db: any) {
    this.db = drizzle(db);
  }

  /**
   * 获取用户自动存储设置
   */
  async getUserConfig(userId: number): Promise<UserAutoStorageConfig> {
    try {
      // 查询数据库中的配置
      const config = await this.db
        .select()
        .from(userAutoStorageConfigs)
        .where(eq(userAutoStorageConfigs.userId, userId))
        .get();

      if (config) {
        return {
          id: config.id,
          userId: config.userId,
          enabled: config.enabled,
          storagePath: config.storagePath,
          filenamePattern: config.filenamePattern,
          maxFileSize: config.maxFileSize,
          maxFilesPerDay: config.maxFilesPerDay,
          includeMetadata: config.includeMetadata,
          fileFormat: config.fileFormat,
          createdAt: new Date(config.createdAt),
          updatedAt: new Date(config.updatedAt)
        };
      }

      // 如果没有配置，创建默认配置
      return await this.createDefaultConfig(userId);
    } catch (error) {
      console.error(`获取用户${userId}自动存储设置失败:`, error);
      // 返回默认配置
      return {
        userId,
        ...DEFAULT_CONFIG,
        id: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  }

  /**
   * 创建用户默认配置
   */
  async createDefaultConfig(userId: number): Promise<UserAutoStorageConfig> {
    try {
      const config = await this.db
        .insert(userAutoStorageConfigs)
        .values({
          userId,
          ...DEFAULT_CONFIG,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()
        .get();

      console.log(`[SUCCESS] 为用户${userId}创建默认自动存储配置`);
      
      return {
        id: config.id,
        userId: config.userId,
        enabled: config.enabled,
        storagePath: config.storagePath,
        filenamePattern: config.filenamePattern,
        maxFileSize: config.maxFileSize,
        maxFilesPerDay: config.maxFilesPerDay,
        includeMetadata: config.includeMetadata,
        fileFormat: config.fileFormat,
        createdAt: new Date(config.createdAt),
        updatedAt: new Date(config.updatedAt)
      };
    } catch (error) {
      console.error(`创建用户${userId}默认配置失败:`, error);
      throw error;
    }
  }

  /**
   * 更新用户配置
   */
  async updateConfig(userId: number, updates: Partial<UserAutoStorageConfig>): Promise<UserAutoStorageConfig> {
    try {
      const updatedConfig = await this.db
        .update(userAutoStorageConfigs)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(userAutoStorageConfigs.userId, userId))
        .returning()
        .get();

      console.log(`[SUCCESS] 更新用户${userId}自动存储配置:`, updates);
      
      return {
        id: updatedConfig.id,
        userId: updatedConfig.userId,
        enabled: updatedConfig.enabled,
        storagePath: updatedConfig.storagePath,
        filenamePattern: updatedConfig.filenamePattern,
        maxFileSize: updatedConfig.maxFileSize,
        maxFilesPerDay: updatedConfig.maxFilesPerDay,
        includeMetadata: updatedConfig.includeMetadata,
        fileFormat: updatedConfig.fileFormat,
        createdAt: new Date(updatedConfig.createdAt),
        updatedAt: new Date(updatedConfig.updatedAt)
      };
    } catch (error) {
      console.error(`更新用户${userId}配置失败:`, error);
      throw error;
    }
  }

  /**
   * 检查用户是否启用了自动存储
   */
  async isAutoStorageEnabled(userId: number): Promise<boolean> {
    try {
      const config = await this.getUserConfig(userId);
      return config.enabled;
    } catch (error) {
      console.error(`检查用户${userId}自动存储状态失败:`, error);
      return false;
    }
  }

  /**
   * 检查今日存储配额
   */
  async checkDailyQuota(userId: number): Promise<{ withinLimit: boolean; usedCount: number }> {
    try {
      const config = await this.getUserConfig(userId);
      
      // 获取今日的存储数量
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayLogs = await this.db
        .select({ count: count() })
        .from(userStorageLogs)
        .where(
          and(
            eq(userStorageLogs.userId, userId),
            eq(userStorageLogs.status, 'success'),
            gte(userStorageLogs.createdAt, today)
          )
        )
        .get();
      
      const usedCount = todayLogs?.count || 0;
      
      return {
        withinLimit: usedCount < config.maxFilesPerDay,
        usedCount
      };
    } catch (error) {
      console.error(`检查用户${userId}每日配额失败:`, error);
      return { withinLimit: false, usedCount: 0 };
    }
  }

  /**
   * 记录存储日志
   */
  async logStorage(params: {
    userId: number;
    sourceId: number;
    entryId: number;
    filePath: string;
    fileSize: number;
    status: 'success' | 'failed';
    error?: string;
    processingTime: number;
  }): Promise<void> {
    try {
      await this.db
        .insert(userStorageLogs)
        .values({
          userId: params.userId,
          sourceId: params.sourceId,
          entryId: params.entryId,
          filePath: params.filePath,
          fileSize: params.fileSize,
          status: params.status,
          errorMessage: params.error,
          processingTime: params.processingTime,
          createdAt: new Date()
        })
        .run();

      console.log(`[PROMPT] 记录存储日志: 用户${params.userId}, 文件:${params.filePath}, 状态:${params.status}`);
    } catch (error) {
      console.error(`记录用户${params.userId}存储日志失败:`, error);
    }
  }

  /**
   * 更新存储统计
   */
  async updateStorageStats(userId: number, fileSize: number): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 检查是否已有统计记录
      const existingStats = await this.db
        .select()
        .from(userStorageStats)
        .where(eq(userStorageStats.userId, userId))
        .get();

      if (existingStats) {
        // 更新现有统计
        await this.db
          .update(userStorageStats)
          .set({
            totalFiles: existingStats.totalFiles + 1,
            totalSize: existingStats.totalSize + fileSize,
            todayFiles: existingStats.todayFiles + 1,
            todaySize: existingStats.todaySize + fileSize,
            lastStorageAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(userStorageStats.userId, userId))
          .run();
      } else {
        // 创建新统计记录
        await this.db
          .insert(userStorageStats)
          .values({
            userId,
            totalFiles: 1,
            totalSize: fileSize,
            todayFiles: 1,
            todaySize: fileSize,
            lastStorageAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .run();
      }

      console.log(`[STATS] 更新用户${userId}存储统计: +${fileSize}字节`);
    } catch (error) {
      console.error(`更新用户${userId}存储统计失败:`, error);
    }
  }

  /**
   * 验证文件大小限制
   */
  validateFileSize(fileSize: number, config: UserAutoStorageConfig): boolean {
    return fileSize <= config.maxFileSize;
  }

  /**
   * 生成文件名
   */
  generateFileName(
    pattern: string, 
    metadata: {
      title: string;
      id: number;
      sourceName?: string;
      date?: Date;
    }
  ): string {
    const { title, id, sourceName, date = new Date() } = metadata;
    
    // 准备替换变量
    const variables = {
      title: this.sanitizeFileName(title),
      id: id.toString(),
      date: date.toISOString().split('T')[0], // YYYY-MM-DD
      time: date.toTimeString().slice(0, 8).replace(/:/g, ''), // HHMMSS
      source: sourceName ? this.sanitizeFileName(sourceName) : 'unknown',
      user: metadata.id.toString()
    };

    let fileName = pattern;
    
    // 替换所有变量
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      fileName = fileName.replace(new RegExp(placeholder, 'g'), value);
    }

    // 确保文件名以.md结尾
    if (!fileName.endsWith('.md')) {
      fileName += '.md';
    }

    return fileName;
  }

  /**
   * 清理文件名，移除不安全字符
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^\w\s-]/g, '') // 移除特殊字符
      .replace(/\s+/g, '_')     // 空格替换为下划线
      .replace(/-+/g, '_')      // 多个连字符替换为下划线
      .replace(/^_+|_+$/g, '')   // 移除开头和结尾的下划线
      .substring(0, 100);        // 限制长度
  }

  /**
   * 获取支持的文件格式
   */
  getSupportedFormats(): Array<{
    id: string;
    name: string;
    description: string;
  }> {
    return [
      {
        id: 'standard',
        name: '标准格式',
        description: '平衡的文档结构，包含完整的元数据和分析结果'
      },
      {
        id: 'academic',
        name: '学术格式',
        description: '严谨的学术格式，适合研究和分析报告'
      },
      {
        id: 'concise',
        name: '简洁格式',
        description: '精简的表达方式，突出核心信息'
      }
    ];
  }

  /**
   * 验证配置有效性
   */
  validateConfig(config: Partial<UserAutoStorageConfig>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.maxFileSize !== undefined && config.maxFileSize <= 0) {
      errors.push('最大文件大小必须大于0');
    }

    if (config.maxFilesPerDay !== undefined && config.maxFilesPerDay <= 0) {
      errors.push('每日最大文件数必须大于0');
    }

    if (config.storagePath && !/^[a-zA-Z0-9_-]+$/.test(config.storagePath)) {
      errors.push('存储路径只能包含字母、数字、下划线和连字符');
    }

    if (config.filenamePattern && !config.filenamePattern.includes('{title}')) {
      errors.push('文件名模式必须包含{title}变量');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}